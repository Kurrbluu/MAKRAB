import { GAME_PHASES, RUNDOWN_CONFIG } from '../data/gamePhases.ts'
import { TIMER_CONFIG } from '../data/timers.ts'
import type { TimerId } from '../data/timers'
import {
  createTimerBank, pauseAllTimers, restoreTimerBank, setTimerDuration, settleTimers, startTimer,
} from './gameTimer.ts'
import type { TimerBank } from './gameTimer'

export const RUNDOWN_VERSION = 4 as const
export type GameRundown = { version: typeof RUNDOWN_VERSION; phaseIndex: number; bank: TimerBank; startAfterDraw?: boolean }
// Old indexes include preparation and briefing; they cannot restore into active play.
export const rundownStorageKey = 'makrab:game-rundown:v4'

export function nextPhaseForTimer(phaseIndex: number, timerId: TimerId): number {
  return GAME_PHASES.findIndex((phase, index) => index >= phaseIndex && phase.timerId === timerId)
}

export function createRundown(phaseIndex = GAME_PHASES.findIndex((phase) => phase.id === RUNDOWN_CONFIG.initialPhaseId)): GameRundown {
  if (!Number.isInteger(phaseIndex) || phaseIndex < 0 || phaseIndex >= GAME_PHASES.length) throw new Error('Invalid phase.')
  let bank = createTimerBank()
  for (const { id } of TIMER_CONFIG) {
    const upcoming = nextPhaseForTimer(phaseIndex, id)
    if (upcoming >= 0) bank = setTimerDuration(bank, id, GAME_PHASES[upcoming].durationMs)
  }
  return { version: RUNDOWN_VERSION, phaseIndex, bank }
}

// A phase change always loads its own duration and pauses before the GM starts it.
export function selectRundownPhase(phaseIndex: number): GameRundown {
  return createRundown(phaseIndex)
}

// Starting a draw phase preserves the full countdown until its reveal finishes.
export function startRundownPhase(state: GameRundown, now: number): GameRundown {
  const phase = GAME_PHASES[state.phaseIndex]
  if (phase.drawTargets) return { ...state, bank: pauseAllTimers(state.bank, now), startAfterDraw: true }
  return { ...state, bank: startTimer(state.bank, phase.timerId, now) }
}

// The first automatic draw starts the first full clock after its result hold.
// Replays resume running clocks; intentionally paused partial clocks stay paused.
export function prepareRundownDraw(state: GameRundown, now: number): GameRundown {
  const phase = GAME_PHASES[state.phaseIndex]
  if (!phase.drawTargets) return state
  const timer = state.bank.timers[phase.timerId]
  const freshFirstPhase = state.phaseIndex === 0 && timer.remainingMs === timer.durationMs
  return state.startAfterDraw || timer.deadline !== null || freshFirstPhase
    ? startRundownPhase(state, now) : state
}

export function completeRundownDraw(state: GameRundown, now: number): GameRundown {
  if (!state.startAfterDraw) return state
  const next = { ...state }
  delete next.startAfterDraw
  const phase = GAME_PHASES[next.phaseIndex]
  return phase.drawTargets ? { ...next, bank: startTimer(next.bank, phase.timerId, now) } : next
}

export function settleRundown(state: GameRundown, now: number, autoAdvance: boolean = RUNDOWN_CONFIG.autoAdvance): GameRundown {
  if (autoAdvance) {
    let current = state
    while (true) {
      const phase = GAME_PHASES[current.phaseIndex]
      const deadline = current.bank.timers[phase.timerId].deadline
      if (deadline === null || deadline > now || current.phaseIndex === GAME_PHASES.length - 1) {
        const bank = settleTimers(current.bank, now)
        return bank === current.bank ? current : { ...current, bank }
      }
      // Use the previous deadline so background tabs do not stretch the rundown.
      const next = createRundown(current.phaseIndex + 1)
      current = { ...next, bank: startTimer(next.bank, GAME_PHASES[next.phaseIndex].timerId, deadline) }
    }
  }
  const bank = settleTimers(state.bank, now)
  return bank === state.bank ? state : { ...state, bank }
}

export function restoreRundown(raw: string | null, now: number, autoAdvance: boolean = RUNDOWN_CONFIG.autoAdvance): GameRundown {
  const fallback = createRundown()
  if (!raw) return fallback
  try {
    const value = JSON.parse(raw)
    if (!value || value.version !== RUNDOWN_VERSION || !Number.isInteger(value.phaseIndex)
      || value.phaseIndex < 0 || value.phaseIndex >= GAME_PHASES.length
      || !value.bank || value.bank.version !== 1 || !value.bank.timers) return fallback
    const bank = restoreTimerBank(JSON.stringify(value.bank), now, false)
    const phaseFallback = createRundown(value.phaseIndex)
    if (TIMER_CONFIG.some(({ id }) => {
      const saved = value.bank.timers[id]
      const restored = bank.timers[id]
      return !saved || saved.durationMs !== restored.durationMs
        || saved.remainingMs !== restored.remainingMs || saved.deadline !== restored.deadline
    })) return phaseFallback
    // Only the selected phase can have a running clock in a restored rundown.
    if (TIMER_CONFIG.some(({ id }) => id !== GAME_PHASES[value.phaseIndex].timerId && bank.timers[id].deadline !== null)) return phaseFallback
    if (value.startAfterDraw === true && (!GAME_PHASES[value.phaseIndex].drawTargets || bank.timers[GAME_PHASES[value.phaseIndex].timerId].deadline !== null)) return phaseFallback
    return settleRundown({ version: RUNDOWN_VERSION, phaseIndex: value.phaseIndex, bank, ...(value.startAfterDraw === true ? { startAfterDraw: true } : {}) }, now, autoAdvance)
  } catch {
    return fallback
  }
}
