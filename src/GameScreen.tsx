import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import BackgroundDecoration from './components/BackgroundDecoration'
import CelestialBackdrop from './components/CelestialBackdrop'
import GameEndScreen from './components/GameEndScreen'
import ExchangeDraw from './components/ExchangeDraw'
import RouletteDisplay from './components/RouletteDisplay'
import PhaseCueSettings from './components/PhaseCueSettings'
import SoundActivation from './components/SoundActivation'
import GameAtmosphere from './components/GameAtmosphere'
import ExchangeResults from './components/ExchangeResults'
import TimerDialAdjuster from './components/TimerDialAdjuster'
import type { TimerDialSave } from './components/TimerDialAdjuster'
import { PhaseDisplayFrame, PhaseJourney, PhasePanelArtwork, TimerEngraving } from './components/PhaseArtwork'
import useGameSound from './hooks/useGameSound'
import useRandomizerSound from './hooks/useRandomizerSound'
import { factions } from './data/game'
import { GAME_PHASES } from './data/gamePhases'
import type { ExchangeNumber, GamePhase } from './data/gamePhases'
import { TIMER_CONFIG } from './data/timers'
import type { TimerId } from './data/timers'
import {
  formatTime, pauseAllTimers, pauseTimer, remainingTime, resetTimer,
  setTimerDuration, startTimer,
} from './lib/gameTimer'
import {
  completeRundownDraw, createRundown, prepareRundownDraw, restoreRundown, RUNDOWN_VERSION, rundownStorageKey,
  selectRundownPhase, settleRundown, startRundownPhase,
} from './lib/gameRundown'
import type { GameRundown } from './lib/gameRundown'
import { ensureExchangeTargets, exchangeDrawRound, visibleExchangeRound } from './lib/exchangeFlow'
import { emptySession, randomizerStorageKey, restoreSession } from './lib/randomizer'
import type { RandomizerSession } from './lib/randomizer'
import { createPhaseCueTracker, observePhaseCue } from './lib/phaseCues'
import { playPhaseCue, stopPhaseCue, stopRandomizerSound } from './lib/phaseCueAudio'
import { useSharedSession } from './hooks/SharedSession'
import { EXCHANGE_PRESENTATION } from './lib/exchangePresentation'
import './game-screen.css'

const iconPaths = {
  play: 'M8 5l11 7-11 7V5Z',
  pause: 'M8 5v14M16 5v14',
  reset: 'M4 10a8 8 0 1 1 1 8M4 4v6h6',
  edit: 'M14 5l5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14v6Z',
  check: 'M5 12l4 4L19 6',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M19 12H5m7-7-7 7 7 7',
  previous: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  exitFullscreen: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
  sound: 'M4 9h4l5-4v14l-5-4H4V9Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  muted: 'M4 9h4l5-4v14l-5-4H4V9Zm13 1 5 5m0-5-5 5',
}

function ControlIcon({ name }: { name: keyof typeof iconPaths }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={`timer-control-icon timer-control-icon--${name}`}><path d={iconPaths[name]} /></svg>
}

function phaseLabel(phase: GamePhase) {
  return phase.title
}

function loadRundown() {
  try { return restoreRundown(localStorage.getItem(rundownStorageKey), Date.now()) }
  catch { return createRundown() }
}

const factionIds = factions.map(faction => faction.id)
function loadDraws() {
  try { return restoreSession(localStorage.getItem(randomizerStorageKey), factionIds) }
  catch { return emptySession() }
}

type DurationDraft = { id: TimerId; minutes: string; seconds: string; phaseIndex?: number }

