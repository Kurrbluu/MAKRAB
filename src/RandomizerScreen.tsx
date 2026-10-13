import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import BackgroundDecoration from './components/BackgroundDecoration'
import FactionEmblem from './components/FactionEmblem'
import FactionFrame from './components/FactionFrame'
import TargetCard from './components/TargetCard'
import CardDrawAnimation from './components/CardDrawAnimation'
import PhaseCueSettings from './components/PhaseCueSettings'
import SoundActivation from './components/SoundActivation'
import useGameSound from './hooks/useGameSound'
import useRandomizerSound from './hooks/useRandomizerSound'
import useTargetReveal from './hooks/useTargetReveal'
import { unlockPhaseCueAudio } from './lib/phaseCueAudio'
import { cardTiming, measureDrawLayout } from './lib/cardMotion'
import type { DrawLayout } from './lib/cardMotion'
import { factions, gameName } from './data/game'
import { exchangeNumbers } from './data/gamePhases'
import {
  confirmRound, drawTargets, emptySession,
  randomizerStorageKey, restoreSession, setRoundTargets,
} from './lib/randomizer'
import type { RandomizerSession, RoundNumber } from './lib/randomizer'
import './randomizer.css'

const factionIds = factions.map((faction) => faction.id)
const factionById = new Map(factions.map((faction) => [faction.id, faction]))
type DrawPhase = 'gather' | 'shuffle' | 'deal' | 'reveal'
type ShuffleFrame = { targets: string[]; phase: DrawPhase; stopped: boolean }

function loadSession(): RandomizerSession {
  try {
    return restoreSession(localStorage.getItem(randomizerStorageKey), factionIds)
  } catch {
    return emptySession()
  }
}

