import { useRef } from 'react'
import type { CSSProperties } from 'react'
import { factions } from '../data/game'
import { EXCHANGE_REVEAL_ORDER } from '../lib/exchangePresentation'
import useRouletteMotion from '../hooks/useRouletteMotion'
import FactionEmblem from './FactionEmblem'
import type { PresentationTimeline } from '../lib/presentationTimeline'

type Props = {
  round: number
  settled: readonly boolean[]
  stopped: boolean
  willStart: boolean
  onStop: () => void
  timeline?: PresentationTimeline
}

export default function RouletteDisplay({ round, settled, stopped, willStart, onStop, timeline }: Props) {
  const ticksRef = useRef<HTMLDivElement>(null)
  useRouletteMotion(ticksRef, onStop, 0, 'ring', timeline)
  const chosen = settled.filter(Boolean).length
  return <>
    <div className="timer-heading roulette-heading">
      <p className="timer-phase-badge roulette-stage-badge"><span aria-hidden="true" />FACTION ROULETTE</p>
      <h1 id="active-phase-title" className="timer-title">Undian Exchange {round}</h1>
    </div>
    <div className="timer-clock-space">
      <div className={`roulette-console${chosen === 4 ? ' is-complete' : ''}`} data-roulette-state={stopped ? 'stopped' : 'spinning'}>
        <div ref={ticksRef} className="roulette-bezel-ticks"><svg viewBox="0 0 320 320" aria-hidden="true">
          <circle cx="160" cy="160" r="152" />
          <circle cx="160" cy="160" r="137" className="roulette-inner-ring" />
          {Array.from({ length: 48 }, (_, index) => <path key={index} d={`M160 ${index % 6 === 0 ? 12 : 16}v${index % 6 === 0 ? 12 : 6}`} transform={`rotate(${index * 7.5} 160 160)`} />)}
        </svg></div>
        <svg className="roulette-cardinal-marks" viewBox="0 0 320 320" aria-hidden="true">{[0, 90, 180, 270].map(angle => <path key={angle} d="m160 39 5 7-5 7-5-7 5-7Z" transform={`rotate(${angle} 160 160)`} />)}</svg>
        <div className="roulette-round"><small>EXCHANGE</small><strong>{round}</strong><span>{chosen}/4 TERPILIH</span></div>
        {EXCHANGE_REVEAL_ORDER.map(index => <div key={index} className={`roulette-faction-marker roulette-faction-marker--${index}${settled[index] ? ' is-confirmed' : ''}`} style={{ '--faction-color': factions[index].color } as CSSProperties}>
          <FactionEmblem faction={factions[index]} /><span className="roulette-faction-seal">{settled[index] ? '✓' : factions[index].chineseName}</span>
        </div>)}
      </div>
    </div>
    <div className="timer-operator-controls roulette-draw-controls">
      <div className="roulette-draw-progress" aria-label={`${chosen} dari 4 target terpilih`}>
        {EXCHANGE_REVEAL_ORDER.map(index => <span key={index} className={settled[index] ? 'is-confirmed' : ''} title={factions[index].name} aria-hidden="true" />)}
      </div>
      <p className="timer-state">{chosen === 4 ? 'Semua target terpilih' : 'Menentukan target faction'}</p>
      <p className="roulette-timer-note">{willStart ? 'Timer dimulai setelah undian' : 'Timer siap setelah undian'}</p>
    </div>
  </>
}
