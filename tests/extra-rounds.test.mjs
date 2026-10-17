import test from 'node:test'
import assert from 'node:assert/strict'
import { FACTION_IDS } from '../src/data/factionIds.ts'
import { GAME_PHASES } from '../src/data/gamePhases.ts'
import { addRundownRound, canAddRundownRound, createRundown, phaseCountFor, restoreRundown, roundCountFor, selectRundownPhase, settleRundown, startRundownPhase } from '../src/lib/gameRundown.ts'
import { assertSharedGame, SHARED_START_LEAD_MS } from '../src/lib/sharedGame.ts'
import { applyScoringCommand, assertScoring, nextScoreRound, scoreTotals } from '../src/lib/gameScoring.ts'
import { assertSessionDocument, createSessionDocument, coreTransition, advanceSession, privateSnapshot, scoringTransition } from '../server/session-engine.mjs'

const id = () => crypto.randomUUID()
const choices = { id, chooseIndex: () => 0 }
const command = (doc, value, now = 1_000_000, commandId = id(), expectedRevision) => {
  const current = advanceSession(doc, now, id)
  return coreTransition(current, { commandId, expectedRevision: expectedRevision ?? current.state.revision, command: value }, now, choices)
}
function finishRound(doc, round, now) {
  const index = GAME_PHASES.findIndex(phase => phase.round === round && phase.timerId === 'movement')
  const selected = command(doc, { type: 'phase', index, start: true }, now)
  assert.equal(selected.status, 200)
  const deadline = selected.document.state.rundown.bank.timers.movement.deadline
  return advanceSession(selected.document, deadline + 1, id)
}
function fillRound(doc, round, role = 'vip') {
  for (const room of ['a', 'b']) for (const factionId of FACTION_IDS) {
    const result = scoringTransition(doc, { commandId: id(), gameId: doc.state.gameId,
      command: { type: 'scoreAdd', expectedRound: round, room, factionId, role } }, `GM-${room}`, doc.state.updatedAt, id)
    assert.equal(result.status, 200, result.body.error)
    doc = result.document
  }
  return doc
}

test('a saved three-round game keeps its clocks and cannot enter optional phases without activation', () => {
  const legacy = startRundownPhase(createRundown(9), 1_000_000)
  assert.equal(roundCountFor(legacy), 3)
  assert.equal(phaseCountFor(legacy), 10)
  assert.deepEqual(restoreRundown(JSON.stringify(legacy), 1_020_000), legacy)
  assert.throws(() => createRundown(10))
  assert.throws(() => addRundownRound(legacy))
  const done = settleRundown(legacy, 1_180_000, true)
  assert.equal(done.phaseIndex, 9, 'auto-advance never enables an optional round')
  assert(canAddRundownRound(done))
  const fourth = addRundownRound(done)
  assert.equal(fourth.phaseIndex, 10)
  assert.equal(roundCountFor(fourth), 4)
  assert.equal(phaseCountFor(fourth), 13)
  assert.deepEqual(restoreRundown(JSON.stringify(fourth), 1_200_000), fourth)
  assert.equal(roundCountFor(selectRundownPhase(2, roundCountFor(fourth))), 4)
  assert.throws(() => createRundown(13, 4))
  assert.equal(roundCountFor(restoreRundown(JSON.stringify({ ...legacy, phaseIndex: 10 }), 1_020_000)), 3)
  assert.equal(restoreRundown(JSON.stringify({ ...legacy, roundCount: 6 }), 1_020_000).phaseIndex, 0)
  const invalid = createSessionDocument(1_000_000, id)
  invalid.state.results = { enabled: true, presentation: { kind: 'waiting', round: 4 } }
  assert.throws(() => assertSessionDocument(invalid), /belum diaktifkan/)
})

test('optional rounds each use one stored draw, a shared reveal deadline, and full 90/90/180-second clocks', () => {
  let doc = finishRound(createSessionDocument(1_000_000, id), 3, 1_000_000)
  let now = 1_200_000
  for (const round of [4, 5]) {
    const beforeDraws = structuredClone(doc.state.draws)
    const added = command(doc, { type: 'addRound' }, now)
    assert.equal(added.status, 200, added.body.error)
    doc = added.document
    const state = doc.state, presentation = state.presentation
    assert.equal(roundCountFor(state.rundown), round)
    assert.equal(GAME_PHASES[state.rundown.phaseIndex].title, `Terawang ${round}`)
    assert.equal(presentation.round, round)
    assert.equal(presentation.startsAt, now + SHARED_START_LEAD_MS)
    assert.equal(state.rundown.bank.timers.terawang.deadline, null)
    assert.equal(state.rundown.bank.timers.terawang.remainingMs, 90_000)
    for (const [key, result] of Object.entries(beforeDraws.rounds)) assert.deepEqual(state.draws.rounds[key], result)
    assertSharedGame(state)
    assertSessionDocument(doc)
    assert.equal(command(doc, { type: 'addRound' }, now).status, 400, 'rapid second click cannot enable another round')
    doc = advanceSession(JSON.parse(JSON.stringify(doc)), presentation.completesAt + 600, id)
    assert.equal(doc.state.rundown.bank.timers.terawang.deadline, presentation.completesAt + 90_000)
    const discussion = command(doc, { type: 'phase', index: state.rundown.phaseIndex + 1, start: true }, now + 100_000)
    assert.equal(discussion.status, 200)
    assert.equal(discussion.document.state.rundown.bank.timers.discussion.durationMs, 90_000)
    doc = finishRound(discussion.document, round, now + 200_000)
    assert.equal(doc.state.rundown.bank.timers.movement.durationMs, 180_000)
    assert.deepEqual(doc.state.draws, state.draws, 'discussion and Exchange never redraw targets')
    assertSessionDocument(doc)
    now += 500_000
  }
  assert.equal(command(doc, { type: 'addRound' }, now).status, 400)
  assert.equal(canAddRundownRound(doc.state.rundown), false)
  const fresh = command(doc, { type: 'newGame' }, now).document
  assert.equal(roundCountFor(fresh.state.rundown), 3)
  assert.deepEqual(Object.keys(fresh.state.draws.rounds), ['1'])
})

