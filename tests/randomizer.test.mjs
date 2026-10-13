import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allTargetOrders, confirmRound, drawTargets, emptySession,
  isValidTargets, restoreSession, setRoundTargets,
} from '../src/lib/randomizer.ts'

const ids = ['azure-dragon', 'vermilion-bird', 'white-tiger', 'black-tortoise']

test('all nine valid assignments are reachable without self-targets or duplicate targets', () => {
  const seen = new Set()
  for (let index = 0; index < 9; index++) {
    const targets = drawTargets(ids, (count) => {
      assert.equal(count, 9)
      return index
    })
    assert.deepEqual([...targets].sort(), [...ids].sort())
    targets.forEach((target, position) => assert.notEqual(target, ids[position]))
    seen.add(targets.join(','))
  }
  assert.equal(seen.size, 9)
  assert.ok(seen.has([ids[1], ids[0], ids[3], ids[2]].join(',')), 'reciprocal pairings are allowed')
})

test('the default random source always returns a valid assignment', () => {
  for (let draw = 0; draw < 300; draw++) assert.ok(isValidTargets(ids, drawTargets(ids)))
})

test('invalid faction sets and random choices are rejected', () => {
  assert.throws(() => allTargetOrders(ids.slice(0, 3)))
  assert.throws(() => allTargetOrders([ids[0], ids[0], ids[2], ids[3]]))
  for (const value of [-1, 9, 0.5, NaN]) assert.throws(() => drawTargets(ids, () => value))
})

test('rounds are independent and may legitimately draw the same assignment', () => {
  const targets = drawTargets(ids, () => 0)
  const original = emptySession()
  const first = setRoundTargets(original, 1, targets, ids)
  const second = setRoundTargets(first, 2, targets, ids)
  assert.deepEqual(original.rounds, {})
  assert.equal(first.rounds[2], undefined)
  assert.deepEqual(second.rounds[1].targets, second.rounds[2].targets)
  assert.notEqual(second.rounds[1].targets, second.rounds[2].targets)
})

test('using a result preserves that round against rerolls, while the next round can still be drawn', () => {
  const initial = emptySession()
  assert.equal(confirmRound(initial, 1), initial)
  const drawn = setRoundTargets(initial, 1, drawTargets(ids, () => 0), ids)
  const confirmed = confirmRound(drawn, 1)
  assert.equal(confirmed.rounds[1].confirmed, true)
  assert.equal(drawn.rounds[1].confirmed, false)
  assert.equal(setRoundTargets(confirmed, 1, drawTargets(ids, () => 8), ids), confirmed)
  const second = setRoundTargets(confirmed, 2, drawTargets(ids, () => 8), ids)
  assert.deepEqual(second.rounds[1], confirmed.rounds[1])
  assert.equal(second.rounds[2].confirmed, false)
})

test('both accepted and draft results survive a save and reload', () => {
  let session = setRoundTargets(emptySession(), 1, drawTargets(ids, () => 2), ids)
  session = confirmRound(session, 1)
  session = setRoundTargets(session, 2, drawTargets(ids, () => 5), ids)
  assert.deepEqual(restoreSession(JSON.stringify(session), ids), session)
})

test('corrupted storage cannot restore invalid assignments', () => {
  for (const raw of [null, '', '{broken', 'null', '[]', '{"version":99}']) {
    assert.deepEqual(restoreSession(raw, ids), emptySession())
  }
  for (const targets of [ids, [ids[1], ids[0], ids[3], ids[3]], ['unknown', ids[0], ids[3], ids[2]], [], null]) {
    assert.equal(restoreSession(JSON.stringify({ version: 1, rounds: { 1: { targets, confirmed: true } } }), ids).rounds[1], undefined)
  }
  const valid = { targets: drawTargets(ids, () => 1), confirmed: true }
  const restored = restoreSession(JSON.stringify({ version: 1, activeRound: 2, rounds: { 1: valid, 2: { targets: ids, confirmed: true } } }), ids)
  assert.deepEqual(restored.rounds[1], valid)
  assert.equal(restored.rounds[2], undefined)
  assert.equal(restored.activeRound, 2)
})
