import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { factions } from './data/game'
import { GAME_PHASES } from './data/gamePhases'
import FactionEmblem from './components/FactionEmblem'
import { useSharedSession } from './hooks/SharedSession'
import { ROLE_POINTS, SCORE_ROLES, nextScoreRound, roundProgress, scoreKey } from './lib/gameScoring'
import type { ScoringState, ScoringCommand, ScoreEntry, ScoreRole, ScoreRoom, ScoreRound } from './lib/gameScoring'
import './gm-screen.css'

type GMData = { scoring: ScoringState; totals: Record<string, number>; actor: string; serverNow: number; error?: string }
type ClearDraft = { gameId: string; revision: number }
type EntryDraft = { kind: 'add' | 'edit'; round: ScoreRound; room: ScoreRoom; factionId: string }
const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`
const roleLabel = (role: ScoreRole) => SCORE_ROLES.find(value => value.id === role)!.label
function preference(key: string, fallback: string) { try { return localStorage.getItem(key) || fallback } catch { return fallback } }
function timeLabel(at: number) { return new Date(at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }

export default function GameMasterScreen() {
  const shared = useSharedSession()
  const [data, setData] = useState<GMData | null>(null)
  const [name, setName] = useState(() => preference('makrab:gm-name', ''))
  const [pin, setPin] = useState('')
  const [pinHint, setPinHint] = useState<string | null>(null)
  const [showPin, setShowPin] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const authEpoch = useRef(0)
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(Boolean(shared))
  const [message, setMessage] = useState('')
  const [room, setRoom] = useState<ScoreRoom>(() => preference('makrab:gm-room', 'a') === 'b' ? 'b' : 'a')
  const [draft, setDraft] = useState<EntryDraft | null>(null)
  const nextRound = data ? nextScoreRound(data.scoring) : 1
  const round = draft?.round ?? nextRound ?? 3
  const entryRoom = draft?.room ?? room
  const factionId = draft?.factionId ?? null
  const [role, setRole] = useState<ScoreRole | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [clearDraft, setClearDraft] = useState<ClearDraft | null>(null)
  const entryDialog = useRef<HTMLDialogElement>(null)
  const clearDialog = useRef<HTMLDialogElement>(null)
  const expectedEntry = useRef<number | null>(null)
  const expectedClear = useRef(0)
  const previousGame = useRef(shared?.snapshot?.state.gameId)
  const previousClear = useRef<number | undefined>(undefined)
  const liveGameId = useRef(shared?.snapshot?.state.gameId)
  liveGameId.current = shared?.snapshot?.state.gameId
  const entry = factionId ? data?.scoring.entries.find(value => value.key === scoreKey(round, entryRoom, factionId)) : undefined
  const faction = factions.find(value => value.id === factionId)
  const unavailable = busy || !connected || shared?.connection !== 'connected' || data?.scoring.gameId !== shared?.snapshot?.state.gameId

  function closeEntry() { setDraft(null); setRole(null); setDeleting(false) }
  function chooseFaction(id: string) {
    if (!nextRound) return
    setRole(null); setDeleting(false); setMessage(''); setDraft({ kind: 'add', round: nextRound, room, factionId: id })
    expectedClear.current = data?.scoring.lastCleared?.revision ?? 0
  }
  function editEntry(saved: ScoreEntry) {
    setRole(null); setDeleting(false); setMessage(''); setDraft({ kind: 'edit', round: saved.round, room: saved.room, factionId: saved.factionId })
    expectedClear.current = data?.scoring.lastCleared?.revision ?? 0
  }
  function chooseRoom(value: ScoreRoom) {
    setRoom(value); setMessage('')
    try { localStorage.setItem('makrab:gm-room', value) } catch { /* Optional preference. */ }
  }
  useEffect(() => {
    const dialog = entryDialog.current
    if (factionId && data && !dialog?.open) dialog?.showModal()
    if ((!factionId || !data) && dialog?.open) dialog.close()
  }, [factionId, Boolean(data)])
  useEffect(() => {
    const dialog = clearDialog.current
    if (clearDraft && data && !dialog?.open) dialog?.showModal()
    if ((!clearDraft || !data) && dialog?.open) dialog.close()
  }, [clearDraft, Boolean(data)])
  useEffect(() => {
    const id = shared?.snapshot?.state.gameId
    if (id && id !== previousGame.current) {
      closeEntry(); setClearDraft(null)
      if (previousGame.current) setMessage('Permainan baru dimulai. Semua catatan sudah kosong.')
    }
    previousGame.current = id
  }, [shared?.snapshot?.state.gameId])
  useEffect(() => {
    const revision = data?.scoring.lastCleared?.revision ?? 0
    if (previousClear.current !== undefined && revision !== previousClear.current) {
      closeEntry(); setClearDraft(null)
      if (data?.scoring.lastCleared) setMessage(`Semua catatan dibersihkan oleh ${data.scoring.lastCleared.actor}. Timer dan undian tetap berjalan.`)
    }
    previousClear.current = data ? revision : undefined
  }, [data?.scoring.gameId, data?.scoring.lastCleared?.revision, Boolean(data)])
  useEffect(() => {
    if (!shared) return
    let cancelled = false, inFlight = false
    const refresh = async () => {
      if (inFlight) return
      inFlight = true
      const epoch = authEpoch.current
      try {
        const response = await fetch('/api/gm/session', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        const incoming = await response.json()
        if (cancelled || epoch !== authEpoch.current) return
        if (response.status === 401) { setData(null); setConnected(true); return }
        if (!response.ok) throw new Error()
        if (liveGameId.current && incoming.scoring.gameId !== liveGameId.current) return
        setData(current => current && current.scoring.gameId === incoming.scoring.gameId && current.scoring.revision > incoming.scoring.revision ? current : incoming)
        setConnected(true)
      } catch { if (!cancelled && epoch === authEpoch.current) setConnected(false) }
      finally { inFlight = false; if (!cancelled) setChecking(false) }
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 2000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [Boolean(shared)])
  useEffect(() => {
    setPinHint(null); setShowPin(false)
    if (!shared || data) return
    let cancelled = false
    void fetch('/api/gm/login-info', { cache: 'no-store', signal: AbortSignal.timeout(3500) })
      .then(async response => {
        if (!response.ok) return
        const info = await response.json()
        if (!cancelled && typeof info.pinHint === 'string' && /^\d{4,12}$/.test(info.pinHint)) setPinHint(info.pinHint)
      }).catch(() => { /* Login remains available without a local PIN hint. */ })
    return () => { cancelled = true }
  }, [Boolean(shared), Boolean(data)])

  async function login(event: FormEvent) {
    event.preventDefault()
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/gm/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, name }), signal: AbortSignal.timeout(12_000) })
      const incoming = await response.json()
      if (!response.ok) { setMessage(incoming.error || 'GM belum berhasil masuk.'); return }
      authEpoch.current++
      setData(incoming); setPin(''); setConnected(true)
      window.dispatchEvent(new Event('makrab:gm-auth'))
      try { localStorage.setItem('makrab:gm-name', incoming.actor) } catch { /* Optional preference. */ }
    } catch { setConnected(false); setMessage('Server belum tersambung. Coba lagi setelah koneksi pulih.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  async function send(command: ScoringCommand, gameId = data?.scoring.gameId) {
    if (!data || unavailable || busyRef.current) return
    busyRef.current = true; setBusy(true); setMessage('')
    const commandId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      const response = await fetch('/api/gm/command', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId, gameId, command }), signal: AbortSignal.timeout(12_000) })
      const incoming: GMData = await response.json()
      if (response.status === 401) { setData(null); window.dispatchEvent(new Event('makrab:gm-auth')); setMessage(incoming.error || 'Masuk kembali dengan PIN GM.'); return }
      if (incoming.scoring && (!liveGameId.current || incoming.scoring.gameId === liveGameId.current)) {
        setData(current => current && current.scoring.gameId === incoming.scoring.gameId && current.scoring.revision > incoming.scoring.revision ? current : incoming)
      }
      if (!response.ok) {
        setMessage(incoming.error || 'Hasil belum disimpan.')
        if (response.status === 409) { setRole(null); setDeleting(false); setClearDraft(null); if (draft?.kind === 'add') closeEntry() }
        return
      }
      closeEntry(); setClearDraft(null)
      setMessage(command.type === 'scoresEnable' ? command.enabled ? 'Pencatatan aktif. Pilih faction untuk mulai.' : 'Pencatatan dinonaktifkan. Catatan tetap tersimpan.'
        : command.type === 'scoresClear' ? 'Semua catatan dan poin sudah kosong. Timer dan undian tetap berjalan.'
        : command.type === 'scoreDelete' ? `${factions.find(value => value.id === command.factionId)!.name}: catatan dihapus.`
        : `${factions.find(value => value.id === command.factionId)!.name}: ${roleLabel(command.role)} ${signed(ROLE_POINTS[command.role])} poin tersimpan.`)
    } catch { setConnected(false); setMessage('Koneksi terputus. Periksa catatan terbaru sebelum mencoba lagi.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  async function logout() {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true)
    try {
      const response = await fetch('/api/gm/logout', { method: 'POST', signal: AbortSignal.timeout(12_000) })
      if (!response.ok && response.status !== 401) throw new Error()
      authEpoch.current++; setData(null); closeEntry(); setClearDraft(null); setMessage('')
      window.dispatchEvent(new Event('makrab:gm-auth'))
    } catch { setMessage('Logout belum berhasil. Coba lagi setelah tersambung.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  const gameHref = shared?.snapshot?.state.active ? '#/game' : '#/'
  const currentPhase = GAME_PHASES[shared?.snapshot?.state.rundown.phaseIndex ?? 0]
  const progress = data ? roundProgress(data.scoring, nextRound ?? 3) : { a: 0, b: 0 }
  const blockedAdd = draft?.kind === 'add' && (Boolean(entry) || nextRound !== draft.round)
  const hasRecords = Boolean(data && (data.scoring.entries.length || data.scoring.history.length))

  return <main className="gm-screen">
    <div className="gm-shell">
      <header className="gm-header"><a href={gameHref} className="gm-back">← Kembali ke game</a><span className="gm-access-mark">GM ACCESS</span>{data && <button className="gm-text-button" disabled={busy} onClick={() => { void logout() }}>Keluar</button>}</header>
      {!shared ? <section className="gm-login"><h1>GM Access</h1><p>Hubungkan ke sesi bersama untuk mencatat hasil dan menampilkan ranking di kedua ruangan.</p><a className="gm-primary gm-open-shared" href={`http://${window.location.hostname || 'localhost'}:3000/#/gm`}>Buka sesi bersama <span aria-hidden="true">↗</span></a><p className="gm-login-note">Jalankan server game di laptop utama sebelum membuka sesi bersama.</p></section>
      : checking ? <section className="gm-login"><h1>GM Access</h1><p>Menghubungkan sesi GM…</p></section>
      : !data ? <section className="gm-login"><div className="gm-login-seal" aria-hidden="true">✦</div><p className="gm-eyebrow">PENGELOLA PERMAINAN</p><h1>GM Access</h1><p>Masuk untuk mencatat pemain yang dipilih saat Exchange.</p>
        <form onSubmit={event => { void login(event) }}>
          <label>Nama GM<input maxLength={40} autoComplete="nickname" value={name} placeholder="Nama kamu" onChange={event => setName(event.target.value)} /></label>
          <label>PIN GM<span className="gm-pin-field"><input required type={showPin ? 'text' : 'password'} inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,12}" placeholder={pinHint ? `PIN: ${pinHint}` : 'Masukkan PIN GM'} value={pin} onChange={event => setPin(event.target.value)} /><button className="gm-pin-toggle" type="button" aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'} aria-pressed={showPin} onClick={() => setShowPin(value => !value)}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" />{showPin && <path d="m4 3 16 18" />}</svg></button></span></label>
          <button className="gm-primary" disabled={busy || shared.connection !== 'connected'}>{busy ? 'Menghubungkan…' : 'Masuk GM'}</button>
        </form><p className="gm-login-note">{pinHint ? 'PIN sesi ini ditampilkan samar pada kolom di atas.' : 'PIN GM diberikan oleh operator permainan.'}</p>{message && <p className="gm-feedback" role="status">{message}</p>}
      </section>
      : <>
        <div className="gm-intro"><div><p className="gm-eyebrow">{data.actor}</p><h1>Tambah poin</h1><p>Pilih faction, pilih role, lalu simpan. Catatan dikelompokkan otomatis per 8.</p></div><p>{currentPhase.title}<span className={`gm-connection${connected && shared.connection === 'connected' ? ' is-connected' : ''}`}>{connected && shared.connection === 'connected' ? 'Tersambung' : 'Menyambungkan…'}</span></p></div>
        <details className="gm-summary"><summary>Lihat total poin <span>Gabungan kedua ruangan</span></summary><section className="gm-totals" aria-label="Total poin gabungan">{factions.map(value => <article key={value.id} style={{ '--gm-faction-color': value.color } as CSSProperties}><FactionEmblem faction={value} /><div><span>{value.name}</span><strong>{signed(data.totals[value.id])}<small>poin</small></strong></div></article>)}</section></details>
        <section className={`gm-mode${data.scoring.enabled ? ' is-active' : ''}`}><div><h2>{data.scoring.enabled ? 'Pencatatan aktif' : 'Mulai mencatat hasil'}</h2><p>{data.scoring.enabled ? 'Ranking otomatis setelah Exchange dan hasil kedua ruangan lengkap.' : 'Aktifkan pencatatan untuk memakai poin dan ranking otomatis.'}</p></div><button className={data.scoring.enabled ? 'gm-secondary' : 'gm-primary'} disabled={unavailable} onClick={() => { void send({ type: 'scoresEnable', enabled: !data.scoring.enabled }) }}>{data.scoring.enabled ? 'Nonaktifkan' : 'Aktifkan'}</button></section>
        {message && <p className="gm-feedback" role="status">{message}</p>}
        <section className="gm-clear-bar"><div><h2>Clear catatan</h2><p>{hasRecords ? 'Kosongkan semua hasil Exchange dan poin.' : 'Belum ada catatan untuk dihapus.'}</p></div><button className="gm-clear-button" disabled={unavailable || !hasRecords} onClick={() => { setMessage(''); setClearDraft({ gameId: data.scoring.gameId, revision: data.scoring.revision }) }}>Clear semua catatan</button></section>
        {data.scoring.enabled && <section className="gm-workspace">
          <fieldset className="gm-room-select"><legend>Ruangan kamu</legend><div>{(['a', 'b'] as const).map(value => <button key={value} disabled={unavailable} aria-pressed={room === value} onClick={() => chooseRoom(value)}>Ruangan {value === 'a' ? '1' : '2'}</button>)}</div></fieldset>
          <header className="gm-picker-heading"><h2>Faction mana yang memilih pemain?</h2><p>Tap faction itu untuk mencatat role pemain yang dipilihnya.</p></header>
          <div className="gm-faction-grid">{factions.map(value => {
            const saved = data.scoring.entries.find(item => item.key === scoreKey(nextRound ?? 3, room, value.id))
            return <button key={value.id} className={`gm-faction-card${saved ? ' is-recorded' : ''}`} data-faction={value.id} style={{ '--gm-faction-color': value.color } as CSSProperties} disabled={unavailable || !nextRound || Boolean(saved)} onClick={() => chooseFaction(value.id)}>
              <FactionEmblem faction={value} /><span className="gm-faction-content"><strong>{value.name}</strong><span>{saved ? `${roleLabel(saved.role)} · ${signed(ROLE_POINTS[saved.role])} poin` : 'Belum dicatat'}</span>{saved && <small>Oleh {saved.actor}</small>}</span><span className="gm-faction-action">{saved ? 'Tercatat ✓' : 'Tambah →'}</span>
            </button>
          })}</div>
          <div className="gm-round-progress"><div><strong>{nextRound ? `${progress.a + progress.b}/8 catatan pada kelompok ini` : 'Semua 24 catatan lengkap ✓'}</strong><span>Ruangan 1: {progress.a}/4 · Ruangan 2: {progress.b}/4</span></div><p>{!nextRound ? 'Buka catatan tersimpan jika perlu koreksi.' : progress[room] === 4 ? `Ruangan ${room === 'a' ? '1' : '2'} sudah lengkap. Menunggu catatan ruangan lainnya.` : 'Setelah 8 catatan lengkap, kelompok berikutnya terbuka otomatis.'}</p></div>
        </section>}
        <section className="gm-batches" aria-label="Catatan tersimpan per kelompok delapan"><header><h2>Catatan tersimpan</h2><p>Hijau = 8 catatan lengkap · Emas = sedang diisi.</p></header>{([1, 2, 3] as const).map(batch => {
          const counts = roundProgress(data.scoring, batch), count = counts.a + counts.b
          const complete = count === 8
          const state = complete ? 'complete' : count > 0 || nextRound === batch ? 'current' : 'empty'
          return <details key={batch} className={`gm-batch is-${state}`} data-round={batch} data-complete={complete}>
            <summary><span className="gm-batch-name">Catatan {(batch - 1) * 8 + 1}–{batch * 8}<small>Ruangan 1: {counts.a}/4 · Ruangan 2: {counts.b}/4</small><span className="gm-batch-dots" aria-hidden="true">{(['a', 'b'] as const).flatMap(batchRoom => factions.map(value => <span key={`${batchRoom}:${value.id}`} className={data.scoring.entries.some(saved => saved.key === scoreKey(batch, batchRoom, value.id)) ? 'is-filled' : ''} />))}</span></span><span className="gm-batch-status"><strong>{count}/8</strong><span>{complete ? 'Lengkap ✓' : count ? 'Belum lengkap' : nextRound === batch ? 'Siap diisi' : 'Belum ada'}</span></span><span className="gm-batch-expand" aria-hidden="true">+</span></summary>
            <div className="gm-batch-records">{(['a', 'b'] as const).map(batchRoom => <div key={batchRoom}><h3>Ruangan {batchRoom === 'a' ? '1' : '2'}</h3>{factions.map(value => {
              const saved = data.scoring.entries.find(item => item.key === scoreKey(batch, batchRoom, value.id))
              return saved ? <button key={value.id} className="gm-saved-entry" data-score-key={saved.key} disabled={unavailable || !data.scoring.enabled || Boolean(blockedAdd)} onClick={() => editEntry(saved)}><span><strong>{value.name}</strong><small>{roleLabel(saved.role)} · {signed(ROLE_POINTS[saved.role])} poin · {saved.actor}</small></span><span>Ubah →</span></button> : <div key={value.id} className="gm-empty-entry"><span>{value.name}</span><small>Belum dicatat</small></div>
            })}</div>)}</div>
          </details>
        })}</section>
        <details className="gm-history"><summary>Riwayat input & koreksi <span>{data.scoring.history.length} catatan</span></summary>{data.scoring.history.length ? <ol>{[...data.scoring.history].reverse().slice(0, 40).map(event => <li key={event.id}><div><strong>{factions.find(value => value.id === event.factionId)?.name}</strong><span>Exchange {event.round} · Ruangan {event.room === 'a' ? '1' : '2'} · {event.actor} · {timeLabel(event.at)}</span></div><p>{event.before ? `${roleLabel(event.before)} ${signed(ROLE_POINTS[event.before])} → ` : ''}{event.after ? `${roleLabel(event.after)} ${signed(ROLE_POINTS[event.after])}` : 'Dihapus'}</p></li>)}</ol> : <p>{data.scoring.lastCleared ? `Catatan dibersihkan oleh ${data.scoring.lastCleared.actor} · ${timeLabel(data.scoring.lastCleared.at)}.` : 'Belum ada hasil yang dicatat.'}</p>}</details>
      </>}
    </div>
    <dialog ref={entryDialog} className="gm-dialog" onCancel={event => { if (busyRef.current) event.preventDefault(); else closeEntry() }} onClose={closeEntry} onClick={event => { if (event.target === event.currentTarget && !busyRef.current) closeEntry() }} aria-labelledby="gm-entry-title">
      {faction && data && <div className="gm-dialog-card">
        <header className="gm-dialog-heading"><div><p className="gm-eyebrow">Catatan {(round - 1) * 8 + 1}–{round * 8} · Ruangan {entryRoom === 'a' ? '1' : '2'}</p><h2 id="gm-entry-title">{faction.name}</h2></div><button className="gm-dialog-close" disabled={busy} onClick={closeEntry} aria-label="Tutup catatan">×</button></header>
        {deleting ? <div className="gm-preview"><h3>Hapus catatan faction ini?</h3><p>Hasil {faction.name} di kelompok catatan {(round - 1) * 8 + 1}–{round * 8}, Ruangan {entryRoom === 'a' ? '1' : '2'} akan dihapus. Total poin otomatis diperbarui.</p><footer><button className="gm-secondary" disabled={busy} onClick={() => setDeleting(false)}>Batal</button><button className="gm-primary gm-danger" disabled={unavailable} onClick={() => { void send({ type: 'scoreDelete', round, room: entryRoom, factionId: faction.id, expectedEntryRevision: expectedEntry.current!, expectedClearRevision: expectedClear.current }) }}>Hapus catatan</button></footer></div>
          : <><h3 className="gm-role-question">Role pemain yang dipilih?</h3><p className="gm-role-help">Catat role pemain yang dipilih oleh <strong>{faction.name}</strong>.</p>{draft?.kind === 'edit' && entry && <p className="gm-existing">Sebelumnya: {roleLabel(entry.role)} · {signed(ROLE_POINTS[entry.role])} poin. Oleh {entry.actor}.</p>}
            <div className="gm-role-grid">{SCORE_ROLES.map(value => <button key={value.id} className={role === value.id ? 'is-selected' : ''} aria-pressed={role === value.id} disabled={unavailable || !data.scoring.enabled || Boolean(blockedAdd)} onClick={() => { expectedEntry.current = entry?.revision ?? null; expectedClear.current = data.scoring.lastCleared?.revision ?? 0; setRole(value.id); setMessage('') }}><span>{value.label}</span><strong>{signed(value.points)} <small>poin</small></strong>{role === value.id && <span className="gm-role-check" aria-hidden="true">✓</span>}</button>)}</div>
            {role && <div className="gm-preview" role="region" aria-label="Periksa hasil"><p>{faction.name} mendapat <strong>{roleLabel(role)}</strong> · <b>{signed(ROLE_POINTS[role])}</b> poin.</p>{draft?.kind === 'edit' && entry && <small>Hasil sebelumnya diganti dengan pilihan ini.</small>}<footer><button className="gm-primary" disabled={unavailable || !data.scoring.enabled || Boolean(blockedAdd)} onClick={() => { void send(draft?.kind === 'add' ? { type: 'scoreAdd', expectedRound: draft.round, room: entryRoom, factionId: faction.id, role, expectedClearRevision: expectedClear.current } : { type: 'scoreSet', round, room: entryRoom, factionId: faction.id, role, expectedEntryRevision: expectedEntry.current, expectedClearRevision: expectedClear.current }) }}>{busy ? 'Menyimpan…' : 'Simpan hasil'}</button></footer></div>}
            {blockedAdd && <p className="gm-feedback" role="status">Catatan ini sudah diperbarui. Tutup lalu pilih kembali faction.</p>}
            {!role && <p className="gm-pick-hint">Pilih salah satu role untuk menyimpan hasil.</p>}
            {draft?.kind === 'edit' && entry && <button className="gm-delete-entry" disabled={unavailable || !data.scoring.enabled || Boolean(blockedAdd)} onClick={() => { expectedEntry.current = entry.revision; expectedClear.current = data.scoring.lastCleared?.revision ?? 0; setRole(null); setDeleting(true); setMessage('') }}>Hapus catatan ini</button>}
            <p className="gm-entry-note">Gambler dan Leader tidak bisa dipilih pada Exchange biasa.</p>
          </>}
        {message && <p className="gm-feedback" role="status">{message}</p>}
      </div>}
    </dialog>
    <dialog ref={clearDialog} className="gm-dialog gm-dialog--clear" onCancel={event => { if (busyRef.current) event.preventDefault(); else setClearDraft(null) }} onClose={() => setClearDraft(null)} onClick={event => { if (event.target === event.currentTarget && !busyRef.current) setClearDraft(null) }} aria-labelledby="gm-clear-title">
      {clearDraft && data && <div className="gm-dialog-card"><p className="gm-eyebrow">KOSONGKAN CATATAN</p><h2 id="gm-clear-title">Clear semua catatan?</h2><p>Semua hasil Exchange 1–3, poin kedua ruangan, dan riwayat input akan dikosongkan.</p><p className="gm-clear-keeps">Timer, fase, dan undian tetap berjalan.</p>{message && <p className="gm-feedback" role="status">{message}</p>}<footer className="gm-clear-actions"><button className="gm-secondary" disabled={busy} autoFocus onClick={() => setClearDraft(null)}>Batal</button><button className="gm-primary gm-danger" disabled={unavailable} onClick={() => { void send({ type: 'scoresClear', expectedRevision: clearDraft.revision }, clearDraft.gameId) }}>{busy ? 'Menghapus…' : 'Ya, clear semua'}</button></footer></div>}
    </dialog>
  </main>
}
