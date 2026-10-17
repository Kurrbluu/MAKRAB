import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { factions, gameName } from '../data/game'
import FactionEmblem from './FactionEmblem'
import './game-end-screen.css'

export default function GameEndScreen({ onNewGame, onHome, disabled }: {
  onNewGame: () => void; onHome?: () => void; disabled?: boolean
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (!document.querySelector('dialog[open]')) titleRef.current?.focus({ preventScroll: true })
  }, [])

  return <section className="game-end" aria-labelledby="game-end-title" aria-describedby="game-end-message game-end-announcement">
    <svg className="game-end-aura" viewBox="0 0 680 680" fill="none" aria-hidden="true"><circle cx="340" cy="340" r="306" /><circle cx="340" cy="340" r="285" strokeDasharray="2 22" /><path d="M68 220a294 294 0 0 1 544 0M68 460a294 294 0 0 0 544 0M340 15l6 12-6 12-6-12 6-12Zm0 626 6 12-6 12-6-12 6-12Z" /><path d="m87 95 5 10 10 5-10 5-5 10-5-10-10-5 10-5 5-10Zm506 0 5 10 10 5-10 5-5 10-5-10-10-5 10-5 5-10Z" /></svg>
    <div className="game-end-copy">
      <div className="game-end-seal" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="43" /><circle cx="50" cy="50" r="36" strokeDasharray="1 7" />
          <path d="M50 2v8m0 80v8M2 50h8m80 0h8M19 19l6 6m50 50 6 6M19 81l6-6m50-50 6-6" />
          <path className="game-end-seal-check" d="m50 23 8 19 19 8-19 8-8 19-8-19-19-8 19-8 8-19Z" />
        </svg>
      </div>
      <p className="game-end-station">{gameName}</p>
      <h1 id="game-end-title" ref={titleRef} tabIndex={-1}>Permainan selesai</h1>
      <p id="game-end-message" className="game-end-thanks">Terima kasih sudah bermain.</p>
    </div>

    <ul className="game-end-factions" aria-label="Empat faksi dalam permainan">
      {factions.map((faction, index) => <li key={faction.id} style={{ '--end-faction-color': faction.color, '--end-faction-delay': `${index * 90}ms` } as CSSProperties}>
        <div className="game-end-faction-art"><FactionEmblem faction={faction} /><span className="game-end-faction-seal" lang="zh-Hant" aria-hidden="true">{faction.chineseName}</span></div>
        <span className="game-end-faction-name">{faction.name}</span>
      </li>)}
    </ul>

    <div className="game-end-announcement" role="status">
      <svg className="game-end-announcement-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 13h7l13-7v20l-13-7H5v-6ZM12 19l2 9H9l-2-9M28 12v8" /><path d="M16 11v10" /></svg>
      <p id="game-end-announcement">Hasil akhir segera diumumkan.</p>
    </div>
    <footer className="game-end-footer">
      <div className="game-end-actions">
        <a className="game-end-home" href="#/" aria-disabled={disabled || undefined} onClick={event => { if (onHome) { event.preventDefault(); if (!disabled) onHome() } }}>Kembali ke Beranda <span aria-hidden="true">↗</span></a>
        <button className="game-end-restart" disabled={disabled} onClick={onNewGame}>Permainan baru</button>
      </div>
    </footer>
  </section>
}
