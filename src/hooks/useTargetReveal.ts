import { useLayoutEffect, useRef, useState } from 'react'
import { EXCHANGE_PRESENTATION, EXCHANGE_REVEAL_ORDER } from '../lib/exchangePresentation'
import { revealedAt, revealAt } from '../lib/presentationTimeline'
import type { PresentationTimeline } from '../lib/presentationTimeline'

type Props = {
  active: boolean
  stopped: boolean
  targets?: readonly string[]
  onFinish: () => void
  onProgress?: (revealed: boolean[]) => void
  timeline?: PresentationTimeline
}

export default function useTargetReveal({ active, stopped, targets, onFinish, onProgress, timeline }: Props) {
  const [revealed, setRevealed] = useState<boolean[]>([false, false, false, false])
  const finishRef = useRef(onFinish)
  const progressRef = useRef(onProgress)
  useLayoutEffect(() => { finishRef.current = onFinish; progressRef.current = onProgress }, [onFinish, onProgress])

  useLayoutEffect(() => {
    if (!active || !targets) { setRevealed([false, false, false, false]); return }
    const progress = timeline ? revealedAt(timeline.startsAt, timeline.now()) : [false, false, false, false]
    const timers: number[] = []
    let cancelled = false
    let finished = false
    const finish = () => {
      if (cancelled || finished) return
      finished = true
      finishRef.current()
    }
    setRevealed([...progress])
    progressRef.current?.([...progress])
    if (timeline) {
      EXCHANGE_REVEAL_ORDER.forEach((index, rank) => {
        if (progress[index]) return
        timers.push(window.setTimeout(() => {
          if (cancelled || finished) return
          progress[index] = true
          setRevealed([...progress])
          progressRef.current?.([...progress])
        }, Math.max(0, revealAt(timeline.startsAt, rank) - timeline.now())))
      })
      timers.push(window.setTimeout(finish, Math.max(0, revealAt(timeline.startsAt, 3) + EXCHANGE_PRESENTATION.resultHoldMs - timeline.now())))
    } else if (stopped) {
      EXCHANGE_REVEAL_ORDER.forEach((index, rank) => {
        const reveal = () => {
          if (cancelled || finished) return
          progress[index] = true
          setRevealed([...progress])
          progressRef.current?.([...progress])
          if (rank === EXCHANGE_REVEAL_ORDER.length - 1) timers.push(window.setTimeout(finish, EXCHANGE_PRESENTATION.resultHoldMs))
        }
        if (rank === 0) reveal()
        else timers.push(window.setTimeout(reveal, rank * EXCHANGE_PRESENTATION.revealGapMs))
      })
    }
    return () => {
      cancelled = true
      timers.forEach(window.clearTimeout)
    }
  }, [active, stopped, targets, timeline])
  return revealed
}
