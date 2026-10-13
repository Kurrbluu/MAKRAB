export const EXCHANGE_PRESENTATION = {
  spinDurationMs: 4800,
  launchDelayMs: 120,
  revealGapMs: 180,
  resultHoldMs: 2000,
} as const

export const EXCHANGE_REVEAL_ORDER = [0, 1, 2, 3] as const
export function rouletteCandidates(ids: readonly string[], source: string, target: string): string[] {
  if (ids.length !== 4 || new Set(ids).size !== 4 || !ids.includes(source) || !ids.includes(target) || source === target) throw new Error('Invalid roulette target.')
  const eligible = ids.filter(id => id !== source)
  const offset = eligible[2] === target ? 1 : 0
  return [...Array.from({ length: 9 }, (_, index) => eligible[(index + offset) % eligible.length]), target]
}

export function rouletteProgress(progress: number): number {
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  // Smooth acceleration and deceleration, with no speed changes between segments.
  const eased = progress ** 3 * (progress * (6 * progress - 15) + 10)
  return Math.max(0, Math.min(1, eased))
}

export type RouletteMotion = 'reel' | 'ring'

export function rouletteTransform(progress: number, motion: RouletteMotion, distance: number): string {
  const position = rouletteProgress(progress) * distance
  return motion === 'reel' ? `translate3d(0, ${position}px, 0)` : `translate3d(0, 0, 0) rotate(${position}deg)`
}

export function rouletteMotionFrames(motion: RouletteMotion, distance: number): Keyframe[] {
  return Array.from({ length: 121 }, (_, index) => {
    const offset = index / 120
    return { offset, transform: rouletteTransform(offset, motion, distance) }
  })
}
