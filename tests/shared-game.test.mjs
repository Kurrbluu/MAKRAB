import test from 'node:test'
import assert from 'node:assert/strict'
import { FACTION_IDS } from '../src/data/factionIds.ts'
import { GAME_PHASES } from '../src/data/gamePhases.ts'
import { remainingTime } from '../src/lib/gameTimer.ts'
import { isValidTargets } from '../src/lib/randomizer.ts'
import { createSharedGame, applySharedCommand, advanceSharedGame, assertSharedGame, isSharedCommand, SHARED_START_LEAD_MS, SHARED_DRAW_DURATION_MS } from '../src/lib/sharedGame.ts'
import { createServerClock } from '../src/lib/serverClock.ts'
import { revealAt, revealedAt } from '../src/lib/presentationTimeline.ts'

function game() {
  let sequence = 0, choicesMade = 0
  const choices = { id: () => `event-${++sequence}`, chooseIndex: () => { choicesMade++; return 0 } }
  const initial = createSharedGame(1_000_000, choices.id)
  return { initial, choices, command: (state, command, now = 1_000_000) => applySharedCommand(state, command, now, choices),
    advance: (state, now) => advanceSharedGame(state, now, choices.id), choicesMade: () => choicesMade }
}

test('one authoritative draw is locked before animation and countdown follows its original finish time', () => {
  const g = game()
  const draw = g.command(g.initial, { type: 'begin' })
  assertSharedGame(draw)
  assert.equal(draw.active, true)
  assert.equal(draw.presentation.startsAt, 1_000_000 + SHARED_START_LEAD_MS)
  assert.equal(draw.presentation.completesAt, draw.presentation.startsAt + SHARED_DRAW_DURATION_MS)
  assert.equal(draw.rundown.bank.timers.terawang.deadline, null)
  assert.equal(draw.cue, null)
  assert.equal(g.choicesMade(), 1)
  assert(isValidTargets(FACTION_IDS, draw.draws.rounds[1].targets))
  assert.equal(g.command(draw, { type: 'begin' }), draw)
  assert.equal(g.command(draw, { type: 'replay' }), draw)
  assert.equal(g.advance(draw, draw.presentation.completesAt - 1), draw)
  const late = g.advance(JSON.parse(JSON.stringify(draw)), draw.presentation.completesAt + 5_000)
  assertSharedGame(late)
  assert.equal(late.presentation, null)
  assert.equal(late.rundown.startAfterDraw, undefined)
  assert.equal(late.rundown.bank.timers.terawang.deadline, draw.presentation.completesAt + 90_000)
  assert.equal(remainingTime(late.rundown.bank.timers.terawang, draw.presentation.completesAt + 5_000), 85_000)
  assert.equal(late.cue.startsAt, draw.presentation.completesAt)
  assert.deepEqual(late.draws, draw.draws)
})

test('pause, resume and roulette replay preserve the remaining time and never repeat a phase cue', () => {
  const g = game()
  const draw = g.command(g.initial, { type: 'begin' })
  const started = g.advance(draw, draw.presentation.completesAt)
  const pausedAt = draw.presentation.completesAt + 20_000
  const paused = g.command(started, { type: 'pause' }, pausedAt)
  assert.equal(paused.rundown.bank.timers.terawang.remainingMs, 70_000)
  assert.equal(paused.rundown.bank.timers.terawang.deadline, null)
  const resumed = g.command(paused, { type: 'toggle' }, pausedAt + 5_000)
  assert.equal(resumed.rundown.bank.timers.terawang.deadline, pausedAt + 5_000 + SHARED_START_LEAD_MS + 70_000)
  const replay = g.command(resumed, { type: 'replay' }, pausedAt + 15_000)
  assert.equal(replay.rundown.bank.timers.terawang.remainingMs, 60_400)
  assert.equal(replay.rundown.bank.timers.terawang.deadline, null)
  const finished = g.advance(replay, replay.presentation.completesAt)
  assert.equal(finished.rundown.bank.timers.terawang.deadline, replay.presentation.completesAt + 60_400)
  assert.deepEqual(finished.draws, started.draws)
  assert.deepEqual(finished.cue, started.cue)
  assert.equal(g.choicesMade(), 1)
  const reset = g.command(finished, { type: 'reset' }, replay.presentation.completesAt + 1_000)
  assert.equal(reset.rundown.bank.timers.terawang.remainingMs, 90_000)
  assert.deepEqual(g.command(reset, { type: 'toggle' }, replay.presentation.completesAt + 2_000).cue, started.cue)
})

