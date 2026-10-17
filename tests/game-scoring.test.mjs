import test from 'node:test'
import assert from 'node:assert/strict'
import { FACTION_IDS } from '../src/data/factionIds.ts'
import { createRundown } from '../src/lib/gameRundown.ts'
import { createScoring, applyScoringCommand, scoreKey, scoreTotals, roundProgress, roundComplete, nextScoreRound, rankingPlaces, publicResults, syncScoring, assertScoring, assertPublicResults, isScoringCommand, ScoreConflict } from '../src/lib/gameScoring.ts'

const id = () => crypto.randomUUID()
const game = (phaseIndex, finished = true) => {
  const rundown = createRundown(phaseIndex)
  if (finished) rundown.bank.timers.movement = { ...rundown.bank.timers.movement, deadline: null, remainingMs: 0 }
  return { gameId: 'game-one', active: true, rundown }
}
const add = (s, factionId, role, room = 'a', round = 1) => applyScoringCommand(s, { type: 'scoreSet', room, round, factionId, role, expectedEntryRevision: null }, `GM-${room}`, 1_000_000, id)
function fill(s, round, rolesA = ['vip', 'pretender', 'warden', 'civilian'], rolesB = ['civilian', 'vip', 'warden', 'pretender']) {
  for (const [index, faction] of FACTION_IDS.entries()) { s = add(s, faction, rolesA[index], 'a', round); s = add(s, faction, rolesB[index], 'b', round) }
  return s
}

test('points belong to the picker faction and combine both rooms without overwriting records', () => {
  let s = createScoring('game-one', true)
  const red = FACTION_IDS[1]
  s = add(s, red, 'pretender', 'a')
  s = add(s, red, 'vip', 'b')
  assert.equal(scoreTotals(s)[red], 0)
  assert.equal(s.entries.length, 2)
  assert.deepEqual(roundProgress(s, 1), { a: 1, b: 1 })
  assert.equal(s.history[0].actor, 'GM-a')
  assert.equal(s.history[1].actor, 'GM-b')
  assertScoring(s)
})

test('correction replaces the old role contribution and deletion subtracts it with a traceable history', () => {
  let s = add(createScoring('game-one', true), FACTION_IDS[1], 'pretender')
  const original = s.entries[0]
  const command = { type: 'scoreSet', round: 1, room: 'a', factionId: FACTION_IDS[1], role: 'vip', expectedEntryRevision: original.revision }
  s = applyScoringCommand(s, command, 'GM-correction', 1_001_000, id)
  assert.equal(scoreTotals(s)[FACTION_IDS[1]], 3)
  assert.equal(s.entries.length, 1)
  assert.equal(s.history[1].before, 'pretender')
  assert.equal(s.history[1].after, 'vip')
  assert.throws(() => applyScoringCommand(s, command, 'GM-stale', 1_002_000, id), ScoreConflict)
  const unchanged = applyScoringCommand(s, { ...command, expectedEntryRevision: s.entries[0].revision }, 'GM', 1_002_000, id)
  assert.equal(unchanged, s)
  s = applyScoringCommand(s, { type: 'scoreDelete', round: 1, room: 'a', factionId: FACTION_IDS[1], expectedEntryRevision: s.entries[0].revision }, 'GM', 1_003_000, id)
  assert.equal(scoreTotals(s)[FACTION_IDS[1]], 0)
  assert.equal(s.entries.length, 0)
  assert.equal(s.history[2].after, null)
  assertScoring(s)
})

test('one record per room/faction/Exchange rejects duplicate input but permits independent results', () => {
  const s = add(createScoring('game-one', true), FACTION_IDS[0], 'vip')
  assert.throws(() => add(s, FACTION_IDS[0], 'warden'), ScoreConflict)
  const next = add(add(s, FACTION_IDS[0], 'civilian', 'b'), FACTION_IDS[0], 'warden', 'a', 2)
  assert.equal(next.entries.length, 3)
  assert.equal(scoreTotals(next)[FACTION_IDS[0]], 3)
})

