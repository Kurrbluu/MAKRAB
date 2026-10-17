import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { factions } from '../data/game'
import type { ResultsPresentation } from '../lib/gameScoring'
import type { ExchangeNumber, RoundCount } from '../data/gamePhases'
import FactionEmblem from './FactionEmblem'
import FactionFrame from './FactionFrame'
import './exchange-results.css'

export default function ExchangeResults({ result, lastRound, disabled, onContinue, extraRound, onAddRound }: {
  result: ResultsPresentation; lastRound: RoundCount; disabled: boolean; onContinue: () => void; extraRound?: ExchangeNumber; onAddRound?: () => void
}) {
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [result.kind, result.round])
  return <section className={`exchange-results${result.kind === 'waiting' ? ' is-waiting' : ''}`} aria-labelledby="ranking-title" data-results-state={result.kind}>
    <header className="results-header">
      <svg className="results-heading-mark" viewBox="0 0 56 56" fill="none" aria-hidden="true"><circle cx="28" cy="28" r="23" /><circle cx="28" cy="28" r="18" strokeDasharray="1 6" /><path d="m28 12 5 11 11 5-11 5-5 11-5-11-11-5 11-5 5-11ZM28 1v5m0 44v5M1 28h5m44 0h5" /></svg>
      <p className="results-eyebrow">EXCHANGE {result.round}</p>
      <h1 id="ranking-title" ref={title} tabIndex={-1}>{result.kind === 'waiting' ? 'Hasil sedang disiapkan' : result.round === lastRound ? 'Peringkat akhir' : 'Peringkat sementara'}</h1>
      <p>{result.kind === 'waiting' ? 'Exchange selesai. Menunggu catatan Game Master.' : `Hasil gabungan hingga Exchange ${result.round}`}</p>
    </header>
    {result.kind === 'ranking' ? <ol className="results-factions" key={result.round}>{result.places.map((place, index) => {
      const faction = factions.find(value => value.id === place.factionId)!
      const tied = result.places.filter(value => value.rank === place.rank).length > 1
      return <li key={faction.id} className={place.rank === 1 ? 'is-leading' : ''} style={{ '--rank-faction-color': faction.color, '--rank-faction-base': faction.boxBaseColor, '--rank-enter-delay': `${index * 100}ms` } as CSSProperties}>
        <FactionFrame faction={faction.id} />
        <div className="results-rank"><span className="sr-only">Peringkat</span><strong>{place.rank}</strong></div>
        <div className="results-identity"><div className="results-emblem"><FactionEmblem faction={faction} /><span className="results-faction-seal" lang="zh-Hant" aria-hidden="true">{faction.chineseName}</span></div><h2>{faction.name}</h2></div>
        <div className="results-standing">
          {place.rank === 1 && <span className="results-leader"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="14" /><path d="m16 6 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" /></svg><span>Teratas</span></span>}
          {tied && <span className="results-tie">Seri</span>}
        </div>
      </li>
    })}</ol>
      : <div className="results-waiting-art" aria-hidden="true"><svg viewBox="0 0 160 160" fill="none"><circle cx="80" cy="80" r="67" /><circle cx="80" cy="80" r="56" /><path d="m80 37 12 31 31 12-31 12-12 31-12-31-31-12 31-12 12-31Z" /><circle cx="80" cy="80" r="10" /></svg></div>}
    <footer>{result.kind === 'ranking' ? <div className="results-actions">
      {onAddRound && extraRound && <button className="results-continue results-add-round" disabled={disabled} onClick={onAddRound}>Tambah Exchange {extraRound} <span aria-hidden="true">＋</span></button>}
      <button className="results-continue" disabled={disabled} onClick={onContinue}>{result.round === lastRound ? 'Layar permainan selesai' : `Lanjut Terawang ${result.round + 1}`} <span aria-hidden="true">→</span></button>
    </div> : <p role="status">Ranking akan muncul otomatis setelah hasil lengkap.</p>}</footer>
  </section>
}
