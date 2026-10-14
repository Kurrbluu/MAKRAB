import { useEffect, useRef } from 'react'
import { sharedPhaseAudioPlan } from '../lib/phaseAudioPlan'
import type { PhaseAudioPlan } from '../lib/phaseAudioPlan'
import { playPhaseCue, stopPhaseCue } from '../lib/phaseCueAudio'
import type { CueAudioStatus, PhaseCueSettings } from '../lib/phaseCueAudio'
import type { SharedCue, SharedGame } from '../lib/sharedGame'

type Pending = PhaseAudioPlan & { performanceStart: number; requested: boolean }
type Options = { state?: SharedGame; liveCue?: SharedCue | null; connected: boolean; now?: () => number;
  settings: PhaseCueSettings; status: CueAudioStatus }

export default function useSharedPhaseSound({ state, liveCue, connected, now, settings, status }: Options) {
  const pendingRef = useRef<Pending | null>(null)
  const seen = useRef(new Set<string>())
  useEffect(() => {
    if (!state || !now) return
    let pending = pendingRef.current
    const cancel = () => {
      if (!pending) return
      if (now() < pending.startsAt) seen.current.delete(pending.key)
      pendingRef.current = null
      stopPhaseCue()
    }
    if (!state.active || !connected || !settings.enabled || status.state !== 'ready') { cancel(); return }
    const plan = sharedPhaseAudioPlan(state, liveCue ?? null)
    if (!plan) {
      // An announcement already in progress can finish when its timer is paused.
      const acknowledged = pending && state.cue?.phaseIndex === pending.phaseIndex
        && `${state.gameId}:${state.cue.phaseIndex}:${state.cue.startsAt}` === pending.key
      if (!acknowledged || !pending?.requested) cancel()
      return
    }
    if (!pending || pending.key !== plan.key) {
      cancel()
      if (seen.current.has(plan.key)) return
      pending = { ...plan, performanceStart: performance.now() + plan.startsAt - now(), requested: false }
      pendingRef.current = pending
    }
    if (performance.now() - pending.performanceStart > 4000) { cancel(); return }
    if (pending.requested || status.state !== 'ready') return
    pending.requested = true
    const request = pending
    // Preserve the closing gong while queuing the voice for the known transition.
    void playPhaseCue(request.timerId, settings.volume, request.performanceStart, { preserveRandomizer: true, alignVoice: true }).then(played => {
      if (pendingRef.current !== request) return
      if (played) seen.current.add(request.key)
      else request.requested = false
    })
  }, [state, liveCue, connected, now, settings.enabled, settings.volume, status.state])
  useEffect(() => () => {
    pendingRef.current = null
    seen.current.clear()
    stopPhaseCue()
  }, [])
}