test('manual phase selection and forward start retain rundown durations and cached targets', () => {
  const g = game()
  let state = g.initial
  for (const [index, phase] of GAME_PHASES.entries()) {
    state = g.command(state, { type: 'phase', index, start: false }, 1_000_000 + index * 200_000)
    assertSharedGame(state)
    const timer = state.rundown.bank.timers[phase.timerId]
    assert.equal(timer.durationMs, phase.durationMs)
    assert.equal(timer.deadline, null)
    if (state.presentation) {
      const drawing = state
      state = g.advance(drawing, drawing.presentation.completesAt)
      assert.equal(state.rundown.bank.timers[phase.timerId].deadline !== null, index === 0)
    }
    assertSharedGame(state)
  }
  assert.equal(g.choicesMade(), 3)
  const direct = g.command(state, { type: 'phase', index: 2, start: true }, 4_000_000)
  assert.equal(direct.presentation, null)
  assert.equal(direct.rundown.bank.timers.movement.deadline, 4_000_000 + SHARED_START_LEAD_MS + 180_000)
  assert.deepEqual(direct.draws.rounds[1], state.draws.rounds[1])
  const nextDraw = g.command(direct, { type: 'phase', index: 3, start: true }, 4_010_000)
  assert.equal(nextDraw.rundown.startAfterDraw, true)
  assert.equal(g.advance(nextDraw, nextDraw.presentation.completesAt).rundown.bank.timers.terawang.deadline, nextDraw.presentation.completesAt + 90_000)
})

test('pending phase announcement is cancelled before start and is announced on a later resume', () => {
  const g = game()
  const selected = g.command(g.initial, { type: 'phase', index: 1, start: true })
  assert.equal(selected.cue.startsAt, 1_000_000 + SHARED_START_LEAD_MS)
  const paused = g.command(selected, { type: 'pause' }, 1_000_100)
  assert.equal(paused.cue, null)
  assert.equal(paused.cueTracker.started, false)
  assert.equal(paused.rundown.bank.timers.discussion.remainingMs, 90_000)
  const resumed = g.command(paused, { type: 'toggle' }, 1_001_000)
  assert.equal(resumed.cue.startsAt, 1_001_000 + SHARED_START_LEAD_MS)
  assert.notEqual(resumed.cue.id, selected.cue.id)
})

test('pause during an undian cancels its queued countdown without discarding its targets', () => {
  const g = game()
  const draw = g.command(g.initial, { type: 'begin' })
  const paused = g.command(draw, { type: 'pause' }, 1_001_000)
  assert.equal(paused.rundown.startAfterDraw, undefined)
  const finished = g.advance(paused, draw.presentation.completesAt)
  assert.equal(finished.rundown.bank.timers.terawang.deadline, null)
  assert.equal(finished.cue, null)
  assert.deepEqual(finished.draws, draw.draws)
  assertSharedGame(finished)
})

test('expiration stops the current phase and Home pauses all clocks for the same shared session', () => {
  const g = game()
  const running = g.command(g.initial, { type: 'phase', index: 2, start: true })
  const expired = g.advance(running, 1_500_000)
  assert.equal(expired.rundown.phaseIndex, 2)
  assert.equal(expired.rundown.bank.timers.movement.remainingMs, 0)
  assert.equal(expired.rundown.bank.timers.movement.deadline, null)
  assert.equal(g.advance(expired, 1_500_001), expired)
  const final = g.command(expired, { type: 'phase', index: 9, start: true }, 1_500_000)
  const finished = g.advance(final, 2_000_000)
  assert.equal(finished.rundown.phaseIndex, 9)
  assert.equal(finished.rundown.bank.timers.movement.remainingMs, 0)
  const home = g.command(running, { type: 'home' }, 1_010_000)
  assert.equal(home.active, false)
  assert(Object.values(home.rundown.bank.timers).every(timer => timer.deadline === null))
  const reentered = g.command(home, { type: 'begin' }, 1_020_000)
  assert.equal(reentered.active, true)
  assert.deepEqual(reentered.rundown, home.rundown)
  assert.equal(reentered.gameId, home.gameId)
})