export default function GameScreen() {
  const shared = useSharedSession()
  const [localRundown, setRundown] = useState(() => shared ? createRundown() : loadRundown())
  const rundown = shared?.snapshot?.state.rundown ?? localRundown
  const results = shared?.snapshot?.state.results?.presentation ?? null
  const rundownRef = useRef(rundown)
  const bank = rundown.bank
  const phase = GAME_PHASES[rundown.phaseIndex] ?? GAME_PHASES[0]
  const [localDraws, setDraws] = useState(() => shared ? emptySession() : loadDraws())
  const draws = shared?.snapshot?.state.draws ?? localDraws
  const drawsRef = useRef(draws)
  const previousPhaseRef = useRef(phase.id)
  const [localAnimatingRound, setAnimatingRound] = useState<ExchangeNumber | null>(null)
  const presentation = shared?.snapshot?.state.presentation
  const timeline = useMemo(() => presentation && shared ? { id: presentation.id, startsAt: presentation.startsAt, now: shared.now } : undefined,
    [presentation?.id, presentation?.startsAt, shared?.now])
  const animatingRound = shared ? presentation?.round ?? null : localAnimatingRound
  const animatingRoundRef = useRef<ExchangeNumber | null>(null)
  const [drawProgress, setDrawProgress] = useState<boolean[]>(factions.map(() => false))
  const [localDrawAnimationKey, setDrawAnimationKey] = useState(0)
  const drawAnimationKey = shared ? presentation?.id ?? 'settled' : localDrawAnimationKey
  const [localRouletteStopped, setRouletteStopped] = useState(false)
  const rouletteStopped = timeline ? timeline.now() >= timeline.startsAt + EXCHANGE_PRESENTATION.launchDelayMs + EXCHANGE_PRESENTATION.spinDurationMs : localRouletteStopped
  const [drawError, setDrawError] = useState('')
  const preparationDrawRound = exchangeDrawRound(rundown.phaseIndex)
  const drawRound = visibleExchangeRound(rundown.phaseIndex, draws)
  const drawResult = drawRound ? draws.rounds[drawRound] : undefined
  const mainRef = useRef<HTMLElement>(null)
  const newGameDialogRef = useRef<HTMLDialogElement>(null)
  const [now, setNow] = useState(Date.now)
  const [fullscreen, setFullscreen] = useState(false)
  const [draft, setDraft] = useState<DurationDraft | null>(null)
  const [dialPreview, setDialPreview] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const { settings: cueSettings, status: audioStatus, changeSettings: changeCueSettings } = useGameSound()
  const [cueSettingsOpen, setCueSettingsOpen] = useState(false)
  const sharedUnavailable = Boolean(shared && (shared.connection !== 'connected' || shared.busy || !shared.snapshot || !shared.canControl))
  const sharedNow = shared?.now
  if (shared) { rundownRef.current = rundown; drawsRef.current = draws; animatingRoundRef.current = animatingRound }
  const initialClock = bank.timers[phase.timerId]
  const cueTracker = useRef(createPhaseCueTracker(rundown.phaseIndex, initialClock.deadline !== null || initialClock.remainingMs < initialClock.durationMs))
  const pendingPhaseCue = useRef<{ phaseIndex: number; id: TimerId; requested: boolean } | null>(null)
  const revealSound = useRandomizerSound({ active: animatingRound !== null && (!shared || shared.connection === 'connected'), stopped: rouletteStopped, animationKey: drawAnimationKey,
    settings: cueSettings, status: audioStatus, timeline })

  useEffect(() => {
    if (shared) return
    const cue = observePhaseCue(cueTracker.current, rundown.phaseIndex, bank.timers[phase.timerId].deadline !== null)
    cueTracker.current = cue.tracker
    if (!cueSettings.enabled || pendingPhaseCue.current?.phaseIndex !== rundown.phaseIndex) pendingPhaseCue.current = null
    if (cue.play && cueSettings.enabled) pendingPhaseCue.current = { phaseIndex: rundown.phaseIndex, id: phase.timerId, requested: false }
    const pending = pendingPhaseCue.current
    if (!pending || pending.requested || audioStatus.state !== 'ready' || bank.timers[phase.timerId].deadline === null) return
    pending.requested = true
    void playPhaseCue(pending.id, cueSettings.volume).then(played => {
      if (pendingPhaseCue.current !== pending) return
      if (played) pendingPhaseCue.current = null
      else pending.requested = false
    })
  }, [rundown.phaseIndex, phase.timerId, bank.timers, cueSettings.enabled, cueSettings.volume, audioStatus])

  const previousSharedCue = useRef(shared?.snapshot?.state.cue?.id)
  useEffect(() => {
    if (!shared) return
    const id = shared.snapshot?.state.cue?.id
    if (previousSharedCue.current && previousSharedCue.current !== id) stopPhaseCue()
    previousSharedCue.current = id
  }, [shared?.snapshot?.state.cue?.id])

  const sharedCueSeen = useRef(new Set<string>())
  const sharedCuePending = useRef<{ id: string; phaseIndex: number; timerId: TimerId; performanceStart: number; requested: boolean } | null>(null)
  useEffect(() => {
    if (!shared) return
    const cue = shared.liveCue
    if (cue && !sharedCueSeen.current.has(cue.id)) {
      sharedCueSeen.current.add(cue.id)
      sharedCuePending.current = { ...cue, performanceStart: performance.now() + cue.startsAt - shared.now(), requested: false }
    }
    const pending = sharedCuePending.current
    if (!pending) return
    if (shared.connection !== 'connected' || !cueSettings.enabled || pending.phaseIndex !== rundown.phaseIndex
      || bank.timers[phase.timerId].deadline === null || performance.now() - pending.performanceStart > 4000) {
      sharedCuePending.current = null
      return
    }
    if (pending.requested || audioStatus.state !== 'ready') return
    pending.requested = true
    void playPhaseCue(pending.timerId, cueSettings.volume, pending.performanceStart).then(played => {
      if (sharedCuePending.current === pending) {
        if (played) sharedCuePending.current = null
        else pending.requested = false
      }
    })
  }, [shared?.liveCue?.id, shared?.connection, cueSettings.enabled, cueSettings.volume, audioStatus, rundown.phaseIndex, phase.timerId, bank.timers])

  const previousSharedGame = useRef(shared?.snapshot?.state.gameId)
  useLayoutEffect(() => {
    if (!shared) return
    if (previousPhaseRef.current !== phase.id || previousSharedGame.current !== shared.snapshot?.state.gameId) {
      previousPhaseRef.current = phase.id
      previousSharedGame.current = shared.snapshot?.state.gameId
      setDraft(null)
      setDialPreview(null)
      sharedCuePending.current = null
      stopPhaseCue()
      stopRandomizerSound()
    }
  }, [phase.id, shared?.snapshot?.state.gameId])

  const commit = useCallback((next: GameRundown) => {
    rundownRef.current = next
    setRundown(next)
    setNow(Date.now())
    try { localStorage.setItem(rundownStorageKey, JSON.stringify(next)) }
    catch { setAnnouncement('Timer berjalan, tetapi browser tidak dapat menyimpan progres.') }
  }, [])

  const commitDraws = useCallback((next: RandomizerSession) => {
    drawsRef.current = next
    setDraws(next)
    try { localStorage.setItem(randomizerStorageKey, JSON.stringify(next)) }
    catch { setDrawError('Hasil tetap tampil, tetapi browser tidak dapat menyimpannya.') }
  }, [])

  useLayoutEffect(() => {
    if (shared) return
    if (rundown.version === RUNDOWN_VERSION && GAME_PHASES[rundown.phaseIndex]) return
    animatingRoundRef.current = null
    setAnimatingRound(null)
    setDraft(null)
    commit(createRundown())
  }, [rundown, commit])

  const prepareExchange = useCallback((round: ExchangeNumber, animate: boolean) => {
    if (shared) { void shared.send({ type: 'replay' }); return }
    setDrawError('')
    try {
      const ready = ensureExchangeTargets(drawsRef.current, round, factionIds)
      // Save and lock the actual targets before showing the animation.
      if (ready.session !== drawsRef.current) commitDraws(ready.session)
      animatingRoundRef.current = animate ? round : null
      if (animate) {
        setDraft(null)
        setDrawProgress(factions.map(() => false))
        setDrawAnimationKey(key => key + 1)
        setRouletteStopped(false)
        const current = rundownRef.current
        const queued = prepareRundownDraw(current, Date.now())
        if (queued !== current) commit(queued)
      }
      setAnimatingRound(animate ? round : null)
      setAnnouncement(`Target Exchange ${round} sudah ditetapkan.`)
    } catch {
      setDrawError('Target belum berhasil diacak.')
      animatingRoundRef.current = null
      setAnimatingRound(null)
      const next = { ...rundownRef.current }
      if (next.startAfterDraw) { delete next.startAfterDraw; commit(next) }
    }
  }, [commit, commitDraws, shared?.send])

  const finishRoulette = useCallback(() => { if (!shared && animatingRoundRef.current !== null) setRouletteStopped(true) }, [Boolean(shared)])

  const updateDrawProgress = useCallback((settled: boolean[]) => {
    setDrawProgress(settled)
    revealSound(settled)
  }, [revealSound])

  const finishDrawing = useCallback(() => {
    if (shared) return
    const activeRound = animatingRoundRef.current
    animatingRoundRef.current = null
    setAnimatingRound(null)
    const current = rundownRef.current
    if (activeRound !== null && exchangeDrawRound(current.phaseIndex) === activeRound) {
      const next = completeRundownDraw(current, Date.now())
      if (next !== current) commit(next)
    }
  }, [commit, Boolean(shared)])

  useLayoutEffect(() => {
    if (shared) return
    if (rundown.version !== RUNDOWN_VERSION || !GAME_PHASES[rundown.phaseIndex]) return
    const entered = previousPhaseRef.current !== phase.id
    previousPhaseRef.current = phase.id
    if (preparationDrawRound) {
      const saved = drawsRef.current.rounds[preparationDrawRound]
      const timer = rundown.bank.timers[phase.timerId]
      const firstCountdownUnstarted = rundown.phaseIndex === 0 && timer.deadline === null && timer.remainingMs === timer.durationMs
      if (entered || !saved || !saved.confirmed || ((rundown.startAfterDraw || firstCountdownUnstarted) && animatingRoundRef.current !== preparationDrawRound)) prepareExchange(preparationDrawRound, true)
      return
    }
    setAnimatingRound(null)
    animatingRoundRef.current = null
    // A direct discussion or Exchange jump prepares the right round, without replaying roulette.
    if (phase.round && !phase.hideExchangeTargets) {
      const saved = drawsRef.current.rounds[phase.round]
      if (!saved || !saved.confirmed) prepareExchange(phase.round, false)
    }
    // Recheck a cleared result when starting a new game in this same phase.
  }, [phase.id, phase.timerId, phase.round, phase.hideExchangeTargets, preparationDrawRound, drawResult, prepareExchange, rundown.phaseIndex, rundown.version, rundown.startAfterDraw])

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
    const tick = () => {
      if (sharedNow) { setNow(sharedNow()); return }
      const timestamp = Date.now()
      const current = rundownRef.current
      const next = settleRundown(current, timestamp)
      if (next !== current) {
        if (next.phaseIndex !== current.phaseIndex) {
          setAnnouncement(`${GAME_PHASES[next.phaseIndex].title} dimulai.`)
        } else {
          setAnnouncement(current.phaseIndex === GAME_PHASES.length - 1
            ? 'Permainan selesai. Ketiga Exchange sudah tuntas. Tunggu pengumuman pemenang dari Game Master.'
            : `${GAME_PHASES[current.phaseIndex].title} selesai. Pilih fase berikutnya.`)
        }
        commit(next)
      }
      setNow(timestamp)
    }
    tick()
    const interval = window.setInterval(tick, sharedNow ? 100 : 200)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', tick) }
  }, [commit, sharedNow])

  const toggle = useCallback(() => {
    if (shared) { void shared.send({ type: 'toggle' }); return }
    const timestamp = Date.now()
    const current = settleRundown(rundownRef.current, timestamp)
    if (animatingRoundRef.current !== null || current.startAfterDraw) {
      commit(startRundownPhase(current, timestamp))
      setAnnouncement('Timer dimulai setelah undian selesai.')
      return
    }
    const id = GAME_PHASES[current.phaseIndex].timerId
    const running = current.bank.timers[id].deadline !== null
    commit({ ...current, bank: running ? pauseTimer(current.bank, id, timestamp) : startTimer(current.bank, id, timestamp) })
    setAnnouncement(`${GAME_PHASES[current.phaseIndex].title} ${running ? 'dijeda' : 'dimulai'}.`)
  }, [commit, shared?.send])

  const restart = useCallback(() => {
    if (shared) { void shared.send({ type: 'reset' }); return }
    const current = rundownRef.current
    const id = GAME_PHASES[current.phaseIndex].timerId
    commit({ ...current, bank: resetTimer(current.bank, id) })
  }, [commit, shared?.send])

  const changePhase = useCallback((index: number, start = false) => {
    if (shared?.snapshot?.state.results?.presentation && start && index === rundownRef.current.phaseIndex + 1) {
      if (shared.snapshot.state.results.presentation.kind === 'ranking') void shared.send({ type: 'resultsNext' })
      return
    }
    if (index < 0 || index >= GAME_PHASES.length) return
    if (shared) { setDraft(null); setDialPreview(null); void shared.send({ type: 'phase', index, start }); return }
    stopPhaseCue()
    stopRandomizerSound()
    const next = selectRundownPhase(index)
    const nextPhase = GAME_PHASES[index]
    animatingRoundRef.current = null
    setAnimatingRound(null)
    setDraft(null)
    setDialPreview(null)
    commit(start ? startRundownPhase(next, Date.now()) : next)
    setAnnouncement(`${nextPhase.title}. ${start ? nextPhase.drawTargets ? 'Undian dimulai, kemudian timer.' : 'Timer dimulai.' : 'Timer siap.'}`)
  }, [commit, shared?.send])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch { setAnnouncement('Fullscreen tidak tersedia melalui tombol. Gunakan menu browser.') }
  }, [])

  function startNewGame() {
    if (shared) { void shared.send({ type: 'newGame' }).then(success => { if (success) newGameDialogRef.current?.close() }); return }
    stopPhaseCue()
    stopRandomizerSound()
    cueTracker.current = createPhaseCueTracker(0)
    pendingPhaseCue.current = null
    const next = createRundown()
    setAnimatingRound(null)
    animatingRoundRef.current = null
    setDrawError('')
    commitDraws(emptySession())
    commit(next)
    setDraft(null)
    setDialPreview(null)
    newGameDialogRef.current?.close()
    mainRef.current?.focus({ preventScroll: true })
    setAnnouncement('Permainan baru siap. Timer dan semua hasil target direset. Terawang pertama siap dimulai.')
  }

  useEffect(() => {
    const changed = () => setFullscreen(Boolean(document.fullscreenElement))
    changed()
    document.addEventListener('fullscreenchange', changed)
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
      const target = event.target instanceof Element ? event.target : null
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        if (event.defaultPrevented || target?.closest('input, select, textarea, [contenteditable="true"], dialog[open], [role="dialog"], [role="slider"]')) return
        event.preventDefault()
        const forward = event.key === 'ArrowRight'
        changePhase(rundownRef.current.phaseIndex + (forward ? 1 : -1), forward)
        return
      }
      if (target?.closest('button, a, input, select, textarea, [contenteditable="true"], dialog[open], [role="dialog"], [role="slider"]')) return
      const current = rundownRef.current
      if (shared?.snapshot?.state.results?.presentation && (event.code === 'Space' || event.code === 'KeyR')) { event.preventDefault(); return }
      if (current.phaseIndex === GAME_PHASES.length - 1 && remainingTime(current.bank.timers.movement, sharedNow?.() ?? Date.now()) === 0
        && (event.code === 'Space' || event.code === 'KeyR')) { event.preventDefault(); return }
      if (event.code === 'Space') { event.preventDefault(); toggle() }
      if (event.code === 'KeyR') { event.preventDefault(); restart() }
      if (event.code === 'KeyF') { event.preventDefault(); void toggleFullscreen() }
    }
    window.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('fullscreenchange', changed); window.removeEventListener('keydown', keydown) }
  }, [changePhase, restart, toggle, toggleFullscreen])

  async function editDuration() {
    let current = rundownRef.current
    const id = GAME_PHASES[current.phaseIndex].timerId
    if (shared) { if (!await shared.send({ type: 'pause' })) return }
    else { current = { ...current, bank: pauseAllTimers(current.bank, Date.now()) }; commit(current) }
    const seconds = Math.round(current.bank.timers[id].durationMs / 1000)
    setDraft({ id, phaseIndex: current.phaseIndex, minutes: String(Math.floor(seconds / 60)).padStart(2, '0'), seconds: String(seconds % 60).padStart(2, '0') })
  }

  const minutes = Number(draft?.minutes)
  const seconds = Number(draft?.seconds)
  const durationMs = (minutes * 60 + seconds) * 1000
  const draftConfig = TIMER_CONFIG.find((timer) => timer.id === draft?.id)
  const validDraft = Boolean(draft && draft.minutes !== '' && draft.seconds !== '' && draftConfig
    && Number.isInteger(minutes) && Number.isInteger(seconds) && minutes >= 0 && minutes <= 59
    && seconds >= 0 && seconds <= 59 && durationMs >= 1000 && durationMs <= draftConfig.maxDurationMs)

  function saveDuration(event: FormEvent) {
    event.preventDefault()
    if (!draft || !validDraft) return
    if (shared) {
      if (draft.phaseIndex !== rundownRef.current.phaseIndex) { setDraft(null); return }
      void shared.send({ type: 'duration', durationMs }).then(success => { if (success) setDraft(null) })
      return
    }
    const current = rundownRef.current
    commit({ ...current, bank: setTimerDuration(current.bank, draft.id, durationMs) })
    setDraft(null)
  }

  async function beginDialAdjustment(): Promise<TimerDialSave | null> {
    const current = rundownRef.current
    const phaseIndex = current.phaseIndex
    const id = GAME_PHASES[phaseIndex].timerId
    if (shared) {
      const start = shared.snapshot
      if (!start) return null
      const gameId = start.state.gameId
      const paused = await shared.request({ type: 'pause' }, { gameId, expectedRevision: start.state.revision })
      if (!paused || paused.state.gameId !== gameId || paused.state.rundown.phaseIndex !== phaseIndex) return null
      return durationMs => shared.send({ type: 'duration', durationMs }, { gameId: paused.state.gameId, expectedRevision: paused.state.revision })
    }
    const paused = { ...current, bank: pauseAllTimers(current.bank, Date.now()) }
    commit(paused)
    const clock = paused.bank.timers[id]
    return async durationMs => {
      const latest = rundownRef.current
      if (latest.phaseIndex !== phaseIndex || latest.bank.timers[id] !== clock) return false
      commit({ ...latest, bank: setTimerDuration(latest.bank, id, durationMs) })
      setAnnouncement(`Waktu diatur ke ${formatTime(durationMs)}. Timer dijeda.`)
      return true
    }
  }

  const config = TIMER_CONFIG.find(item => item.id === phase.timerId)!
  const timer = bank.timers[phase.timerId]
  const remaining = remainingTime(timer, now)
  const displayedRemaining = dialPreview ?? remaining
  const ringFraction = Math.max(0, Math.min(1, displayedRemaining / timer.durationMs))
  const gameFinished = phase.id === 'exchange-final' && remaining === 0 && timer.deadline === null && !results
  const running = timer.deadline !== null
  const editing = draft?.id === phase.timerId
  const formId = `duration-${phase.timerId}`
  const drawing = Boolean(drawRound && (animatingRound === drawRound || rundown.startAfterDraw))
  const lastSeconds = running && remaining > 0 && remaining <= 15_000 && !drawing && !editing
  const timerState = remaining === 0 ? rundown.phaseIndex === GAME_PHASES.length - 1 ? 'Permainan selesai · Umumkan pemenang.' : 'Waktu habis' : running ? 'Timer berjalan' : remaining < timer.durationMs ? 'Timer dijeda' : 'Siap dimulai'
  const connectionNotice = shared && shared.connection !== 'connected'
    ? shared.connection === 'connecting' ? 'Menghubungkan sesi…' : 'Menyambungkan kembali…'
    : undefined
  const sharedNotice = connectionNotice || shared?.error

  useEffect(() => {
    if (!gameFinished && !results) return
    stopPhaseCue()
    stopRandomizerSound()
    pendingPhaseCue.current = null
    setDraft(null)
    setDialPreview(null)
    setCueSettingsOpen(false)
  }, [gameFinished, results?.kind, results?.round])

  if (shared && !shared.snapshot) return <main className="home timer-screen timer-screen--terawang shared-loading" data-sync-state={shared.connection}>
    <section role="status"><h1>Menyiapkan permainan</h1><p>Menghubungkan sesi bersama…</p>{shared.error && <p>{shared.error}</p>}</section>
  </main>

  return <main ref={mainRef} tabIndex={-1} className={`home home--landing timer-screen timer-screen--${phase.timerId}${gameFinished ? ' timer-screen--finished' : ''}${results ? ' timer-screen--results' : ''}${sharedNotice ? ' timer-screen--with-notice' : ''}`} data-phase-type={phase.timerId} data-game-state={results ? 'results' : gameFinished ? 'finished' : 'playing'} data-sync-state={shared?.connection} data-session-revision={shared?.snapshot?.state.revision} data-session-id={shared?.snapshot?.state.gameId} style={{ '--timer-color': gameFinished ? '#cbb789' : config.color } as CSSProperties} aria-labelledby={results ? 'ranking-title' : gameFinished ? 'game-end-title' : 'active-phase-title'}>
    <BackgroundDecoration variant="landing" />
    {!gameFinished && <GameAtmosphere />}
    {gameFinished && <CelestialBackdrop />}
    <div className={`timer-shell${results ? ' timer-shell--results' : gameFinished ? ' timer-shell--finished' : drawRound ? ' timer-shell--with-draw' : ''}${!gameFinished && !results && drawing ? ' is-drawing' : ''}`}>
      <nav className="timer-nav" aria-label="Navigasi timer">
        <div className="timer-nav-start">
        <a className="timer-icon-button" href="#/" aria-label="Kembali ke Home" aria-disabled={sharedUnavailable || undefined} title="Kembali ke Home" onClick={event => {
          if (shared) { event.preventDefault(); void shared.send({ type: 'home' }); return }
          const current = rundownRef.current; commit({ ...current, bank: pauseAllTimers(current.bank, Date.now()) })
        }}><ControlIcon name="back" /></a>
        <a className="timer-gm-access" href="#/gm" target="_blank" rel="noopener noreferrer" aria-label="GM Access" title="GM Access">GM Access</a>
        </div>
        <div className="timer-phase-nav" aria-label="Fase rundown">
          <button className="timer-icon-button" onClick={() => changePhase(rundown.phaseIndex - 1)} disabled={rundown.phaseIndex === 0 || sharedUnavailable} aria-label="Fase sebelumnya" aria-keyshortcuts="ArrowLeft" title="Fase sebelumnya · ←"><ControlIcon name="previous" /></button>
          <label className="sr-only" htmlFor="timer-phase">Pilih fase rundown</label>
          <div className="timer-phase-display" aria-disabled={sharedUnavailable || undefined}>
            <PhaseDisplayFrame />
            <select id="timer-phase" className="timer-phase-select" value={rundown.phaseIndex} disabled={sharedUnavailable} title={results ? `Hasil Exchange ${results.round}` : gameFinished ? 'Permainan selesai' : phase.title} onChange={(event) => changePhase(Number(event.target.value))}>
              {GAME_PHASES.map((item, phaseIndex) => <option key={item.id} value={phaseIndex}>{phaseIndex === rundown.phaseIndex && results ? `Hasil Exchange ${results.round}` : gameFinished && phaseIndex === rundown.phaseIndex ? 'Permainan selesai' : phaseLabel(item)}</option>)}
            </select>
          </div>
          <button className={`timer-icon-button timer-next-phase${remaining === 0 ? ' is-ready' : ''}`} onClick={() => changePhase(rundown.phaseIndex + 1, true)} disabled={(rundown.phaseIndex === GAME_PHASES.length - 1 && results?.kind !== 'ranking') || results?.kind === 'waiting' || sharedUnavailable} aria-label={results ? 'Lanjut dari ranking' : 'Mulai fase berikutnya'} aria-keyshortcuts="ArrowRight" title="Lanjut · →"><ControlIcon name="next" /></button>
        </div>
        <div className="timer-nav-actions">
          <SoundActivation settings={cueSettings} status={audioStatus} onOpenSettings={() => setCueSettingsOpen(true)} />
          <button className="timer-icon-button" onClick={() => setCueSettingsOpen(true)} aria-label="Pengaturan sound cue" title="Suara fase dan randomizer"><ControlIcon name={cueSettings.enabled && cueSettings.volume > 0 ? 'sound' : 'muted'} /></button>
          <button className="timer-icon-button" disabled={sharedUnavailable || dialPreview !== null} onClick={() => newGameDialogRef.current?.showModal()} aria-label="Mulai permainan baru" title="Permainan baru"><ControlIcon name="reset" /></button>
          <button className="timer-icon-button" aria-label={fullscreen ? 'Keluar fullscreen' : 'Fullscreen'} aria-pressed={fullscreen} title="Fullscreen · F" onClick={() => void toggleFullscreen()}><ControlIcon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} /></button>
        </div>
      </nav>

      {results ? <ExchangeResults result={results} disabled={sharedUnavailable} onContinue={() => { if (shared) void shared.send({ type: 'resultsNext' }) }} />
      : gameFinished ? <GameEndScreen onNewGame={() => newGameDialogRef.current?.showModal()} onHome={shared ? () => { void shared.send({ type: 'home' }) } : undefined} disabled={sharedUnavailable} />
      : <>
      <section aria-labelledby="active-phase-title" data-timer-attention={lastSeconds ? 'last-seconds' : undefined} className={`timer-panel is-current${drawing ? ' timer-panel--roulette' : ''}${running ? ' is-running' : ''}${remaining === 0 ? ' is-finished' : ''}${editing ? ' is-editing' : ''}`}>
        <PhasePanelArtwork />
        {drawing && drawRound ? <RouletteDisplay key={drawAnimationKey} round={drawRound} settled={drawProgress} stopped={rouletteStopped} willStart={Boolean(rundown.startAfterDraw)} onStop={finishRoulette} timeline={timeline} /> : <>
        <div className="timer-heading">
          <PhaseJourney phase={phase.timerId} />
          <h1 id="active-phase-title" className="timer-title">{phaseLabel(phase)}</h1>
        </div>
        <div className="timer-clock-space">
          <div className="timer-dial">
            <TimerEngraving phase={phase.timerId} />
            <svg viewBox="0 0 320 320" className="timer-ring" aria-hidden="true"><circle className="timer-ring-track" cx="160" cy="160" r="149" /><circle className="timer-ring-progress" cx="160" cy="160" r="149" pathLength="100" strokeDasharray="100" strokeDashoffset={editing ? 0 : 100 * (1 - ringFraction)} />{!editing && displayedRemaining > 0 && <g className="timer-ring-beacon" transform={`rotate(${360 * ringFraction} 160 160)`}><path d="m309 156 4 4-4 4-4-4 4-4Z" /></g>}</svg>
            {!editing && <TimerDialAdjuster key={`${shared?.snapshot?.state.gameId ?? 'local'}:${rundown.phaseIndex}:${shared?.connection ?? 'local'}:${shared?.canControl ?? true}`} valueMs={remaining} maxMs={config.maxDurationMs} disabled={sharedUnavailable} onBegin={beginDialAdjustment} onPreview={setDialPreview} />}
            {editing ? <form id={formId} className="timer-duration-editor" onSubmit={saveDuration} onKeyDown={event => { if (event.key === 'Escape') setDraft(null) }}>
              <input type="number" inputMode="numeric" min={0} max={Math.floor(config.maxDurationMs / 60_000)} step={1} autoFocus value={draft.minutes} aria-label={`Menit ${phase.title}`} onFocus={event => event.currentTarget.select()} onChange={event => setDraft({ ...draft, minutes: event.target.value })} />
              <span aria-hidden="true">:</span>
              <input type="number" inputMode="numeric" min={0} max={59} step={1} value={draft.seconds} aria-label={`Detik ${phase.title}`} onFocus={event => event.currentTarget.select()} onChange={event => setDraft({ ...draft, seconds: event.target.value })} />
            </form> : <span className="timer-readout" role="timer" aria-live="off" aria-label={`${phase.title}: ${formatTime(displayedRemaining)}`}>{formatTime(displayedRemaining)}</span>}
          </div>
        </div>
        <div className="timer-operator-controls">
          <p className="timer-state" role={shared ? 'status' : undefined}>{dialPreview !== null ? 'Atur waktu · lepas untuk simpan' : timerState}</p>
          <div className="timer-card-controls">
            {editing ? <>
              <button className="timer-icon-button timer-play-button" type="submit" form={formId} disabled={!validDraft || sharedUnavailable} aria-label="Simpan durasi" title="Simpan"><ControlIcon name="check" /></button>
              <button className="timer-icon-button" onClick={() => setDraft(null)} aria-label="Batal mengubah durasi" title="Batal"><ControlIcon name="close" /></button>
            </> : <>
              <button className="timer-icon-button timer-play-button" disabled={sharedUnavailable || dialPreview !== null} onClick={toggle} aria-label={running ? 'Jeda timer' : 'Mulai timer'} aria-pressed={running} aria-keyshortcuts="Space" title={`${running ? 'Jeda' : 'Mulai'} · Space`}><ControlIcon name={running ? 'pause' : 'play'} /></button>
              <button className="timer-icon-button" disabled={sharedUnavailable || dialPreview !== null} onClick={restart} aria-label="Reset timer" aria-keyshortcuts="R" title="Reset · R"><ControlIcon name="reset" /></button>
              <button className="timer-icon-button" disabled={sharedUnavailable || dialPreview !== null} onClick={() => { void editDuration() }} aria-label="Ubah durasi timer" title="Ubah durasi"><ControlIcon name="edit" /></button>
            </>}
          </div>
        </div>
        </>}
      </section>
      {drawRound && <ExchangeDraw key={drawRound} round={drawRound} targets={drawResult?.targets} animate={preparationDrawRound === drawRound && animatingRound === drawRound} rouletteStopped={rouletteStopped} error={drawError}
        onFinish={finishDrawing}
        onRetry={() => prepareExchange(drawRound, preparationDrawRound === drawRound)}
        onReplay={preparationDrawRound === drawRound ? () => prepareExchange(drawRound, true) : undefined}
        onProgress={updateDrawProgress} timeline={timeline} disabled={sharedUnavailable} />}
      </>}
    </div>
    {sharedNotice && <aside className="shared-session-notice" role="status" data-connection={shared?.connection} aria-label="Status koneksi sesi">
      <span className="shared-session-dot" aria-hidden="true" />
      <div>{connectionNotice && <p>{connectionNotice}</p>}{shared?.error && <p className="shared-session-detail">{shared.error}</p>}</div>
    </aside>}
    <dialog ref={newGameDialogRef} className="dialog reset-dialog" aria-labelledby="new-game-title" onClick={event => { if (event.target === event.currentTarget) newGameDialogRef.current?.close() }}>
      <div className="dialog-card">
        <header className="dialog-header"><h2 id="new-game-title">Mulai permainan baru?</h2></header>
        <p className="dialog-description">{shared?.snapshot?.state.results?.enabled ? 'Timer, poin, dan semua hasil target akan direset.' : 'Timer dan semua hasil target akan direset.'} Permainan kembali ke Terawang pertama.</p>
        <div className="reset-dialog-actions">
          <button className="button button-secondary" onClick={() => newGameDialogRef.current?.close()} autoFocus>Batal</button>
          <button className="button button-primary" disabled={sharedUnavailable} onClick={startNewGame}>Mulai permainan baru</button>
        </div>
      </div>
    </dialog>
    <PhaseCueSettings open={cueSettingsOpen} settings={cueSettings} onChange={changeCueSettings} onClose={() => setCueSettingsOpen(false)} />
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </main>
}
