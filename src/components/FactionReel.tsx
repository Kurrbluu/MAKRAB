import { useRef } from 'react'
import type { CSSProperties } from 'react'
import { factions } from '../data/game'
import { rouletteCandidates } from '../lib/exchangePresentation'
import useRouletteMotion from '../hooks/useRouletteMotion'
import TargetCard from './TargetCard'
import type { PresentationTimeline } from '../lib/presentationTimeline'

export default function FactionReel({ source, target, delayMs, timeline }: { source: string; target: string; delayMs: number; timeline?: PresentationTimeline }) {
  const reelRef = useRef<HTMLDivElement>(null)
  useRouletteMotion(reelRef, undefined, delayMs, 'reel', timeline)
  const candidates = rouletteCandidates(factions.map(faction => faction.id), source, target)
  return <div ref={reelRef} className="roulette-reel">
    {candidates.map((id, index) => <div key={index} className="roulette-item" aria-hidden={index < candidates.length - 1 || undefined} style={{ '--target-color': factions.find(faction => faction.id === id)!.color } as CSSProperties}><TargetCard faction={factions.find(faction => faction.id === id)!} /></div>)}
  </div>
}