export default function RandomizerScreen({ onOpenGuide }: { onOpenGuide: () => void }) {
  const [session, setSession] = useState(loadSession)
  const [shuffle, setShuffle] = useState<ShuffleFrame | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [storageError, setStorageError] = useState('')
  const [actionError, setActionError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyFallback, setCopyFallback] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const resetDialogRef = useRef<HTMLDialogElement>(null)
  const shufflingRef = useRef(false)
  const [animationKey, setAnimationKey] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const targetSlotRefs = useRef<(HTMLDivElement | null)[]>([])
  const [drawLayout, setDrawLayout] = useState<DrawLayout | null>(null)
  const round = session.activeRound
  const result = session.rounds[round]
  const isShuffling = shuffle !== null
  const { settings: cueSettings, status: audioStatus, changeSettings: changeCueSettings } = useGameSound()
  const [cueSettingsOpen, setCueSettingsOpen] = useState(false)
  const revealSound = useRandomizerSound({ active: isShuffling, stopped: shuffle?.stopped ?? false, animationKey,
    settings: cueSettings, status: audioStatus, launchDelayMs: 0, spinDurationMs: cardTiming.revealStart + cardTiming.revealDuration })
  const revealedTargets = useTargetReveal({ active: isShuffling, stopped: shuffle?.stopped ?? false,
    targets: shuffle?.targets, onFinish: () => { if (shuffle) finishShuffle(shuffle.targets) }, onProgress: revealSound })

  useLayoutEffect(() => {
    if (!shuffle || !stageRef.current) { setDrawLayout(null); return }
    const layout = measureDrawLayout(stageRef.current, targetSlotRefs.current)
    if (!layout) { setShuffle(current => current && { ...current, stopped: true }); return }
    setDrawLayout(layout)
    const phaseAt = (phase: DrawPhase, delay: number) => window.setTimeout(() => setShuffle(current => current && !current.stopped ? { ...current, phase } : current), delay)
    const timers = [phaseAt('shuffle', cardTiming.shuffleStart), phaseAt('deal', cardTiming.dealStart), phaseAt('reveal', cardTiming.revealStart),
      window.setTimeout(() => setShuffle(current => current && { ...current, stopped: true }), cardTiming.revealStart + cardTiming.revealDuration)]
    return () => timers.forEach(window.clearTimeout)
  }, [shuffle?.targets, animationKey])

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  function commit(next: RandomizerSession) {
    setSession(next)
    try {
      localStorage.setItem(randomizerStorageKey, JSON.stringify(next))
      setStorageError('')
    } catch {
      setStorageError('Browser tidak dapat menyimpan hasil. Catat atau salin hasil sebelum menutup halaman ini.')
    }
  }

  function finishShuffle(targets: string[]) {
    shufflingRef.current = false
    setShuffle(null)
    setAnnouncement(`Hasil Exchange ${round}: ${factions.map((faction, index) => `${faction.name} memilih dari ${factionById.get(targets[index])!.name}`).join('. ')}.`)
  }

  function playDraw(targets: string[]) {
    if (shufflingRef.current) return
    void unlockPhaseCueAudio()
    shufflingRef.current = true
    setAnimationKey(key => key + 1)
    setAnnouncement(`Mengacak kartu untuk Exchange ${round}.`)
    setShuffle({ targets, phase: 'gather', stopped: false })
  }

  function startShuffle() {
    if (shufflingRef.current || result?.confirmed) return
    setActionError('')
    setCopied(false)
    setCopyFallback('')
    let targets: string[]
    try {
      targets = drawTargets(factionIds)
    } catch {
      setActionError('Target belum berhasil diacak. Silakan coba lagi.')
      return
    }
    // Persist the actual draw before its visual presentation.
    commit(setRoundTargets(session, round, targets, factionIds))
    playDraw(targets)
  }

  function selectRound(nextRound: RoundNumber) {
    if (shufflingRef.current) return
    commit({ ...session, activeRound: nextRound })
    setCopied(false)
    setCopyFallback('')
    setActionError('')
    setAnnouncement(`Exchange ${nextRound}.`)
  }

  function useResult() {
    if (shufflingRef.current || !result) return
    commit(confirmRound(session, round))
    setAnnouncement(`Target Exchange ${round} ditetapkan. Sampaikan hasil ke kedua ruangan untuk pilihan Leader.`)
  }

  async function copyResult() {
    if (!result) return
    const text = [
      `${gameName.toUpperCase()} — Exchange ${round}`,
      'Faction pemilih → Faction target',
      ...factions.map((faction, index) => `${faction.name} → ${factionById.get(result.targets[index])!.name}`),
      '',
      'Berlaku di kedua ruangan. Pilih pemain dari faction target di ruangan yang sama.',
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setAnnouncement('Hasil undian disalin.')
    } catch {
      setCopyFallback(text)
      setAnnouncement('Pilih dan salin teks hasil undian yang ditampilkan.')
    }
  }

  function resetDraws() {
    shufflingRef.current = false
    commit(emptySession())
    setShuffle(null)
    setCopied(false)
    setCopyFallback('')
    setActionError('')
    setAnnouncement('Undian kelima Exchange direset. Exchange 1 siap diacak.')
    resetDialogRef.current?.close()
    headingRef.current?.focus({ preventScroll: true })
  }

  const status = isShuffling ? shuffle?.stopped ? 'Hasil terpilih' : 'Mengacak target' : result?.confirmed ? 'Target ditetapkan' : result ? 'Hasil undian' : 'Siap diacak'

  return (
    <main className="home randomizer-screen" aria-labelledby="randomizer-title">
      <BackgroundDecoration />
      <div className="randomizer-shell">
        <nav className="randomizer-nav" aria-label="Navigasi game">
          <div className="randomizer-nav-links">
            <a href="#/game" className="text-button"><span aria-hidden="true">←</span> Timer</a>
            <a href="#/" className="text-button">Beranda</a>
          </div>
          <span className="randomizer-wordmark">{gameName}</span>
          <div className="randomizer-sound-controls">
            <SoundActivation settings={cueSettings} status={audioStatus} onOpenSettings={() => setCueSettingsOpen(true)} />
            <button className="text-button" aria-label="Pengaturan sound cue" onClick={() => setCueSettingsOpen(true)}>Suara</button>
          </div>
          <button className="text-button" onClick={onOpenGuide} disabled={isShuffling}>Panduan</button>
        </nav>

        <header className="randomizer-heading">
          <p className="game-title-kicker">UNDIAN FACTION</p>
          <h1 id="randomizer-title" ref={headingRef} tabIndex={-1}>Randomizer<span className="title-period">.</span></h1>
          <p>Empat faction. Satu target untuk masing-masing.</p>
        </header>

        <div className="randomizer-toolbar">
          <div className="round-selector" role="group" aria-label="Pilih Exchange">
            {exchangeNumbers.map((number) => (
              <button key={number} aria-pressed={round === number} disabled={isShuffling} onClick={() => selectRound(number)}>
                Exchange {number}
                {session.rounds[number]?.confirmed && <span className="round-complete" aria-label="target sudah ditetapkan">✓</span>}
              </button>
            ))}
          </div>
          <span className={`draw-status${isShuffling ? ' draw-status--active' : ''}${result?.confirmed ? ' draw-status--confirmed' : ''}`}>
            <span aria-hidden="true" />{status}
          </span>
        </div>

        <div ref={stageRef} className={`draw-stage${isShuffling ? ' draw-stage--animating' : ''}`}>
        <section className="draw-grid" aria-label={`Faction pemilih dan target Exchange ${round}`} aria-busy={isShuffling}>
          {factions.map((faction, index) => {
            const targetId = (shuffle?.targets ?? result?.targets)?.[index]
            const target = targetId ? factionById.get(targetId) : undefined
            const revealed = Boolean(result) && (!shuffle || revealedTargets[index])
            return (
              <article
                key={faction.id}
                className={`draw-card${revealed ? ' draw-card--revealed' : ''}${isShuffling && !revealed ? ' draw-card--shuffling' : ''}`}
                style={{ '--source-color': faction.color, '--source-box-color': faction.boxColor, '--target-color': target?.color ?? '#c9ad77' } as CSSProperties}
              >
                <FactionFrame />
                <span className="draw-card-label">FACTION PEMILIH</span>
                <div className="draw-source">
                  <FactionEmblem faction={faction} />
                  <h2>{faction.name}</h2>
                </div>
                <div className="draw-direction" aria-hidden="true"><span />↓<span /></div>
                <span className="draw-card-label">MEMILIH DARI</span>
                <div className="draw-target" aria-hidden={isShuffling || undefined}>
                  <div ref={element => { targetSlotRefs.current[index] = element }} className={`target-slot${isShuffling && !revealed ? ' target-slot--waiting' : ''}`}>
                    {target && revealed ? <TargetCard faction={target} /> : (
                      <div className={`target-empty${isShuffling ? ' target-empty--dealing' : ''}`}>
                        <span aria-hidden="true">?</span>
                        <h3>{isShuffling ? 'Menunggu hasil' : 'Belum diundi'}</h3>
                      </div>
                    )}
                  </div>
                </div>
                <div className="draw-card-footnote">
                  {revealed ? <><span className="target-check" aria-hidden="true">✓</span> Faction target</> : isShuffling ? 'Menentukan target…' : 'Menunggu pengacakan'}
                </div>
              </article>
            )
          })}
        </section>
        {shuffle && drawLayout && <CardDrawAnimation key={animationKey} layout={drawLayout} targets={shuffle.targets} phase={shuffle.phase} revealed={revealedTargets.filter(Boolean).length}
          onFinish={() => setShuffle(current => current && { ...current, stopped: true })} />}
        </div>

        <div className="randomizer-controls">
          <div className="randomizer-actions">
            {isShuffling ? (
              <>
                <button className="button button-primary" disabled><span className="shuffle-glyph is-spinning" aria-hidden="true">↻</span> Mengacak target…</button>
              </>
            ) : !result ? (
              <button className="button button-primary" onClick={startShuffle}><span className="shuffle-glyph" aria-hidden="true">↻</span> Acak Target</button>
            ) : !result.confirmed ? (
              <>
                <button className="button button-primary" onClick={useResult}>Gunakan hasil <span aria-hidden="true">→</span></button>
                <button className="button button-secondary" onClick={startShuffle}><span className="shuffle-glyph" aria-hidden="true">↻</span> Acak ulang</button>
              </>
            ) : (
              <>
                <button className="button button-primary" onClick={copyResult}>{copied ? '✓ Hasil tersalin' : 'Salin hasil'}</button>
                <button className="button button-secondary" onClick={() => selectRound((round === 5 ? 1 : round + 1) as RoundNumber)}>Lihat Exchange {round === 5 ? 1 : round + 1} <span aria-hidden="true">→</span></button>
              </>
            )}
          </div>
          <p className="draw-hint">
            {shuffle ? shuffle.stopped ? `Hasil terpilih · ${revealedTargets.filter(Boolean).length}/4` : 'Mengacak target…'
              : result?.confirmed ? 'Sampaikan hasil ke kedua ruangan. Leader memilih pemain dari tim target.'
              : result ? 'Gunakan hasil untuk menetapkan target Exchange ini.'
              : 'Tidak ada target diri sendiri. Setiap faction ditargetkan tepat satu kali.'}
          </p>
          {result?.confirmed && !isShuffling && <p className="voting-note">Leader memilih 1 pemain dari faction target di ruangannya. Leader tidak dapat dipindahkan.</p>}
          {storageError && <p className="randomizer-error" role="alert">{storageError}</p>}
          {actionError && <p className="randomizer-error" role="alert">{actionError}</p>}
          {copyFallback && (
            <div className="copy-fallback">
              <label htmlFor="copy-results">Pilih dan salin hasil berikut:</label>
              <textarea id="copy-results" readOnly value={copyFallback} onFocus={(event) => event.currentTarget.select()} />
            </div>
          )}
          {Object.keys(session.rounds).length > 0 && !isShuffling && (
            <div className="draw-extra-actions">
              {result && <button className="text-button replay-draw" onClick={() => playDraw(result.targets)}><span aria-hidden="true">↻</span> Ulangi animasi</button>}
              <button className="text-button reset-draw" onClick={() => resetDialogRef.current?.showModal()}>Undian baru</button>
            </div>
          )}
        </div>
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </div>
      <PhaseCueSettings open={cueSettingsOpen} settings={cueSettings} onChange={changeCueSettings} onClose={() => setCueSettingsOpen(false)} />

      <dialog ref={resetDialogRef} className="dialog reset-dialog" aria-labelledby="reset-title" onClick={(event) => {
        if (event.target === event.currentTarget) resetDialogRef.current?.close()
      }}>
        <div className="dialog-card">
          <header className="dialog-header"><h2 id="reset-title">Mulai undian baru?</h2></header>
          <p className="dialog-description">Hasil target Exchange 1–5 akan dihapus. Pengacakan dimulai kembali dari Exchange 1.</p>
          <div className="reset-dialog-actions">
            <button className="button button-secondary" onClick={() => resetDialogRef.current?.close()} autoFocus>Batal</button>
            <button className="button button-primary" onClick={resetDraws}>Reset kelima Exchange</button>
          </div>
        </div>
      </dialog>
    </main>
  )
}
