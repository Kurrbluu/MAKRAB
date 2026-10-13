import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmRound, drawTargets, emptySession, restoreSession, setRoundTargets } from '../src/lib/randomizer.ts'

test('the manual randomizer saves five independent Exchange results and retains confirmed draws', () => {
  const ids = ['azure-dragon', 'vermilion-bird', 'white-tiger', 'black-tortoise']
  let session = emptySession()
  for (let exchange = 1; exchange <= 5; exchange++) {
    session = setRoundTargets(session, exchange, drawTargets(ids, () => exchange - 1), ids)
    session = confirmRound(session, exchange)
  }
  assert.equal(session.activeRound, 5)
  const restored = restoreSession(JSON.stringify(session), ids)
  assert.deepEqual(restored, session)
  for (let exchange = 1; exchange <= 5; exchange++) {
    assert.equal(setRoundTargets(restored, exchange, drawTargets(ids, () => 8), ids), restored)
  }
})
