import { GAME_PHASES } from '../data/gamePhases.ts'
import type { SharedCue, SharedGame } from './sharedGame'

export type PhaseAudioPlan = { key: string; phaseIndex: number; timerId: SharedCue['timerId']; startsAt: number }

export function sharedPhaseAudioPlan(state: SharedGame, liveCue: SharedCue | null): PhaseAudioPlan | null {
  if (!state.active) return null
  const phaseIndex = state.rundown.phaseIndex
  const timerId = GAME_PHASES[phaseIndex].timerId
  let startsAt: number
  if (state.presentation && state.rundown.startAfterDraw && !state.cueTracker.started) {
    startsAt = state.presentation.completesAt
  } else {
    if (!liveCue || liveCue.id !== state.cue?.id || liveCue.phaseIndex !== phaseIndex
      || state.rundown.bank.timers[timerId].deadline === null) return null
    startsAt = liveCue.startsAt
  }
  // The queued transition and its later server acknowledgement identify the same sound.
  return { key: `${state.gameId}:${phaseIndex}:${startsAt}`, phaseIndex, timerId, startsAt }
}