test('unused score sets never block the third result; activated fourth and fifth results accumulate without public points', () => {
  let doc = createSessionDocument(1_000_000, id)
  doc.scoring.enabled = true
  const input4 = { type: 'scoreSet', round: 4, room: 'a', factionId: FACTION_IDS[0], role: 'vip', expectedEntryRevision: null }
  assert.throws(() => applyScoringCommand(doc.scoring, input4, 'GM', 1_000_000, id), /Aktifkan ronde/)
  for (const round of [1, 2, 3]) {
    doc = finishRound(doc, round, 1_000_000 + round * 400_000)
    if (round === 3) assert.equal(command(doc, { type: 'addRound' }, 2_500_000).status, 400, 'wait for both rooms before extending')
    doc = fillRound(doc, round)
  }
  assert.equal(doc.state.results.presentation.kind, 'ranking')
  assert.equal(doc.state.results.presentation.round, 3)
  assert.equal(nextScoreRound(doc.scoring), undefined)
  assert.equal(doc.scoring.entries.length, 24)
  assert.equal(command(doc, { type: 'resultsNext' }, 2_500_000).document.state.results.presentation, null)
  for (const round of [4, 5]) {
    doc = command(doc, { type: 'addRound' }, 3_000_000 + round * 400_000).document
    assert.equal(nextScoreRound(doc.scoring, round), round)
    assert.equal(privateSnapshot(doc, 'GM', 3_000_000).roundCount, round)
    doc = fillRound(doc, round)
    doc = finishRound(doc, round, 4_000_000 + round * 400_000)
    assert.equal(doc.state.results.presentation.round, round)
    assert.equal(doc.state.results.presentation.kind, 'ranking')
    assert(Object.values(scoreTotals(doc.scoring)).every(total => total === round * 6))
    for (const key of ['points', 'totals', 'entries', 'history', 'actor']) assert(!JSON.stringify(doc.state).includes(`"${key}"`))
    assertScoring(doc.scoring, round)
    const dismissed = command(doc, { type: 'resultsNext' }, 7_000_000)
    assert.equal(dismissed.document.state.rundown.phaseIndex, round === 4 ? 12 : 15, 'last active ranking ends the game')
    assert.equal(dismissed.document.state.results.presentation, null)
    doc = dismissed.document
  }
})

test('extension commands reject stale revisions and deduplicate after a server restart', () => {
  const initial = finishRound(createSessionDocument(1_000_000, id), 3, 1_000_000)
  const first = command(initial, { type: 'addRound' }, 1_200_000, 'extra-round-once')
  assert.equal(first.status, 200)
  const restored = JSON.parse(JSON.stringify(first.document))
  assertSessionDocument(restored)
  const stale = command(restored, { type: 'addRound' }, 1_200_001, 'extra-round-other', initial.state.revision)
  assert.equal(stale.status, 409)
  const retry = command(restored, { type: 'addRound' }, 1_200_002, 'extra-round-once', initial.state.revision)
  assert.equal(retry.status, 200)
  assert.deepEqual(retry.document.state.presentation, first.document.state.presentation)
  assert.equal(roundCountFor(retry.document.state.rundown), 4)
})

test('queuing an extra round during Exchange 3 or 4 preserves the running timer and advances only on the normal Next action', () => {
  let doc = createSessionDocument(1_000_000, id)
  doc.scoring.enabled = true
  for (const round of [1, 2, 3]) doc = fillRound(doc, round)
  doc = command(doc, { type: 'phase', index: 9, start: true }, 1_000_000).document
  for (const round of [4, 5]) {
    const before = structuredClone(doc.state)
    const now = before.updatedAt + 1_000
    const queued = command(doc, { type: 'queueRound' }, now)
    assert.equal(queued.status, 200)
    doc = queued.document
    assert.equal(roundCountFor(doc.state.rundown), round)
    assert.equal(doc.state.rundown.phaseIndex, before.rundown.phaseIndex)
    assert.deepEqual(doc.state.rundown.bank, before.rundown.bank)
    assert.deepEqual(doc.state.draws, before.draws)
    assert.deepEqual(doc.state.cue, before.cue)
    assert.equal(doc.state.presentation, null)
    assert.equal(command(doc, { type: 'queueRound' }, now).status, 400)
    doc = advanceSession(doc, before.rundown.bank.timers.movement.deadline + 1, id)
    assert.equal(doc.state.results.presentation.kind, 'ranking')
    assert.equal(doc.state.results.presentation.round, round - 1)
    doc = command(doc, { type: 'resultsNext' }, doc.state.updatedAt + 1).document
    assert.equal(GAME_PHASES[doc.state.rundown.phaseIndex].title, `Terawang ${round}`)
    assert.equal(doc.state.presentation.round, round)
    assert.equal(doc.state.rundown.bank.timers.terawang.remainingMs, 90_000)
    doc = fillRound(doc, round)
    doc = command(doc, { type: 'phase', index: round === 4 ? 12 : 15, start: true }, doc.state.presentation.completesAt + 10_000).document
  }
  assert.equal(command(doc, { type: 'queueRound' }, doc.state.updatedAt + 1).status, 400)
  assertSessionDocument(doc)
})
