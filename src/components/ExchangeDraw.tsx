import type { CSSProperties } from 'react'
import { factions } from '../data/game'
import type { ExchangeNumber } from '../data/gamePhases'
import useTargetReveal from '../hooks/useTargetReveal'
import { EXCHANGE_PRESENTATION, EXCHANGE_REVEAL_ORDER } from '../lib/exchangePresentation'
import FactionEmblem from './FactionEmblem'
import FactionFrame from './FactionFrame'
import TargetCard from './TargetCard'
import FactionReel from './FactionReel'
import '../randomizer.css'
import './exchange-draw.css'
import type { PresentationTimeline } from '../lib/presentationTimeline'

type Props = {
  round: ExchangeNumber
  targets?: readonly string[]
  animate: boolean
  rouletteStopped: boolean
  error?: string
  onFinish: () => void
  onRetry: () => void
  onReplay?: () => void
  onProgress?: (settled: boolean[]) => void
  timeline?: PresentationTimeline
  disabled?: boolean
}

export default function ExchangeDraw({ round, targets, animate, rouletteStopped, error, onFinish, onRetry, onReplay, onProgress, timeline, disabled }: Props) {
  const progress = useTargetReveal({ active: animate, stopped: rouletteStopped, targets, onFinish, onProgress, timeline })
  const shuffling = animate && Boolean(targets)
  const settledCount = progress.filter(Boolean).length
  const status = error ? 'Undian belum selesai' : shuffling ? settledCount ? `Menetapkan hasil · ${settledCount}/4` : 'Mengacak faction…' : targets ? 'Target ditetapkan' : 'Menyiapkan undian…'

  return <section className={`inline-exchange${shuffling ? ' is-shuffling' : ''}`} aria-labelledby="inline-exchange-title" aria-busy={shuffling}>
    <header className="inline-exchange-heading">
      <h2 id="inline-exchange-title"><svg className="exchange-title-ornament" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" /><circle cx="12" cy="12" r="2" /></svg>TARGET EXCHANGE {round}</h2>
      <div className="inline-exchange-status">
        <span role="status">{status}</span>
        {onReplay && <button className="roulette-replay" onClick={onReplay} disabled={shuffling || disabled} aria-label="Ulangi animasi target" title="Ulangi animasi dengan hasil yang sama"><span aria-hidden="true">↻</span> Ulangi animasi</button>}
      </div>
    </header>
    <div className="inline-exchange-stage">
      <div className="inline-exchange-grid">
        {factions.map((source, index) => {
          const revealRank = EXCHANGE_REVEAL_ORDER.findIndex(position => position === index)
          const target = factions.find(faction => faction.id === targets?.[index])
          const revealed = Boolean(target) && (!shuffling || Boolean(progress[index]))
          return <article key={source.id} className={`inline-exchange-pair${revealed ? ' is-revealed' : ''}`} style={{ '--source-color': source.color, '--source-box-color': source.boxColor, '--target-color': target?.color ?? '#c9ad77' } as CSSProperties} aria-label={`${source.name} → ${revealed ? target!.name : 'menunggu target'}`}>
            <FactionFrame faction={source.id} />
            <div className="inline-exchange-source"><FactionEmblem faction={source} /><div className="inline-exchange-source-copy"><span>FACTION PEMILIH</span><h3>{source.name}</h3></div></div>
            <div className="inline-exchange-direction"><span>MEMILIH DARI</span><span className="inline-exchange-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3v17m-6-6 6 6 6-6" /></svg></span></div>
            <div className={`target-slot inline-exchange-target${revealed ? ' is-settled' : ''}`}>
              <div className="roulette-window" aria-hidden={!revealed || undefined}>
                {target && shuffling ? <FactionReel source={source.id} target={target.id} delayMs={revealRank * EXCHANGE_PRESENTATION.revealGapMs} timeline={timeline} /> : target && revealed ? <div className="roulette-target-reveal"><TargetCard faction={target} /></div> : <div className="inline-exchange-waiting"><span>?</span></div>}
              </div>
              {revealed && <span className="roulette-result"><span aria-hidden="true">✓</span> TERPILIH</span>}
            </div>
          </article>
        })}
      </div>
    </div>
    {error && <p className="inline-exchange-error" role="alert">{error}{!targets && <button className="text-button" onClick={onRetry}>Coba lagi</button>}</p>}
  </section>
}
