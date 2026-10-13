import { GAME_PHASES } from '../data/gamePhases.ts'
import type { ExchangeNumber } from '../data/gamePhases'
import { confirmRound, drawTargets, setRoundTargets } from './randomizer.ts'
import type { RandomizerSession } from './randomizer'

// Each faction movement gets one stored result. Re-entry and refresh reuse it.
export function ensureExchangeTargets(
  session: RandomizerSession,
  round: ExchangeNumber,
  factionIds: readonly string[],
  chooseIndex?: (length: number) => number,
): { session: RandomizerSession; generated: boolean } {
  const existing = session.rounds[round]
  if (existing) {
    const selected = session.activeRound === round ? session : { ...session, activeRound: round }
    return { session: confirmRound(selected, round), generated: false }
  }
  const targets = drawTargets(factionIds, chooseIndex)
  return { session: confirmRound(setRoundTargets(session, round, targets, factionIds), round), generated: true }
}

// Each Terawang prepares one target mapping, reused by its discussion and Exchange.
export function exchangeDrawRound(phaseIndex: number): ExchangeNumber | null {
  const phase = GAME_PHASES[phaseIndex]
  return phase?.drawTargets ? phase.round ?? null : null
}

// Every active phase uses its own round; direct discussion jumps cannot leak an earlier target.
export function visibleExchangeRound(phaseIndex: number, session: RandomizerSession): ExchangeNumber | null {
  const current = GAME_PHASES[phaseIndex]
  if (!current || current.hideExchangeTargets) return null
  if (current.round) return current.round
  for (let index = phaseIndex; index >= 0; index--) {
    const phase = GAME_PHASES[index]
    if (!phase.round || (phase.timerId !== 'movement' && exchangeDrawRound(index) === null)) continue
    if (index === phaseIndex || session.rounds[phase.round]) return phase.round
  }
  return null
}
