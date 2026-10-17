import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_PHASES } from '../src/data/gamePhases.ts'
import { pauseAllTimers, remainingTime, setTimerDuration, startTimer } from '../src/lib/gameTimer.ts'
import { completeRundownDraw, createRundown, nextPhaseForTimer, phaseCountFor, prepareRundownDraw, restoreRundown, RUNDOWN_VERSION, rundownStorageKey, selectRundownPhase, settleRundown, startRundownPhase } from '../src/lib/gameRundown.ts'

const indexOf = (id) => GAME_PHASES.findIndex((phase) => phase.id === id)
const basePhases = GAME_PHASES.slice(0, phaseCountFor(createRundown()))
function runningPhase(id, now) {
  const state = createRundown(indexOf(id))
  return { ...state, bank: startTimer(state.bank, GAME_PHASES[state.phaseIndex].timerId, now) }
}

test('only Terawang, discussion and Exchange are timed, with 90 seconds for each Terawang and discussion', () => {
  assert.deepEqual(basePhases.map(phase => [phase.id, phase.startMs / 60_000, phase.endMs / 60_000]), [
    ['terawang-1', 0, 1.5], ['discussion-1', 1.5, 3], ['exchange-1', 3, 6],
    ['terawang-2', 6, 7.5], ['discussion-2', 7.5, 9], ['gambler-movement', 9, 10],
    ['exchange-2', 10, 13], ['terawang-final', 13, 14.5], ['discussion-final', 14.5, 16],
    ['exchange-final', 16, 19],
  ])
  for (const id of ['explanation', 'room-setup', 'buffer', 'finish']) assert.equal(indexOf(id), -1)
  for (const timerId of ['terawang', 'discussion']) {
    const phases = basePhases.filter(phase => phase.timerId === timerId)
    assert.equal(phases.length, 3)
    assert(phases.every(phase => phase.durationMs === 90_000))
  }
  assert.equal(basePhases.filter(phase => phase.timerId === 'movement').length, 4)
  assert.equal(basePhases.at(-1).id, 'exchange-final')
  assert.equal(basePhases.at(-1).endMs, 1_140_000)
})

test('new games start at Terawang and every phase loads its own paused clock', () => {
  const initial = createRundown()
  assert.equal(initial.phaseIndex, indexOf('terawang-1'))
  assert.equal(initial.bank.timers.discussion.durationMs, 90_000)
  assert.equal(initial.bank.timers.terawang.durationMs, 90_000)
  assert.equal(initial.bank.timers.movement.durationMs, 180_000)
  for (const phase of basePhases) {
    const state = selectRundownPhase(indexOf(phase.id))
    assert.equal(Object.keys(state.bank.timers).length, 3)
    assert.equal(state.bank.timers[phase.timerId].durationMs, phase.durationMs)
    assert.equal(state.bank.timers[phase.timerId].remainingMs, phase.durationMs)
    assert(Object.values(state.bank.timers).every(timer => timer.deadline === null))
  }
  assert.equal(createRundown(indexOf('terawang-2')).bank.timers.movement.durationMs, 60_000, 'The next Exchange is the special Gambler movement')
})

test('manual expiry waits for GM, then Terawang leads to a separate discussion timer', () => {
  const expired = settleRundown(runningPhase('terawang-2', 1_000), 91_000, false)
  assert.equal(expired.phaseIndex, indexOf('terawang-2'))
  assert.equal(expired.bank.timers.terawang.remainingMs, 0)
  assert(Object.values(expired.bank.timers).every(timer => timer.deadline === null))
  const next = selectRundownPhase(expired.phaseIndex + 1)
  assert.equal(next.phaseIndex, indexOf('discussion-2'))
  assert.equal(next.bank.timers.discussion.remainingMs, 90_000)
  const gambler = selectRundownPhase(indexOf('gambler-movement'))
  const customized = { ...gambler, bank: setTimerDuration(gambler.bank, 'movement', 45_000) }
  assert.equal(restoreRundown(JSON.stringify(customized), 130_000).bank.timers.movement.durationMs, 45_000)
  assert.equal(selectRundownPhase(indexOf('exchange-2')).bank.timers.movement.durationMs, 180_000)
  assert.equal(selectRundownPhase(indexOf('exchange-final')).bank.timers.movement.durationMs, 180_000)
})

