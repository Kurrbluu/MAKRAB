import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Faction } from '../data/game'

export default function FactionEmblem({ faction }: { faction: Faction }) {
  const [failedSource, setFailedSource] = useState<string>()
  const hasLogo = Boolean(faction.logoSrc) && faction.logoSrc !== failedSource

  return (
    <div
      className={`faction-logo${hasLogo ? ' faction-logo--image' : ''}`}
      data-faction={faction.id}
      style={{ '--faction-color': faction.color, '--faction-box-color': faction.boxColor, '--faction-box-base': faction.boxBaseColor } as CSSProperties}
      aria-hidden="true"
    >
      {hasLogo ? (
        <img src={faction.logoSrc} alt="" draggable={false} decoding="sync" onError={() => setFailedSource(faction.logoSrc)} />
      ) : <span>{faction.initials}</span>}
    </div>
  )
}
