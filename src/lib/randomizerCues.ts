export const RANDOMIZER_CUES = {
  spin: 'audio/randomizer/randomizer-spin.wav',
  result: 'audio/randomizer/randomizer-result.wav',
  complete: 'audio/randomizer/randomizer-complete.wav',
  preview: 'audio/randomizer/randomizer.wav',
} as const

export type RandomizerCueId = keyof typeof RANDOMIZER_CUES

// Late decoding joins the current animation instead of playing its start again.
export function randomizerPlaybackTiming(duration: number, startsAtMs: number, nowMs: number) {
  const offset = Math.max(0, (nowMs - startsAtMs) / 1000)
  return offset >= duration ? null : { delay: Math.max(0, (startsAtMs - nowMs) / 1000), offset }
}