test('Home cancels an ongoing draw and a new game creates a fresh session and new targets', () => {
  const g = game()
  const draw = g.command(g.initial, { type: 'begin' })
  const home = g.command(draw, { type: 'home' }, 1_001_000)
  assert.equal(home.presentation, null)
  assert.equal(home.rundown.startAfterDraw, undefined)
  assertSharedGame(home)
  const next = g.command(home, { type: 'newGame' }, 1_010_000)
  assert.notEqual(next.gameId, draw.gameId)
  assert.equal(next.revision, home.revision + 1)
  assert.deepEqual(Object.keys(next.draws.rounds), ['1'])
  assert.equal(g.choicesMade(), 2)
})

test('custom durations are shared, paused, bounded, and reset when selecting another phase', () => {
  const g = game()
  const selected = g.command(g.initial, { type: 'phase', index: 2, start: true })
  const custom = g.command(selected, { type: 'duration', durationMs: 30_000 })
  assert.equal(custom.rundown.bank.timers.movement.deadline, null)
  assert.equal(custom.rundown.bank.timers.movement.durationMs, 30_000)
  assert.throws(() => g.command(custom, { type: 'duration', durationMs: 181_000 }))
  assert.throws(() => g.command(custom, { type: 'duration', durationMs: 0 }))
  assert.throws(() => g.command(custom, { type: 'phase', index: 10, start: false }))
  const next = g.command(custom, { type: 'phase', index: 5, start: false })
  assert.equal(next.rundown.bank.timers.movement.durationMs, 60_000)
  const drawing = g.command(g.initial, { type: 'begin' })
  assert.throws(() => g.command(drawing, { type: 'reset' }))
  assert.throws(() => g.command(drawing, { type: 'duration', durationMs: 30_000 }))
})

test('restoring invalid shared state fails instead of quietly starting over', () => {
  const g = game()
  assertSharedGame(g.initial)
  for (const mutate of [state => { state.version = 0 }, state => { state.rundown.phaseIndex = 10 },
    state => { state.rundown.bank.timers.movement.deadline = 1_000_000 }, state => { state.rundown.startAfterDraw = true },
    state => { state.cueTracker.phaseIndex = 2 }, state => { state.draws.rounds[1] = { confirmed: true, targets: {} } }]) {
    const invalid = structuredClone(g.initial)
    mutate(invalid)
    assert.throws(() => assertSharedGame(invalid))
  }
  assert.equal(isSharedCommand(null), false)
  assert.equal(isSharedCommand({ type: 'phase', index: 1 }), false)
  assert.equal(isSharedCommand({ type: 'unknown' }), false)
  assert.equal(isSharedCommand({ type: 'phase', index: 1, start: false }), true)
})

test('two laptops with different wall clocks use the same calibrated server countdown', () => {
  let localA = 1_000_020, localB = 1_360_020
  const clockA = createServerClock(() => localA)
  const clockB = createServerClock(() => localB)
  clockA.observe(1_000_010, 1_000_000, localA)
  clockB.observe(1_000_010, 1_360_000, localB)
  assert.equal(clockA.now(), clockB.now())
  localA += 10_000; localB += 10_000
  const timer = { durationMs: 90_000, remainingMs: 90_000, deadline: 1_090_000 }
  assert.equal(remainingTime(timer, clockA.now()), remainingTime(timer, clockB.now()))
  const goodOffset = clockB.offset()
  clockB.observe(1_010_500, 1_370_000, 1_372_000)
  assert.equal(clockB.offset(), goodOffset, 'slow request must not override a better calibration')
  const restored = createServerClock(() => localB)
  restored.restore(goodOffset)
  assert.equal(restored.now(), clockA.now())
})

test('a browser joining mid-animation reveals only the results already due on the shared timeline', () => {
  const start = 1_000_000
  assert.deepEqual(revealedAt(start, start - 1), [false, false, false, false])
  assert.deepEqual(revealedAt(start, revealAt(start, 0) - 1), [false, false, false, false])
  assert.deepEqual(revealedAt(start, revealAt(start, 0)), [true, false, false, false])
  assert.deepEqual(revealedAt(start, revealAt(start, 2)), [true, true, true, false])
  assert.deepEqual(revealedAt(start, start + SHARED_DRAW_DURATION_MS), [true, true, true, true])
})
