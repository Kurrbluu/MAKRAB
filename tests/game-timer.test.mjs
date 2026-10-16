import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createTimerBank, formatTime, pauseAllTimers, pauseTimer, remainingTime,
  resetTimer, restoreTimerBank, setTimerDuration, settleTimers, startTimer,
} from '../src/lib/gameTimer.ts'

test('pause/resume preserves the remainder and excludes time spent paused', () => {
  const running = startTimer(createTimerBank(), 'terawang', 1_000)
  const paused = pauseTimer(running, 'terawang', 11_750)
  assert.equal(remainingTime(paused.timers.terawang, 300_000), 79_250)
  const resumed = startTimer(paused, 'terawang', 500_000)
  assert.equal(remainingTime(resumed.timers.terawang, 510_000), 69_250)
})

test('starting another phase pauses the old clock and preserves each remainder', () => {
  const discussion = startTimer(createTimerBank(), 'discussion', 1_000)
  const terawang = startTimer(discussion, 'terawang', 11_000)
  assert.equal(terawang.timers.discussion.deadline, null)
  assert.equal(terawang.timers.discussion.remainingMs, 80_000)
  assert.equal(terawang.timers.terawang.deadline, 101_000)
  assert.equal(Object.values(terawang.timers).filter((timer) => timer.deadline !== null).length, 1)
  const paused = pauseAllTimers(terawang, 21_000)
  assert.equal(paused.timers.terawang.remainingMs, 80_000)
  assert.ok(Object.values(paused.timers).every((timer) => timer.deadline === null))
})

test('expiry stops at zero without advancing or starting another clock; play rearms an expired timer', () => {
  const running = startTimer(createTimerBank(), 'movement', 1_000)
  const expired = settleTimers(running, 190_000)
  assert.equal(expired.timers.movement.remainingMs, 0)
  assert.equal(expired.timers.movement.deadline, null)
  assert.equal(expired.timers.discussion.remainingMs, 90_000)
  assert.equal(expired.timers.terawang.remainingMs, 90_000)
  const restarted = startTimer(expired, 'movement', 200_000)
  assert.equal(restarted.timers.movement.deadline, 380_000)
})

test('reset affects only the chosen timer and retains its configured duration', () => {
  const configured = setTimerDuration(createTimerBank(), 'discussion', 60_000)
  const running = startTimer(configured, 'discussion', 1_000)
  const switched = startTimer(running, 'terawang', 11_000)
  const reset = resetTimer(switched, 'discussion')
  assert.equal(reset.timers.discussion.remainingMs, 60_000)
  assert.equal(reset.timers.discussion.deadline, null)
  assert.deepEqual(reset.timers.terawang, switched.timers.terawang)
  assert.equal(switched.timers.discussion.remainingMs, 50_000)
})

test('reload restores running and paused clocks accurately, including after their deadlines', () => {
  const running = startTimer(createTimerBank(), 'terawang', 1_000)
  const reloaded = restoreTimerBank(JSON.stringify(running), 31_000)
  assert.equal(remainingTime(reloaded.timers.terawang, 31_000), 60_000)
  assert.equal(restoreTimerBank(JSON.stringify(running), 200_000).timers.terawang.remainingMs, 0)
  const paused = pauseTimer(running, 'terawang', 11_000)
  assert.deepEqual(restoreTimerBank(JSON.stringify(paused), 900_000), paused)
})

test('invalid durations and corrupted storage cannot break clocks or exceed the movement limit', () => {
  const original = createTimerBank()
  for (const duration of [-1, 0, 999, 180_001, Infinity, NaN]) {
    assert.throws(() => setTimerDuration(original, 'movement', duration))
  }
  for (const raw of [null, '', '{broken', 'null', '[]', '{"version":99}', '{"version":1,"phaseIndex":9}']) {
    assert.deepEqual(restoreTimerBank(raw, 1_000), original)
  }
  const corrupted = structuredClone(original)
  corrupted.timers.movement.durationMs = 999_999
  corrupted.timers.discussion.deadline = 'bad'
  corrupted.timers.terawang.remainingMs = -10
  assert.deepEqual(restoreTimerBank(JSON.stringify(corrupted), 1_000), original)
  const twoRunning = structuredClone(original)
  twoRunning.timers.terawang.deadline = 61_000
  twoRunning.timers.discussion.deadline = 61_000
  assert.equal(Object.values(restoreTimerBank(JSON.stringify(twoRunning), 1_000).timers).filter((timer) => timer.deadline !== null).length, 1)
})

test('movement accepts durations up to three minutes and preserves them on reload', () => {
  const original = createTimerBank()
  for (const duration of [30_001, 60_000, 120_000, 180_000]) {
    const configured = setTimerDuration(original, 'movement', duration)
    assert.equal(configured.timers.movement.remainingMs, duration)
    assert.deepEqual(restoreTimerBank(JSON.stringify(configured), 1_000), configured)
  }
})

test('countdown formatting rounds up partial seconds and never displays negative time', () => {
  assert.equal(formatTime(60_000), '01:00')
  assert.equal(formatTime(59_200), '01:00')
  assert.equal(formatTime(59_000), '00:59')
  assert.equal(formatTime(1), '00:01')
  assert.equal(formatTime(-1), '00:00')
})
