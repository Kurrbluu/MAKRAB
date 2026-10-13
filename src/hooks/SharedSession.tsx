import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { assertSharedGame } from '../lib/sharedGame'
import type { SharedCommand, SharedCue, SharedSnapshot } from '../lib/sharedGame'
import { createServerClock } from '../lib/serverClock'
import { readSessionMetadata, subscribeCloud } from '../lib/sessionTransport'
import type { SessionMetadata } from '../lib/sessionTransport'
import { GAME_PHASES } from '../data/gamePhases'

type Connection = 'connecting' | 'connected' | 'reconnecting'
type CommandGuard = { gameId: string; expectedRevision: number }
type SharedSession = {
  snapshot: SharedSnapshot | null
  connection: Connection
  busy: boolean
  error: string
  liveCue: SharedCue | null
  online: boolean
  canControl: boolean
  refreshAccess: () => Promise<void>
  now: () => number
  send: (command: SharedCommand, guard?: CommandGuard) => Promise<boolean>
  request: (command: SharedCommand, guard?: CommandGuard) => Promise<SharedSnapshot | null>
}
const SharedContext = createContext<SharedSession | null>(null)
export const sharedSessionEnabled = Boolean(document.querySelector('meta[name="makrab-session"][content="shared"]'))
const cacheKey = 'makrab:shared-session:v1'
const localTimestamp = () => performance.timeOrigin + performance.now()

