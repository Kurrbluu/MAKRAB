import { useLayoutEffect, useRef } from 'react'
import { factions } from '../data/game'
import { cardMotionFrames, cardTiming } from '../lib/cardMotion'
import type { DrawLayout } from '../lib/cardMotion'
import TargetCard, { CardBack } from './TargetCard'

type Props = {
  layout: DrawLayout
  targets: string[]
  revealed: number
  phase: 'gather' | 'shuffle' | 'deal' | 'reveal'
  onFinish: () => void
}

export default function CardDrawAnimation({ layout, targets, revealed, phase, onFinish }: Props) {
  const movingCards = useRef<(HTMLDivElement | null)[]>([])
  const flippingCards = useRef<(HTMLDivElement | null)[]>([])
  const finishRef = useRef(onFinish)
  const spotlights = Array.from(new Map(layout.slots.map(slot => {
    const origin = slot.origin ?? { x: layout.centerX, y: layout.centerY, maxReach: 0 }
    return [`${origin.x}:${origin.y}`, { ...origin, width: slot.origin ? slot.width * 1.2 + origin.maxReach * 2 : undefined }] as const
  })).values())

  useLayoutEffect(() => {
    finishRef.current = onFinish
  }, [onFinish])

  useLayoutEffect(() => {
    const animations: Animation[] = []
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finish = () => finishRef.current()
    const handleMotionChange = () => { if (preference.matches) finish() }

    try {
      layout.slots.forEach((_, index) => {
        const mover = movingCards.current[index]
        const flipper = flippingCards.current[index]
        if (!mover || !flipper) throw new Error('Missing card animation element.')
        animations.push(mover.animate(cardMotionFrames(layout, index), {
          duration: cardTiming.duration,
          fill: 'both',
        }))
        animations.push(flipper.animate([
          { transform: 'rotateY(0deg)' },
          { transform: 'rotateY(180deg)' },
        ], {
          duration: cardTiming.revealDuration,
          delay: cardTiming.revealStart + cardTiming.revealStep * index,
          easing: 'cubic-bezier(.4,0,.2,1)',
          fill: 'both',
        }))
      })
    } catch {
      animations.forEach((animation) => animation.cancel())
      finish()
    }

    // A changed layout or accessibility preference ends the effect at the saved result.
    window.addEventListener('resize', finish)
    preference.addEventListener('change', handleMotionChange)
    return () => {
      animations.forEach((animation) => animation.cancel())
      window.removeEventListener('resize', finish)
      preference.removeEventListener('change', handleMotionChange)
    }
  }, [layout])

  return (
    <div className={`card-draw-animation card-draw-animation--${phase}`} aria-hidden="true">
      {spotlights.map(spotlight => <div key={`${spotlight.x}:${spotlight.y}`} className="deck-spotlight" style={{ left: spotlight.x, top: spotlight.y, width: spotlight.width }} />)}
      {layout.slots.map((slot, index) => {
        const target = factions.find((faction) => faction.id === targets[index])!
        return (
          <div
            className={`flying-card${index < revealed ? ' flying-card--complete' : ''}`}
            key={index}
            ref={(element) => { movingCards.current[index] = element }}
            style={{ left: (slot.origin?.x ?? layout.centerX) - slot.width / 2, top: (slot.origin?.y ?? layout.centerY) - slot.height / 2, width: slot.width, height: slot.height }}
          >
            <div className="physical-card" ref={(element) => { flippingCards.current[index] = element }}>
              <CardBack />
              <div className="card-reverse"><TargetCard faction={target} /></div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
