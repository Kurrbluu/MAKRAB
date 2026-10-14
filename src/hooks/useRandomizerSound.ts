import { useEffect, useLayoutEffect, useRef } from 'react'
import { EXCHANGE_PRESENTATION, EXCHANGE_REVEAL_ORDER } from '../lib/exchangePresentation'
import { playRandomizerSound, stopRandomizerSound } from '../lib/phaseCueAudio'
import type { CueAudioStatus, PhaseCueSettings } from '../lib/phaseCueAudio'
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
  const spinRef = useRef<{ startsAt: number; requested: boolean; results: Set<number>; epoch: number } | null>(null)

  useLayoutEffect(() => {
    const elapsed = timeline ? timeline.now() - timeline.startsAt : 0
    spinRef.current = active ? { startsAt: performance.now() - elapsed + launchDelayMs, requested: false, results: new Set(), epoch: 0 } : null
    return stopRandomizerSound
  }, [active, animationKey, launchDelayMs, timeline])

  // A real click can activate audio after a direct visit or refresh has started the roll.
  // Join the existing motion at its current offset, with no reroll or animation restart.
  useEffect(() => {
    const spin = spinRef.current
    if (!active || !spin) return
    if (!settings.enabled || status.state !== 'ready') {
      spin.epoch++
      spin.requested = false
      spin.results.clear()
      stopRandomizerSound()
      return
    }
    const epoch = spin.epoch
    if (!stopped && !spin.requested) {
      spin.requested = true
      void playRandomizerSound('spin', settings.volume, spin.startsAt, EXCHANGE_PRESENTATION.spinDurationMs / spinDurationMs)
        .then(played => { if (!played && spinRef.current === spin && spin.epoch === epoch) spin.requested = false })
    }
    // Schedule on the audio clock rather than waiting for render callbacks. A busy
    // frame must not bunch four reveals into multiple closing gongs.
    EXCHANGE_REVEAL_ORDER.forEach((_, rank) => {
      if (spin.results.has(rank)) return
      spin.results.add(rank)
      const startsAt = spin.startsAt + spinDurationMs + rank * EXCHANGE_PRESENTATION.revealGapMs
      if (startsAt < performance.now()) return
      void playRandomizerSound(rank === EXCHANGE_REVEAL_ORDER.length - 1 ? 'complete' : 'result', settings.volume, startsAt)
        .then(played => { if (!played && spinRef.current === spin && spin.epoch === epoch) spin.results.delete(rank) })
    })
  }, [active, stopped, animationKey, settings.enabled, settings.volume, status, spinDurationMs])

}
