import { exchangeNumbers } from '../data/gamePhases.ts'
import type { ExchangeNumber } from '../data/gamePhases'

export type RoundNumber = ExchangeNumber
export type RoundResult = { targets: string[]; confirmed: boolean }
export type RandomizerSession = {
  version: 1
  activeRound: RoundNumber
  rounds: Partial<Record<RoundNumber, RoundResult>>
}

export const randomizerStorageKey = 'makrab:randomizer:v1'

export function emptySession(): RandomizerSession {
  return { version: 1, activeRound: 1, rounds: {} }
}

export function isValidTargets(ids: readonly string[], value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length === ids.length
    && new Set(value).size === ids.length
    && value.every((target, index) => typeof target === 'string' && ids.includes(target) && target !== ids[index])
}

// There are nine valid assignments for four factions, including reciprocal pairs.
// Draw from the complete set so every allowed assignment has the same chance.
export function allTargetOrders(ids: readonly string[]): string[][] {
  if (ids.length !== 4 || new Set(ids).size !== 4) {
    throw new Error('Randomizer requires four distinct factions.')
  }

  const results: string[][] = []
  function visit(order: string[]) {
    if (order.length === ids.length) {
      results.push(order)
      return
    }
    for (const id of ids) {
      if (id !== ids[order.length] && !order.includes(id)) visit([...order, id])
    }
  }
  visit([])
  return results
}

function secureRandomIndex(length: number): number {
  const range = 0x100000000
  const limit = range - (range % length)
  const value = new Uint32Array(1)
  do {
    globalThis.crypto.getRandomValues(value)
  } while (value[0] >= limit)
  return value[0] % length
}

export function drawTargets(ids: readonly string[], chooseIndex = secureRandomIndex): string[] {
  const orders = allTargetOrders(ids)
  const index = chooseIndex(orders.length)
  if (!Number.isInteger(index) || index < 0 || index >= orders.length) {
    throw new Error('Invalid random choice.')
  }
  return [...orders[index]]
}

export function setRoundTargets(
  session: RandomizerSession,
  round: RoundNumber,
  targets: readonly string[],
  ids: readonly string[],
): RandomizerSession {
  if (session.rounds[round]?.confirmed) return session
  if (!isValidTargets(ids, targets)) throw new Error('Invalid faction targets.')
  return {
    ...session,
    activeRound: round,
    rounds: { ...session.rounds, [round]: { targets: [...targets], confirmed: false } },
  }
}

export function confirmRound(session: RandomizerSession, round: RoundNumber): RandomizerSession {
  const result = session.rounds[round]
  if (!result || result.confirmed) return session
  return { ...session, rounds: { ...session.rounds, [round]: { ...result, confirmed: true } } }
}

export function restoreSession(raw: string | null, ids: readonly string[]): RandomizerSession {
  const restored = emptySession()
  if (!raw) return restored
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1) return restored
    if ('activeRound' in parsed && exchangeNumbers.some((round) => round === parsed.activeRound)) restored.activeRound = parsed.activeRound as RoundNumber
    if (!('rounds' in parsed) || !parsed.rounds || typeof parsed.rounds !== 'object') return restored
    for (const round of exchangeNumbers) {
      const result: unknown = (parsed.rounds as Record<string, unknown>)[round]
      if (!result || typeof result !== 'object' || !('targets' in result) || !('confirmed' in result)) continue
      if (!isValidTargets(ids, result.targets) || typeof result.confirmed !== 'boolean') continue
      restored.rounds[round] = { targets: [...result.targets], confirmed: result.confirmed }
    }
    return restored
  } catch {
    return restored
  }
}