test('adding points automatically fills groups of eight and corrections never advance a group', () => {
  let state = createScoring('game-one', true)
  for (const round of [1, 2, 3]) {
    assert.equal(nextScoreRound(state), round)
    for (const room of ['a', 'b']) for (const factionId of FACTION_IDS) {
      state = applyScoringCommand(state, { type: 'scoreAdd', expectedRound: round, room, factionId, role: 'vip' }, 'GM', 1_000_000, id)
    }
    assert(roundComplete(state, round))
    assert.equal(state.entries.length, round * 8)
  }
  assert.equal(nextScoreRound(state), undefined)
  assert(Object.values(scoreTotals(state)).every(value => value === 18))
  const entry = state.entries[0]
  const corrected = applyScoringCommand(state, { type: 'scoreSet', round: entry.round, room: entry.room, factionId: entry.factionId, role: 'pretender', expectedEntryRevision: entry.revision }, 'GM', 1_001_000, id)
  assert.equal(corrected.entries.length, 24)
  assert.equal(nextScoreRound(corrected), undefined)
  const saved = corrected.entries.find(value => value.key === entry.key)
  const deleted = applyScoringCommand(corrected, { type: 'scoreDelete', round: saved.round, room: saved.room, factionId: saved.factionId, expectedEntryRevision: saved.revision }, 'GM', 1_002_000, id)
  assert.equal(nextScoreRound(deleted), 1)
  const repaired = applyScoringCommand(deleted, { type: 'scoreAdd', expectedRound: 1, room: saved.room, factionId: saved.factionId, role: 'warden' }, 'GM', 1_003_000, id)
  assert.equal(repaired.entries.length, 24)
  assert.equal(nextScoreRound(repaired), undefined)
  assertScoring(repaired)
})

test('automatic input rejects duplicate slots, stale groups, and drafts from before clear', () => {
  const input = { type: 'scoreAdd', expectedRound: 1, room: 'a', factionId: FACTION_IDS[0], role: 'vip' }
  const once = applyScoringCommand(createScoring('game-one', true), input, 'GM', 1_000_000, id)
  assert.throws(() => applyScoringCommand(once, input, 'GM', 1_000_000, id), ScoreConflict)
  const full = fill(createScoring('game-one', true), 1)
  assert.throws(() => applyScoringCommand(full, input, 'GM', 1_001_000, id), ScoreConflict)
  const cleared = applyScoringCommand(full, { type: 'scoresClear', expectedRevision: full.revision }, 'GM', 1_002_000, id)
  assert.throws(() => applyScoringCommand(cleared, input, 'GM', 1_003_000, id), ScoreConflict)
  const fresh = applyScoringCommand(cleared, { ...input, expectedClearRevision: cleared.lastCleared.revision }, 'GM', 1_003_000, id)
  assert.equal(fresh.entries.length, 1)
  for (const role of ['gambler', 'leader', ['vip']]) assert.equal(isScoringCommand({ ...input, role }), false)
  for (const expectedRound of [undefined, 0, 6, '1']) assert.equal(isScoringCommand({ ...input, expectedRound }), false)
})

test('rankings are cumulative, omit points, and preserve tied ranks without an invented tie breaker', () => {
  let s = fill(createScoring('game-one', true), 1)
  assert.deepEqual(rankingPlaces(s, 1), [
    { factionId: FACTION_IDS[0], rank: 1 }, { factionId: FACTION_IDS[2], rank: 1 },
    { factionId: FACTION_IDS[1], rank: 3 }, { factionId: FACTION_IDS[3], rank: 4 },
  ])
  const roundOne = rankingPlaces(s, 1)
  s = fill(s, 2, ['civilian', 'vip', 'civilian', 'vip'], ['civilian', 'vip', 'civilian', 'vip'])
  assert.deepEqual(rankingPlaces(s, 1), roundOne)
  assert.equal(rankingPlaces(s, 2)[0].factionId, FACTION_IDS[1])
  const results = publicResults(s, game(6))
  assert.equal(results.presentation.kind, 'ranking')
  assert(!JSON.stringify(results).includes('points'))
  assert(!JSON.stringify(results).includes('totals'))
  assertPublicResults(results)
})

test('all three completed Exchanges auto-publish only after both rooms and earlier rounds are complete', () => {
  let s = createScoring('game-one', true)
  for (const [round, index] of [[1, 2], [2, 6], [3, 9]]) {
    assert.equal(publicResults(s, game(index, false)).presentation, null)
    assert.equal(publicResults(s, game(index)).presentation.kind, 'waiting')
    s = syncScoring(s, game(index))
    s = fill(s, round)
    assert(roundComplete(s, round))
    assert.equal(publicResults(s, game(index)).presentation.kind, 'ranking')
    assert.equal(publicResults(s, game(index)).presentation.round, round)
  }
  const onlyThird = fill(createScoring('game-one', true), 3)
  assert.equal(publicResults(onlyThird, game(9)).presentation.kind, 'waiting')
})

test('Gambler and Leader cannot be scored; the Gambler transfer never triggers Exchange 2 ranking', () => {
  for (const role of ['gambler', 'leader', 'VIP', '__proto__', 'constructor']) {
    assert.equal(isScoringCommand({ type: 'scoreSet', round: 2, room: 'a', factionId: FACTION_IDS[0], role, expectedEntryRevision: null }), false)
  }
  const s = fill(fill(createScoring('game-one', true), 1), 2)
  assert.equal(publicResults(s, game(5)).presentation, null)
  assert.equal(syncScoring(s, game(5)), s)
  assert.equal(publicResults(s, game(6)).presentation.round, 2)
})

