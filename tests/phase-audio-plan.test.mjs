import test from 'node:test'
import assert from 'node:assert/strict'
import { createSharedGame, applySharedCommand, advanceSharedGame } from '../src/lib/sharedGame.ts'
import { sharedPhaseAudioPlan } from '../src/lib/phaseAudioPlan.ts'
import { phasePlaybackTiming } from '../src/lib/phaseCues.ts'

function fixture() {
  let sequence = 0
  const choices = { id: () => `audio-${++sequence}`, chooseIndex: () => 0 }
  const initial = createSharedGame(1_000_000, choices.id)
  const draw = applySharedCommand(initial, { type: 'begin' }, 1_000_000, choices)
  return { choices, initial, draw }
}

test('Terawang audio can be queued at the shared result boundary before the server sends its phase update', () => {
  const { draw, choices } = fixture()
  const queued = sharedPhaseAudioPlan(draw, null)
  assert.equal(queued.timerId, 'terawang')
  assert.equal(queued.startsAt, draw.presentation.completesAt)
  const started = advanceSharedGame(draw, draw.presentation.completesAt + 900, choices.id)
  const acknowledged = sharedPhaseAudioPlan(started, started.cue)
  assert.deepEqual(acknowledged, queued, 'delayed acknowledgement must not announce the same phase twice')
})

test('paused draws, silent previews and running-clock replays do not queue an extra phase announcement', () => {
  const { draw, choices } = fixture()
  const paused = applySharedCommand(draw, { type: 'pause' }, 1_000_100, choices)
  assert.equal(sharedPhaseAudioPlan(paused, null), null)
  const preview = applySharedCommand(draw, { type: 'phase', index: 3, start: false }, 1_000_200, choices)
  assert.equal(sharedPhaseAudioPlan(preview, null), null)
  const started = advanceSharedGame(draw, draw.presentation.completesAt, choices.id)
  const replay = applySharedCommand(started, { type: 'replay' }, draw.presentation.completesAt + 1000, choices)
  assert.equal(sharedPhaseAudioPlan(replay, replay.cue), null)
})

test('late joins and stale phase events remain silent while a newly received current phase is announced', () => {
  const { draw, choices } = fixture()
  const started = advanceSharedGame(draw, draw.presentation.completesAt, choices.id)
  assert.equal(sharedPhaseAudioPlan(started, null), null)
  const next = applySharedCommand(started, { type: 'phase', index: 1, start: true }, draw.presentation.completesAt + 1000, choices)
  assert.equal(sharedPhaseAudioPlan(next, started.cue), null)
  assert.equal(sharedPhaseAudioPlan(next, next.cue).timerId, 'discussion')
  assert.equal(sharedPhaseAudioPlan({ ...next, active: false }, next.cue), null)
})

test('late voice announcements keep their first words and old announcements are skipped', () => {
  assert.deepEqual(phasePlaybackTiming(2000, 1000), { delay: 1, offset: 0 })
  assert.deepEqual(phasePlaybackTiming(2000, 2800), { delay: 0, offset: 0 })
  assert.deepEqual(phasePlaybackTiming(2000, 1000, 480), { delay: .52, offset: 0 })
  assert.equal(phasePlaybackTiming(2000, 6001), null)
})
