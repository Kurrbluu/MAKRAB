import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_PHASES } from '../src/data/gamePhases.ts'
import { ensureExchangeTargets, exchangeDrawRound, visibleExchangeRound } from '../src/lib/exchangeFlow.ts'
import { emptySession, restoreSession, setRoundTargets } from '../src/lib/randomizer.ts'

const ids = ['azure-dragon', 'vermilion-bird', 'white-tiger', 'black-tortoise']
const phaseIndex = (id) => GAME_PHASES.findIndex(phase => phase.id === id)

test('the first Terawang prepares one valid locked target mapping', () => {
  let draws = 0
  const round = exchangeDrawRound(phaseIndex('terawang-1'))
  const prepared = ensureExchangeTargets(emptySession(), round, ids, count => { draws++; assert.equal(count, 9); return 0 })
  assert.equal(draws, 1)
  assert.equal(prepared.generated, true)
  assert.equal(prepared.session.activeRound, 1)
  const result = prepared.session.rounds[1]
  assert.equal(result.confirmed, true)
  assert.equal(new Set(result.targets).size, 4)
  assert(result.targets.every((target, index) => ids.includes(target) && target !== ids[index]))
})

test('going back, returning to Home, and refreshing cannot reroll saved targets', () => {
  const original = ensureExchangeTargets(emptySession(), 3, ids, () => 4).session
  const restored = restoreSession(JSON.stringify(original), ids)
  const mustNotRoll = () => { throw new Error('Saved targets were unexpectedly redrawn') }
  const reused = ensureExchangeTargets(restored, 3, ids, mustNotRoll)
  assert.equal(reused.generated, false)
  assert.equal(reused.session, restored)
  assert.deepEqual(reused.session.rounds[3], original.rounds[3])
})

test('existing manual draft targets are accepted without changing the assignment', () => {
  const targets = ['white-tiger', 'black-tortoise', 'azure-dragon', 'vermilion-bird']
  const draft = setRoundTargets(emptySession(), 2, targets, ids)
  const prepared = ensureExchangeTargets({ ...draft, activeRound: 4 }, 2, ids, () => { throw new Error('Unexpected reroll') })
  assert.equal(prepared.generated, false)
  assert.equal(prepared.session.activeRound, 2)
  assert.equal(prepared.session.rounds[2].confirmed, true)
  assert.equal(prepared.session.rounds[2].targets, draft.rounds[2].targets)
})

test('the manual randomizer retains five independent result slots', () => {
  let session = emptySession(), calls = 0
  for (let round = 1; round <= 5; round++) {
    session = ensureExchangeTargets(session, round, ids, () => { calls++; return 2 }).session
  }
  assert.equal(calls, 5)
  const restored = restoreSession(JSON.stringify(session), ids)
  assert.deepEqual(restored, session)
  for (let round = 1; round <= 5; round++) {
    assert.equal(session.rounds[round].confirmed, true)
    assert.deepEqual(session.rounds[round].targets, session.rounds[1].targets)
    ensureExchangeTargets(restored, round, ids, () => { throw new Error('Unexpected reroll') })
  }
})

test('only the three Terawang preparation phases trigger draws, never discussion or Gambler movement', () => {
  const triggers = GAME_PHASES.flatMap((phase, index) => {
    const round = exchangeDrawRound(index)
    return round === null ? [] : [[phase.id, round]]
  })
  assert.deepEqual(triggers, [['terawang-1', 1], ['terawang-2', 2], ['terawang-final', 3]])
  for (const id of ['discussion-1', 'discussion-2', 'discussion-final', 'exchange-1', 'gambler-movement', 'exchange-2', 'exchange-final']) {
    assert.equal(exchangeDrawRound(phaseIndex(id)), null, id)
  }
})

test('the first target stays locked through discussion and the two-minute Exchange', () => {
  let session = emptySession(), calls = 0, initialTargets
  for (const id of ['terawang-1', 'discussion-1', 'exchange-1', 'discussion-1']) {
    const round = exchangeDrawRound(phaseIndex(id))
    if (round !== null) {
      const prepared = ensureExchangeTargets(session, round, ids, () => { calls++; return 0 })
      session = prepared.session
      assert.equal(prepared.generated, true)
      initialTargets = session.rounds[1].targets
    }
    assert.equal(visibleExchangeRound(phaseIndex(id), session), 1, id)
    assert.equal(session.rounds[1].targets, initialTargets)
  }
  assert.equal(calls, 1, 'Discussion and Exchange reuse the prepared draw')
})

test('targets follow their faction movements without leaking later results or showing during Gambler movement', () => {
  let session = ensureExchangeTargets(emptySession(), 1, ids, () => 0).session
  session = ensureExchangeTargets(session, 3, ids, () => 1).session
  for (const id of ['gambler-movement']) {
    assert.equal(visibleExchangeRound(phaseIndex(id), session), null, id)
  }
  for (const id of ['terawang-1', 'discussion-1', 'exchange-1']) {
    assert.equal(visibleExchangeRound(phaseIndex(id), session), 1, id)
  }
  for (const id of ['terawang-2', 'discussion-2', 'exchange-2']) {
    assert.equal(visibleExchangeRound(phaseIndex(id), session), 2, id)
  }
  for (const id of ['terawang-final', 'discussion-final', 'exchange-final']) {
    assert.equal(visibleExchangeRound(phaseIndex(id), session), 3, id)
  }
})

test('direct Terawang, discussion and Exchange navigation exposes the correct round without leaking old results', () => {
  for (const id of ['gambler-movement']) {
    assert.equal(visibleExchangeRound(phaseIndex(id), emptySession()), null, id)
  }
  assert.equal(visibleExchangeRound(phaseIndex('terawang-1'), emptySession()), 1)
  assert.equal(visibleExchangeRound(phaseIndex('exchange-2'), emptySession()), 2)
  assert.equal(visibleExchangeRound(phaseIndex('exchange-final'), emptySession()), 3)
})


test('jumping to a discussion phase cannot display the previous round target or request another animated roll', () => {
  const session = ensureExchangeTargets(emptySession(), 1, ids, () => 0).session
  const first = session.rounds[1]
  for (const [id,round] of [['discussion-1',1],['discussion-2',2],['discussion-final',3]]) {
    assert.equal(exchangeDrawRound(phaseIndex(id)), null)
    assert.equal(visibleExchangeRound(phaseIndex(id), session), round)
  }
  assert.equal(session.rounds[1],first)
  assert.equal(visibleExchangeRound(-1,session),null)
  assert.equal(visibleExchangeRound(GAME_PHASES.length,session),null)
})