test('disabling the optional mode preserves records and restores ordinary game flow', () => {
  const s = fill(createScoring('game-one', true), 1)
  const off = applyScoringCommand(s, { type: 'scoresEnable', enabled: false }, 'GM', 1_000_000, id)
  assert.deepEqual(off.entries, s.entries)
  assert.equal(publicResults(off, game(2)).presentation, null)
  assert.throws(() => add(off, FACTION_IDS[0], 'vip', 'a', 2), /Aktifkan/)
  const on = applyScoringCommand(off, { type: 'scoresEnable', enabled: true }, 'GM', 1_000_100, id)
  assert.equal(publicResults(on, game(2)).presentation.kind, 'ranking')
})

test('new games reset all points/results while preserving whether scoring was enabled', () => {
  const s = fill(createScoring('game-one', true), 1)
  const next = syncScoring(s, { ...game(0, false), gameId: 'game-two' })
  assert.equal(next.enabled, true)
  assert.equal(next.gameId, 'game-two')
  assert.deepEqual(next.entries, [])
  assert.deepEqual(next.history, [])
  assert.deepEqual(next.completed, [])
  assert.deepEqual(next.dismissed, [])
})

test('clear empties all score records without changing scoring mode or completed game rounds', () => {
  const populated = syncScoring(fill(createScoring('game-one', true), 1), game(2))
  const before = { ...populated, dismissed: [1] }
  const cleared = applyScoringCommand(before, { type: 'scoresClear', expectedRevision: before.revision }, 'GM-clear', 1_020_000, id)
  assert.equal(cleared.gameId, before.gameId)
  assert.equal(cleared.enabled, true)
  assert.deepEqual(cleared.completed, before.completed)
  assert.deepEqual(cleared.dismissed, before.dismissed)
  assert.deepEqual(cleared.entries, [])
  assert.deepEqual(cleared.history, [])
  assert(Object.values(scoreTotals(cleared)).every(value => value === 0))
  assert.equal(cleared.lastCleared.actor, 'GM-clear')
  assert.equal(publicResults(cleared, game(2)).presentation, null)
  assertScoring(cleared)
  // A pending blank-slot form from before clear must not repopulate the erased records.
  const draft = { type: 'scoreSet', round: 2, room: 'a', factionId: FACTION_IDS[0], role: 'vip', expectedEntryRevision: null }
  assert.throws(() => applyScoringCommand(cleared, draft, 'GM-stale', 1_021_000, id), ScoreConflict)
  const fresh = applyScoringCommand(cleared, { ...draft, expectedClearRevision: cleared.lastCleared.revision }, 'GM-fresh', 1_021_000, id)
  assert.equal(scoreTotals(fresh)[FACTION_IDS[0]], 3)
  const off = applyScoringCommand(fresh, { type: 'scoresEnable', enabled: false }, 'GM', 1_022_000, id)
  const emptyOff = applyScoringCommand(off, { type: 'scoresClear', expectedRevision: off.revision }, 'GM', 1_023_000, id)
  assert.equal(emptyOff.enabled, false)
  assert.equal(emptyOff.entries.length, 0)
  assert.equal(syncScoring(emptyOff, { ...game(0, false), gameId: 'game-two' }).lastCleared, undefined)
})

test('clear rejects stale approval and malformed revisions instead of losing another GM input', () => {
  const original = add(createScoring('game-one', true), FACTION_IDS[0], 'vip')
  const changed = add(original, FACTION_IDS[1], 'pretender')
  assert.throws(() => applyScoringCommand(changed, { type: 'scoresClear', expectedRevision: original.revision }, 'GM-clear', 1_001_000, id), ScoreConflict)
  assert.equal(changed.entries.length, 2)
  for (const expectedRevision of [undefined, -1, 1.5, '1']) assert.equal(isScoringCommand({ type: 'scoresClear', expectedRevision }), false)
  assert.equal(isScoringCommand({ type: 'scoreSet', round: 1, room: 'a', factionId: FACTION_IDS[0], role: 'vip', expectedEntryRevision: null, expectedClearRevision: -1 }), false)
  assert.throws(() => assertScoring({ ...changed, lastCleared: { actor: 'GM', at: 1_001_000, revision: changed.revision + 1 } }))
})

test('invalid or duplicated saved scoring records fail validation instead of resetting results', () => {
  const valid = fill(createScoring('game-one', true), 1)
  assertScoring(valid)
  for (const mutate of [s => { s.version = 99 }, s => { s.entries.push(s.entries[0]) }, s => { s.entries[0].role = 'gambler' },
    s => { s.entries[0].key = scoreKey(2, 'a', FACTION_IDS[0]) }, s => { s.history[0].after = 'leader' }]) {
    const invalid = structuredClone(valid); mutate(invalid); assert.throws(() => assertScoring(invalid))
  }
})
