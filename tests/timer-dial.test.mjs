import test from 'node:test'
import assert from 'node:assert/strict'
import { createDialCursor, moveDialCursor, pointerDialAngle } from '../src/lib/timerDial.ts'

const radians = degrees => degrees * Math.PI / 180

test('a quarter-turn adds fifteen seconds and reversing restores the displayed time', () => {
  const start = createDialCursor(90_000, 0, 3_599_000)
  const clockwise = moveDialCursor(start, Math.PI / 2, 3_599_000)
  assert.equal(clockwise.valueMs, 105_000)
  assert.equal(moveDialCursor(clockwise, 0, 3_599_000).valueMs, 90_000)
})

test('crossing twelve o’clock adjusts smoothly in both directions', () => {
  const start = createDialCursor(90_000, radians(350), 3_599_000)
  const across = moveDialCursor(start, radians(10), 3_599_000)
  assert.equal(across.valueMs, 93_000)
  assert.equal(moveDialCursor(across, radians(350), 3_599_000).valueMs, 90_000)
})

test('multiple full turns accumulate minutes without losing small movements', () => {
  let cursor = createDialCursor(90_000, 0, 3_599_000)
  for (let degree = 1; degree <= 720; degree++) cursor = moveDialCursor(cursor, radians(degree), 3_599_000)
  assert.equal(cursor.valueMs, 210_000)
})

test('the Exchange maximum and one-second minimum allow immediate reversal', () => {
  const maxed = moveDialCursor(createDialCursor(180_000, 0, 180_000), Math.PI / 2, 180_000)
  assert.equal(maxed.valueMs, 180_000)
  assert.equal(moveDialCursor(maxed, 0, 180_000).valueMs, 165_000)
  const minimum = moveDialCursor(createDialCursor(1000, 0, 180_000), -Math.PI / 2, 180_000)
  assert.equal(minimum.valueMs, 1000)
  assert.equal(moveDialCursor(minimum, 0, 180_000).valueMs, 16_000)
})

test('an expired clock can be adjusted and fractional remaining time matches its display', () => {
  assert.equal(moveDialCursor(createDialCursor(0, 0, 180_000), Math.PI / 2, 180_000).valueMs, 16_000)
  assert.equal(createDialCursor(89_125, 0, 180_000).valueMs, 90_000)
})

test('pointer geometry follows a clock face regardless of its screen position', () => {
  assert.equal(pointerDialAngle(300, 150, 300, 200), 0)
  assert.equal(pointerDialAngle(350, 200, 300, 200), Math.PI / 2)
  assert.equal(pointerDialAngle(300, 250, 300, 200), Math.PI)
  assert.equal(pointerDialAngle(250, 200, 300, 200), -Math.PI / 2)
})
