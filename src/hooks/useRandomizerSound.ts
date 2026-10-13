import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { EXCHANGE_PRESENTATION } from '../lib/exchangePresentation'
import { playRandomizerSound, stopRandomizerSound } from '../lib/phaseCueAudio'
import type { CueAudioStatus, PhaseCueSettings } from '../lib/phaseCueAudio'
import { revealedAt } from '../lib/presentationTimeline'
import type { PresentationTimeline } from '../lib/presentationTimeline'

type Options = {
  active: boolean
  stopped: boolean
  animationKey: number | string
  settings: PhaseCueSettings
  status: CueAudioStatus
  launchDelayMs?: number
  spinDurationMs?: number
  timeline?: PresentationTimeline
}

export default function useRandomizerSound({ active, stopped, animationKey, settings, status,
  launchDelayMs = EXCHANGE_PRESENTATION.launchDelayMs, spinDurationMs = EXCHANGE_PRESENTATION.spinDurationMs, timeline }: Options) {
  const spinRef = useRef<{ startsAt: number; requested: boolean } | null>(null)
  const revealedRef = useRef<boolean[]>(timeline ? revealedAt(timeline.startsAt, timeline.now()) : [false, false, false, false])
  const previousAnimation = useRef(animationKey)
  if (previousAnimation.current !== animationKey) {
    previousAnimation.current = animationKey
    revealedRef.current = timeline ? revealedAt(timeline.startsAt, timeline.now()) : [false, false, false, false]
  }
  const settingsRef = useRef(settings)
  const activeRef = useRef(active)
  useLayoutEffect(() => { settingsRef.current = settings; activeRef.current = active }, [settings, active])

  useLayoutEffect(() => {
    const elapsed = timeline ? timeline.now() - timeline.startsAt : 0
    revealedRef.current = timeline ? revealedAt(timeline.startsAt, timeline.now()) : [false, false, false, false]
    spinRef.current = active ? { startsAt: performance.now() - elapsed + launchDelayMs, requested: false } : null
    return stopRandomizerSound
  }, [active, animationKey, launchDelayMs, timeline])

  // A real click can activate audio after a direct visit or refresh has started the roll.
  // Join the existing motion at its current offset, with no reroll or animation restart.
  useEffect(() => {
    const spin = spinRef.current
    if (!active || stopped || !settings.enabled || status.state !== 'ready' || !spin || spin.requested) return
    spin.requested = true
    void playRandomizerSound('spin', settings.volume, spin.startsAt, EXCHANGE_PRESENTATION.spinDurationMs / spinDurationMs)
      .then(played => { if (!played && spinRef.current === spin) spin.requested = false })
  }, [active, stopped, animationKey, settings.enabled, settings.volume, status, spinDurationMs])

  return useCallback((revealed: boolean[]) => {
    const previous = revealedRef.current
    revealedRef.current = revealed
    if (!activeRef.current || !settingsRef.current.enabled) return
    revealed.forEach((isRevealed, index) => {
      if (isRevealed && !previous[index]) void playRandomizerSound(revealed.every(Boolean) ? 'complete' : 'result', settingsRef.current.volume)
    })
  }, [])
}