test('category navigation includes three discussion phases and ends at the last Exchange', () => {
  assert.equal(nextPhaseForTimer(0, 'terawang'), indexOf('terawang-1'))
  assert.equal(nextPhaseForTimer(0, 'discussion'), indexOf('discussion-1'))
  assert.equal(nextPhaseForTimer(0, 'movement'), indexOf('exchange-1'))
  assert.equal(nextPhaseForTimer(indexOf('terawang-2'), 'movement'), indexOf('gambler-movement'))
  assert.equal(nextPhaseForTimer(indexOf('gambler-movement') + 1, 'movement'), indexOf('exchange-2'))
  assert.equal(nextPhaseForTimer(indexOf('exchange-final'), 'terawang'), -1)
  assert.equal(nextPhaseForTimer(indexOf('exchange-final'), 'discussion'), -1)
  assert.equal(nextPhaseForTimer(GAME_PHASES.length, 'movement'), -1)
})

test('refresh preserves the selected Exchange and its absolute deadline while Home can pause it', () => {
  const state = runningPhase('exchange-2', 1_000)
  const restored = restoreRundown(JSON.stringify(state), 31_000, false)
  assert.equal(restored.phaseIndex, indexOf('exchange-2'))
  assert.equal(remainingTime(restored.bank.timers.movement, 31_000), 150_000)
  const paused = { ...restored, bank: pauseAllTimers(restored.bank, 41_000) }
  assert.deepEqual(restoreRundown(JSON.stringify(paused), 900_000), paused)
  assert.equal(restoreRundown(JSON.stringify(state), 900_000, false).phaseIndex, state.phaseIndex)
})

test('optional auto-advance respects the 19 minutes of active play and never starts a closing timer', () => {
  const state = runningPhase('terawang-1', 1_000)
  const boundary = settleRundown(state, 91_000, true)
  assert.equal(boundary.phaseIndex, indexOf('discussion-1'))
  assert.equal(boundary.bank.timers.discussion.deadline, 181_000)
  const late = settleRundown(state, 481_000, true)
  assert.equal(late.phaseIndex, indexOf('discussion-2'))
  assert.equal(remainingTime(late.bank.timers.discussion, 481_000), 60_000)
  assert.deepEqual(restoreRundown(JSON.stringify(state), 481_000, true), late)
  const gambler = settleRundown(state, 541_000, true)
  assert.equal(gambler.phaseIndex, indexOf('gambler-movement'))
  assert.equal(gambler.bank.timers.movement.deadline, 601_000)
  const finished = settleRundown(state, 2_000_000, true)
  assert.equal(finished.phaseIndex, indexOf('exchange-final'))
  assert.equal(finished.bank.timers.movement.remainingMs, 0)
  assert(Object.values(finished.bank.timers).every(timer => timer.deadline === null))
})

test('obsolete rundown saves cannot revive removed phases or the old timer durations', () => {
  for (const version of [1, 2, 3]) {
    const legacy = { ...runningPhase('exchange-1', 1_000), version }
    assert.deepEqual(restoreRundown(JSON.stringify(legacy), 11_000), createRundown())
  }
  assert.equal(RUNDOWN_VERSION, 4)
  assert.equal(rundownStorageKey, 'makrab:game-rundown:v4')
})

