const TURN = Math.PI * 2
const MINUTE = 60_000

export type DialCursor = { angle: number; rawMs: number; valueMs: number }

export function pointerDialAngle(x: number, y: number, centerX: number, centerY: number) {
  return Math.atan2(x - centerX, centerY - y)
}

export function createDialCursor(valueMs: number, angle: number, maxMs: number): DialCursor {
  const rawMs = Math.max(1000, Math.min(maxMs, Math.ceil(valueMs / 1000) * 1000))
  return { angle, rawMs, valueMs: Math.max(1000, rawMs) }
}

export function moveDialCursor(cursor: DialCursor, angle: number, maxMs: number): DialCursor {
  const delta = ((angle - cursor.angle + Math.PI) % TURN + TURN) % TURN - Math.PI
  const rawMs = Math.max(1000, Math.min(maxMs, cursor.rawMs + delta * MINUTE / TURN))
  return { angle, rawMs, valueMs: Math.max(1000, Math.min(maxMs, Math.round(rawMs / 1000) * 1000)) }
}
