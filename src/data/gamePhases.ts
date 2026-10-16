import type { TimerId } from './timers'

export const exchangeNumbers = [1, 2, 3, 4, 5] as const
export type ExchangeNumber = typeof exchangeNumbers[number]

type PhaseDefinition = {
  id: string
  title: string
  timerId: TimerId
  durationMs: number
  round?: ExchangeNumber
  drawTargets?: boolean
  hideExchangeTargets?: boolean
}

// Only active play is timed. Each round has 90 seconds of Terawang and 90 seconds of discussion.
const phaseDefinitions: PhaseDefinition[] = [
  { id: 'terawang-1', title: 'Terawang 1', timerId: 'terawang', durationMs: 90_000, round: 1, drawTargets: true },
  { id: 'discussion-1', title: 'Diskusi 1', timerId: 'discussion', durationMs: 90_000, round: 1 },
  { id: 'exchange-1', title: 'Exchange 1', timerId: 'movement', durationMs: 180_000, round: 1 },
  { id: 'terawang-2', title: 'Terawang 2', timerId: 'terawang', durationMs: 90_000, round: 2, drawTargets: true },
  { id: 'discussion-2', title: 'Diskusi 2', timerId: 'discussion', durationMs: 90_000, round: 2 },
  { id: 'gambler-movement', title: 'Exchange 2 · Gambler', timerId: 'movement', durationMs: 60_000, hideExchangeTargets: true },
  { id: 'exchange-2', title: 'Exchange 2 · Pemain lainnya', timerId: 'movement', durationMs: 180_000, round: 2 },
  { id: 'terawang-final', title: 'Terawang 3', timerId: 'terawang', durationMs: 90_000, round: 3, drawTargets: true },
  { id: 'discussion-final', title: 'Diskusi 3', timerId: 'discussion', durationMs: 90_000, round: 3 },
  { id: 'exchange-final', title: 'Exchange 3', timerId: 'movement', durationMs: 180_000, round: 3 },
]

export type GamePhase = PhaseDefinition & { startMs: number; endMs: number }
let phaseStart = 0
export const GAME_PHASES: readonly GamePhase[] = phaseDefinitions.map((phase) => {
  const timedPhase = { ...phase, startMs: phaseStart, endMs: phaseStart + phase.durationMs }
  phaseStart = timedPhase.endMs
  return timedPhase
})

export const RUNDOWN_CONFIG = {
  initialPhaseId: 'terawang-1',
  autoAdvance: false,
} as const