test('roulette and its result hold finish before the full 90-second Terawang countdown starts', () => {
  const prepared = startRundownPhase(createRundown(indexOf('terawang-1')), 1_000)
  assert.equal(prepared.startAfterDraw, true)
  assert.equal(prepared.bank.timers.terawang.deadline, null)
  assert.equal(remainingTime(prepared.bank.timers.terawang, 6_000), 90_000)
  const finished = completeRundownDraw(prepared, 6_000)
  assert.equal(finished.startAfterDraw, undefined)
  assert.equal(finished.bank.timers.terawang.deadline, 96_000)
  const manual = createRundown(indexOf('terawang-1'))
  assert.equal(completeRundownDraw(manual, 6_000), manual)
})

test('replaying roulette pauses a running clock and resumes the same remainder', () => {
  const held = startRundownPhase(runningPhase('terawang-2', 1_000), 31_000)
  assert.equal(held.bank.timers.terawang.remainingMs, 60_000)
  assert.equal(held.bank.timers.terawang.deadline, null)
  assert.equal(completeRundownDraw(held, 36_000).bank.timers.terawang.deadline, 96_000)
})

test('initial automatic roulette queues Terawang 1 without a Play click and preserves all 90 seconds', () => {
  const initial = createRundown()
  const queued = prepareRundownDraw(initial, 1_000)
  assert.equal(queued.startAfterDraw, true)
  assert.equal(queued.bank.timers.terawang.deadline, null)
  assert.equal(remainingTime(queued.bank.timers.terawang, 8_000), 90_000)
  assert.deepEqual(restoreRundown(JSON.stringify(queued), 8_000), queued)
  const started = completeRundownDraw(queued, 8_500)
  assert.equal(started.startAfterDraw, undefined)
  assert.equal(started.bank.timers.terawang.deadline, 98_500)
  assert.equal(remainingTime(started.bank.timers.terawang, 9_500), 89_000)
})

test('draw preparation preserves paused replays, resumes running clocks, and ignores non-draw phases', () => {
  const first = runningPhase('terawang-1', 1_000)
  const paused = { ...first, bank: pauseAllTimers(first.bank, 31_000) }
  assert.equal(prepareRundownDraw(paused, 35_000), paused)
  const held = prepareRundownDraw(first, 31_000)
  assert.equal(held.startAfterDraw, true)
  assert.equal(held.bank.timers.terawang.remainingMs, 60_000)
  assert.equal(completeRundownDraw(held, 38_500).bank.timers.terawang.deadline, 98_500)
  for (const id of ['discussion-1', 'exchange-1', 'gambler-movement']) {
    const state = createRundown(indexOf(id))
    assert.equal(prepareRundownDraw(state, 1_000), state)
  }
  const later = createRundown(indexOf('terawang-2'))
  assert.equal(prepareRundownDraw(later, 1_000), later, 'Manual later-phase previews remain paused')
})

test('pending roulette survives reload but cannot attach to a discussion or Exchange clock', () => {
  const pending = startRundownPhase(createRundown(indexOf('terawang-2')), 1_000)
  assert.deepEqual(restoreRundown(JSON.stringify(pending), 3_000), pending)
  const invalid = { ...createRundown(indexOf('discussion-2')), startAfterDraw: true }
  assert.deepEqual(restoreRundown(JSON.stringify(invalid), 3_000), createRundown(indexOf('discussion-2')))
  const immediate = startRundownPhase(createRundown(indexOf('exchange-1')), 1_000)
  assert.equal(immediate.bank.timers.movement.deadline, 181_000)
  assert.equal(immediate.startAfterDraw, undefined)
})

test('invalid phase data and clocks for another phase cannot restore the wrong timer', () => {
  for (const raw of [null, '', '{bad', 'null', '{"version":4}', '{"version":4,"phaseIndex":-1}', '{"version":4,"phaseIndex":999}']) {
    assert.deepEqual(restoreRundown(raw, 1_000), createRundown())
  }
  const wrong = createRundown()
  wrong.bank = startTimer(wrong.bank, 'movement', 1_000)
  assert.deepEqual(restoreRundown(JSON.stringify(wrong), 11_000), createRundown())
  for (const index of [-1, 1.5, GAME_PHASES.length]) assert.throws(() => selectRundownPhase(index))
})
