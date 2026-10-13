import type { TimerId } from '../data/timers'

export const PHASE_CUES = [
  { id: 'terawang', title: 'Terawang', description: 'Crystal chime + Fase Terawang', file: 'audio/phase-cues/terawang.wav' },
  { id: 'discussion', title: 'Diskusi', description: 'Double bell + Fase Diskusi', file: 'audio/phase-cues/discussion.wav' },
  { id: 'movement', title: 'Exchange / Perpindahan', description: 'Whoosh & impact + Fase perpindahan', file: 'audio/phase-cues/exchange.wav' },
] as const satisfies readonly { id: TimerId; title: string; description: string; file: string }[]

export type PhaseCueTracker = { phaseIndex: number; started: boolean }

export function createPhaseCueTracker(phaseIndex: number, alreadyStarted = false): PhaseCueTracker {
  return { phaseIndex, started: alreadyStarted }
}

// Announce a phase once when its clock actually starts, never during a preview or replay.
export function observePhaseCue(tracker: PhaseCueTracker, phaseIndex: number, running: boolean): { tracker: PhaseCueTracker; play: boolean } {
  const current = tracker.phaseIndex === phaseIndex ? tracker : createPhaseCueTracker(phaseIndex)
  if (!running || current.started) return { tracker: current, play: false }
  return { tracker: { phaseIndex, started: true }, play: true }
}