export function SharedSessionProvider({ children }: { children: ReactNode }) {
  const clock = useMemo(() => createServerClock(localTimestamp), [])
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(() => {
    if (!sharedSessionEnabled) return null
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) ?? 'null')
      assertSharedGame(cached.snapshot.state)
      clock.restore(cached.offset)
      return cached.snapshot
    } catch { return null }
  })
  const snapshotRef = useRef(snapshot)
  const [connection, setConnection] = useState<Connection>('connecting')
  const connectionRef = useRef<Connection>('connecting')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [liveCue, setLiveCue] = useState<SharedCue | null>(null)
  const baseline = useRef(true)
  const mounted = useRef(false)
  const receivedBaseline = useRef(false)
  const [online, setOnline] = useState(false)
  const onlineRef = useRef(false)
  const [canControl, setCanControl] = useState(false)
  const accessRef = useRef(false)
  const accessEpoch = useRef(0)
  const refreshRef = useRef<(() => Promise<void>) | null>(null)

  const refreshAccess = useCallback(async () => {
    if (!onlineRef.current) return
    const epoch = ++accessEpoch.current
    try {
      const response = await fetch('/api/access', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
      const access = response.ok && (await response.json()).canControl === true
      if (mounted.current && epoch === accessEpoch.current) { accessRef.current = access; setCanControl(access) }
    } catch { /* Access will be checked again on focus or the next refresh. */ }
  }, [])

  const apply = useCallback((incoming: SharedSnapshot, hydration = false) => {
    assertSharedGame(incoming.state)
    if (!Number.isFinite(incoming.serverNow)) throw new Error('Waktu server tidak valid.')
    const previous = snapshotRef.current
    if (previous && incoming.state.revision < previous.state.revision && (!hydration || receivedBaseline.current)) return
    if (!hydration && !baseline.current && incoming.state.active && incoming.state.cue
      && incoming.state.cue.id !== previous?.state.cue?.id && incoming.state.cue.startsAt >= clock.now() - 2500) setLiveCue(incoming.state.cue)
    else if (hydration || !incoming.state.active || incoming.state.cue === null) setLiveCue(null)
    if (hydration) setError('')
    snapshotRef.current = incoming
    receivedBaseline.current = true
    setSnapshot(incoming)
    try { localStorage.setItem(cacheKey, JSON.stringify({ snapshot: incoming, offset: clock.offset() })) } catch { /* Server remains authoritative. */ }
  }, [clock])

  useEffect(() => {
    if (!sharedSessionEnabled) return
    mounted.current = true
    let source: EventSource | undefined
    let reconnectTimer: number | undefined
    let calibrationTimer: number | undefined
    let accessTimer: number | undefined
    let closeCloud: (() => void) | undefined
    let metadata: SessionMetadata | undefined
    let realtimeReady = false
    let lastRead = 0
    let reading: Promise<void> | undefined
    let cancelled = false
    const disconnected = () => {
      if (cancelled) return
      baseline.current = true
      connectionRef.current = snapshotRef.current ? 'reconnecting' : 'connecting'
      setConnection(connectionRef.current)
      setLiveCue(null)
    }
    const connected = () => {
      baseline.current = false
      connectionRef.current = 'connected'
      setConnection('connected')
    }
    const calibrate = async (hydration: boolean) => {
      if (reading) return reading
      reading = (async () => {
        const before = localTimestamp()
        const response = await fetch('/api/session', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        if (!response.ok) throw new Error('Server sesi belum tersedia.')
        const incoming: SharedSnapshot = await response.json()
        const after = localTimestamp()
        if (cancelled) return
        clock.observe(incoming.serverNow, before, after, incoming.serverReceivedAt)
        apply(incoming, hydration)
        lastRead = localTimestamp()
        if (metadata?.transport === 'supabase' || source?.readyState === EventSource.OPEN) connected()
      })()
      try { await reading } finally { reading = undefined }
    }
    const connect = async () => {
      source?.close()
      window.clearTimeout(reconnectTimer)
      window.clearInterval(calibrationTimer)
      window.clearInterval(accessTimer)
      closeCloud?.()
      closeCloud = undefined
      realtimeReady = false
      disconnected()
      try {
        metadata = await readSessionMetadata()
        if (cancelled) return
        onlineRef.current = metadata.online
        setOnline(metadata.online)
        accessRef.current = !metadata.authRequired
        setCanControl(!metadata.authRequired)
        if (metadata.transport === 'supabase') {
          // Subscribe first, then read authoritative state; also catch up after each reconnect.
          closeCloud = await subscribeCloud(metadata, state => {
            if (cancelled) return
            try { apply({ state, serverNow: clock.now() }, baseline.current); connected() }
            catch { void calibrate(true).catch(disconnected) }
          }, ready => {
            if (cancelled) return
            realtimeReady = ready
            if (ready) void calibrate(baseline.current).catch(disconnected)
          })
          if (cancelled) { closeCloud(); return }
          await calibrate(true)
          await refreshAccess()
          // HTTP catches up when WebSockets are unavailable; countdowns still run locally.
          calibrationTimer = window.setInterval(() => {
            // Do not compare the fallback interval with the previous response time:
            // that skips a tick whenever the previous request took nonzero time.
            if (!realtimeReady || localTimestamp() - lastRead >= 10_000) void calibrate(baseline.current).catch(disconnected)
          }, 1000)
          accessTimer = window.setInterval(() => { void refreshAccess() }, 20_000)
          return
        }
        await calibrate(true)
        if (cancelled) return
        source = new EventSource('/api/events')
        source.addEventListener('state', event => {
          if (cancelled) return
          try {
            apply(JSON.parse((event as MessageEvent).data), baseline.current)
            connected()
          } catch { source?.close(); disconnected(); reconnectTimer = window.setTimeout(connect, 1500) }
        })
        source.onerror = disconnected
        calibrationTimer = window.setInterval(() => { void calibrate(baseline.current).catch(disconnected) }, 10_000)
      } catch (failure) {
        disconnected()
        if (!cancelled) setError(failure instanceof Error ? failure.message : 'Sesi belum berhasil tersambung.')
        if (!cancelled) reconnectTimer = window.setTimeout(connect, 1500)
      }
    }
    const refresh = async () => {
      if (cancelled) return
      try { await calibrate(baseline.current) } catch { disconnected() }
    }
    refreshRef.current = refresh
    const focus = () => { if (metadata?.online) { void refresh(); void refreshAccess() } }
    const visibility = () => { if (document.visibilityState === 'visible') focus() }
    const authChanged = () => { void refreshAccess() }
    void connect()
    window.addEventListener('offline', disconnected)
    window.addEventListener('online', focus)
    window.addEventListener('focus', focus)
    window.addEventListener('makrab:gm-auth', authChanged)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelled = true
      mounted.current = false
      accessEpoch.current++
      source?.close()
      closeCloud?.()
      refreshRef.current = null
      window.clearTimeout(reconnectTimer)
      window.clearInterval(calibrationTimer)
      window.clearInterval(accessTimer)
      window.removeEventListener('offline', disconnected)
      window.removeEventListener('online', focus)
      window.removeEventListener('focus', focus)
      window.removeEventListener('makrab:gm-auth', authChanged)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [apply, clock, refreshAccess])

  useEffect(() => {
    if (!online || !snapshot) return
    const state = snapshot.state
    const timer = state.rundown.bank.timers[GAME_PHASES[state.rundown.phaseIndex].timerId]
    const due = state.presentation?.completesAt ?? timer.deadline
    if (due === null) return
    // Vercel requests advance expired phases. No always-running cloud process is required.
    const delay = Math.max(30, due - clock.now() + 30)
    const timeout = window.setTimeout(() => { void refreshRef.current?.() }, Math.min(delay, 2_147_483_647))
    return () => window.clearTimeout(timeout)
  }, [online, snapshot, clock])

  const request = useCallback(async (command: SharedCommand, guard?: CommandGuard) => {
    const current = snapshotRef.current
    if (!accessRef.current) { setError('Masuk melalui GM Access untuk mengendalikan permainan.'); return null }
    if (!current || connectionRef.current !== 'connected' || busyRef.current) {
      setError('Tunggu sampai tersambung ke sesi bersama.')
      return null
    }
    if (guard && (guard.gameId !== current.state.gameId || guard.expectedRevision !== current.state.revision)) {
      setError('Timer sudah diperbarui dari perangkat lain. Periksa waktu terbaru lalu atur kembali.')
      return null
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    const commandId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      const before = localTimestamp()
      const response = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId, expectedRevision: guard?.expectedRevision ?? current.state.revision, command }), signal: AbortSignal.timeout(12_000) })
      const incoming: SharedSnapshot & { error?: string } = await response.json()
      if (!mounted.current) return null
      if (incoming.state) {
        clock.observe(incoming.serverNow, before, localTimestamp(), incoming.serverReceivedAt)
        apply(incoming, baseline.current)
      }
      if (!response.ok) {
        if (response.status === 401) { accessRef.current = false; setCanControl(false) }
        setError(incoming.error ?? 'Perintah belum diterapkan. Periksa keadaan permainan.'); return null
      }
      return incoming
    } catch {
      if (mounted.current) {
        baseline.current = true
        connectionRef.current = 'reconnecting'
        setConnection('reconnecting')
        setLiveCue(null)
        setError('Koneksi terputus. Perintah tidak diulang otomatis; periksa sesi setelah tersambung.')
      }
      return null
    } finally { busyRef.current = false; if (mounted.current) setBusy(false) }
  }, [apply, clock])
  const send = useCallback(async (command: SharedCommand, guard?: CommandGuard) => Boolean(await request(command, guard)), [request])

  const value = useMemo<SharedSession>(() => ({ snapshot, connection, busy, error, liveCue, online, canControl, refreshAccess, now: clock.now, send, request }), [snapshot, connection, busy, error, liveCue, online, canControl, refreshAccess, clock, send, request])
  return <SharedContext.Provider value={sharedSessionEnabled ? value : null}>{children}</SharedContext.Provider>
}

export function useSharedSession() { return useContext(SharedContext) }
