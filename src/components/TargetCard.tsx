import type { CSSProperties } from 'react'
import type { Faction } from '../data/game'
import FactionEmblem from './FactionEmblem'

export function CardBack() {
  return (
    <div className="physical-card-face physical-card-back" aria-hidden="true">
      <span className="card-back-corner card-back-corner--top">✦</span>
      <span className="card-back-seal"><span>✦</span></span>
      <span className="card-back-wordmark">EXCHANGE</span>
      <span className="card-back-corner card-back-corner--bottom">✦</span>
    </div>
  )
}

export default function TargetCard({ faction }: { faction: Faction }) {
  return (
    <div className="physical-card-face physical-card-front" data-faction={faction.id} style={{ '--target-color': faction.color, '--target-box-color': faction.boxColor, '--target-box-base': faction.boxBaseColor } as CSSProperties}>
      <span className="card-face-marker" aria-hidden="true">✦</span>
      <FactionEmblem faction={faction} />
      <h3>{faction.name}</h3>
    </div>
  )
}
