export const TIMER_CONFIG = [
  { id: 'terawang', title: 'Terawang', durationMs: 90_000, maxDurationMs: 3_599_000, color: '#9ec9d1' },
  { id: 'movement', title: 'Exchange', durationMs: 180_000, maxDurationMs: 180_000, color: '#d8b07a' },
  { id: 'discussion', title: 'Diskusi', durationMs: 90_000, maxDurationMs: 3_599_000, color: '#b8a6d0' },
] as const

export type TimerId = typeof TIMER_CONFIG[number]['id']
