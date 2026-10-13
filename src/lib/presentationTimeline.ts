import { EXCHANGE_PRESENTATION, EXCHANGE_REVEAL_ORDER } from './exchangePresentation.ts'

export type PresentationTimeline = { id: string; startsAt: number; now: () => number }
export function revealAt(startsAt: number, rank: number) {
  return startsAt + EXCHANGE_PRESENTATION.launchDelayMs + EXCHANGE_PRESENTATION.spinDurationMs + rank * EXCHANGE_PRESENTATION.revealGapMs
}
export function revealedAt(startsAt: number, now: number): boolean[] {
  const result = [false, false, false, false]
  EXCHANGE_REVEAL_ORDER.forEach((index, rank) => { result[index] = now >= revealAt(startsAt, rank) })
  return result
}
