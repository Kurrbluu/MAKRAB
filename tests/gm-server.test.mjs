import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { get } from 'node:http'
import { FACTION_IDS } from '../src/data/factionIds.ts'
import { createGameHost } from '../server/host.mjs'
import { scoringHost } from './helpers/scoring-host.mjs'

const command = (factionId, role, room = 'a', round = 1, expectedEntryRevision = null) => ({ type: 'scoreSet', factionId, role, room, round, expectedEntryRevision })
function assertPublicOnly(value) {
  const forbidden = new Set(['scoring', 'entries', 'history', 'totals', 'points', 'role', 'actor', 'gmPin', 'pinHint', 'pin'])
  const visit = object => {
    if (!object || typeof object !== 'object') return
    for (const [key, child] of Object.entries(object)) { assert(!forbidden.has(key), `Private field leaked: ${key}`); visit(child) }
  }
  visit(value)
  assert(!JSON.stringify(value).includes('246810'))
}
async function fill(f, cookie, round, rolesA = ['vip', 'pretender', 'warden', 'civilian'], rolesB = ['civilian', 'vip', 'warden', 'pretender']) {
  for (const [index, faction] of FACTION_IDS.entries()) {
    assert.equal((await f.gm(cookie, command(faction, rolesA[index], 'a', round))).status, 200)
    assert.equal((await f.gm(cookie, command(faction, rolesB[index], 'b', round))).status, 200)
  }
}
async function expire(f, phaseIndex, at) {
  f.setNow(at)
  assert.equal((await f.core({ type: 'phase', index: phaseIndex, start: false })).status, 200)
  assert.equal((await f.core({ type: 'duration', durationMs: 1000 })).status, 200)
  const started = await f.core({ type: 'toggle' })
  assert.equal(started.status, 200)
  f.setNow(started.body.state.rundown.bank.timers.movement.deadline + 1)
  return f.publicState()
}

test('GM APIs require PIN/cookie access and never expose scores in public snapshots or SSE', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  assert.equal((await f.request('/api/gm/session')).status, 401)
  assert.equal((await f.request('/api/gm/command', { body: { command: { type: 'scoresEnable', enabled: true } } })).status, 401)
  assert.equal((await f.request('/api/gm/login', { body: { pin: '111111', name: 'Guest' } })).status, 401)
  const login = await f.login('GM test')
  assert.equal(login.status, 200)
  assert(login.cookie)
  assert.equal(login.body.actor, 'GM test')
  const stream = await f.events()
  assertPublicOnly(await stream.next())
  const enabled = await f.gm(login.cookie, { type: 'scoresEnable', enabled: true })
  assert.equal(enabled.status, 200)
  assertPublicOnly(await stream.next(1))
  assert.equal((await f.gm(login.cookie, command(FACTION_IDS[1], 'pretender'))).status, 200)
  assert.equal((await f.request('/api/gm/session', { cookie: login.cookie })).body.totals[FACTION_IDS[1]], -3)
  assertPublicOnly(await f.publicState())
  assert.equal((await f.request('/api/gm/logout', { cookie: login.cookie, method: 'POST' })).status, 200)
  assert.equal((await f.request('/api/gm/session', { cookie: login.cookie })).status, 401)
  stream.close()
})

test('the active PIN hint is available only to the local operator and stays out of public game data', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  const local = await fetch(f.address() + '/api/gm/login-info')
  assert.equal(local.status, 200)
  assert.equal(local.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await local.json(), { pinHint: '246810' })
  const requestHint = headers => new Promise((resolve, reject) => {
    get(f.address() + '/api/gm/login-info', { headers }, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { body += chunk })
      response.on('end', () => resolve(JSON.parse(body)))
      response.on('error', reject)
    }).on('error', reject)
  })
  for (const headers of [{ 'X-Forwarded-For': '192.168.1.50' }, { 'X-Forwarded-For': '127.0.0.1, 192.168.1.50' }, { Host: 'game.example' }]) {
    assert.deepEqual(await requestHint(headers), { pinHint: null }, JSON.stringify(headers))
  }
  assert.equal((await f.request('/api/gm/session')).status, 401)
  assertPublicOnly(await f.publicState())
  const events = await f.events()
  assertPublicOnly(await events.next())
  events.close()
})

test('separate GM phones can record the same picker in different rooms concurrently without lost points', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  const a = await f.login('GM-a'), b = await f.login('GM-b')
  await f.gm(a.cookie, { type: 'scoresEnable', enabled: true })
  const gameId = (await f.publicState()).state.gameId
  const values = await Promise.all([
    f.gm(a.cookie, command(FACTION_IDS[1], 'pretender', 'a'), { gameId }),
    f.gm(b.cookie, command(FACTION_IDS[1], 'vip', 'b'), { gameId }),
  ])
  assert(values.every(value => value.status === 200))
  const current = await f.request('/api/gm/session', { cookie: a.cookie })
  assert.equal(current.body.scoring.entries.length, 2)
  assert.equal(current.body.totals[FACTION_IDS[1]], 0)
  assert.deepEqual(current.body.scoring.history.map(event => event.actor).sort(), ['GM-a', 'GM-b'])
})

test('direct point input fills eight-note groups without a manual Exchange choice and preserves deduplication', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  const gm = await f.login('GM')
  await f.gm(gm.cookie, { type: 'scoresEnable', enabled: true })
  let last, lastCommand
  for (const round of [1, 2, 3]) {
    for (const room of ['a', 'b']) for (const factionId of FACTION_IDS) {
      lastCommand = { type: 'scoreAdd', expectedRound: round, room, factionId, role: 'warden' }
      last = await f.gm(gm.cookie, lastCommand, { id: `add-${round}-${room}-${factionId}` })
      assert.equal(last.status, 200)
    }
    assert.equal(last.body.scoring.entries.length, round * 8)
    assert.equal(last.body.scoring.entries.filter(value => value.round === round).length, 8)
  }
  const duplicate = await f.gm(gm.cookie, lastCommand, { id: `add-3-b-${FACTION_IDS.at(-1)}` })
  assert.equal(duplicate.status, 200)
  assert.equal(duplicate.body.scoring.entries.length, 24)
  assert.equal((await f.gm(gm.cookie, lastCommand)).status, 409)
  assert(Object.values(duplicate.body.totals).every(value => value === 6))
  const complete = await expire(f, 9, 1_010_000)
  assert.equal(complete.state.results.presentation.kind, 'ranking')
  assertPublicOnly(complete)
})

test('concurrent last-slot inputs cannot accidentally add the same player to the next group', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  const a = await f.login('GM-a'), b = await f.login('GM-b')
  await f.gm(a.cookie, { type: 'scoresEnable', enabled: true })
  for (const room of ['a', 'b']) for (const factionId of FACTION_IDS) {
    if (room === 'b' && factionId === FACTION_IDS.at(-1)) continue
    await f.gm(a.cookie, { type: 'scoreAdd', expectedRound: 1, room, factionId, role: 'warden' })
  }
  const command = { type: 'scoreAdd', expectedRound: 1, room: 'b', factionId: FACTION_IDS.at(-1), role: 'vip' }
  const gameId = (await f.publicState()).state.gameId
  const attempts = await Promise.all([f.gm(a.cookie, command, { gameId }), f.gm(b.cookie, command, { gameId })])
  assert.deepEqual(attempts.map(value => value.status).sort(), [200, 409])
  const current = (await f.request('/api/gm/session', { cookie: a.cookie })).body.scoring
  assert.equal(current.entries.length, 8)
  assert(current.entries.every(entry => entry.round === 1))
  assert.equal((await f.gm(b.cookie, { ...command, expectedRound: 2 })).status, 200)
})

test('duplicate requests are idempotent and conflicting edits cannot overwrite another GM', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  const a = await f.login('GM-a'), b = await f.login('GM-b')
  await f.gm(a.cookie, { type: 'scoresEnable', enabled: true })
  const body = command(FACTION_IDS[0], 'vip')
  const first = await f.gm(a.cookie, body, { id: 'saved-result' })
  assert.equal(first.status, 200)
  const retry = await f.gm(a.cookie, body, { id: 'saved-result' })
  assert.equal(retry.status, 200)
  assert.equal(retry.body.scoring.history.length, 1)
  assert.equal(retry.body.totals[FACTION_IDS[0]], 3)
  assert.equal((await f.gm(a.cookie, command(FACTION_IDS[0], 'warden'), { id: 'saved-result' })).status, 409)
  const revision = first.body.scoring.entries[0].revision
  const edits = await Promise.all([
    f.gm(a.cookie, command(FACTION_IDS[0], 'civilian', 'a', 1, revision)),
    f.gm(b.cookie, command(FACTION_IDS[0], 'pretender', 'a', 1, revision)),
  ])
  assert.deepEqual(edits.map(value => value.status).sort(), [200, 409])
  const current = (await f.request('/api/gm/session', { cookie: a.cookie })).body
  assert.equal(current.scoring.entries.length, 1)
  assert.equal(current.scoring.history.length, 2)
  assert([-1, -3].includes(current.totals[FACTION_IDS[0]]))
  const deleted = await f.gm(a.cookie, { type: 'scoreDelete', round: 1, room: 'a', factionId: FACTION_IDS[0], expectedEntryRevision: current.scoring.entries[0].revision })
  assert.equal(deleted.status, 200)
  assert.equal(deleted.body.totals[FACTION_IDS[0]], 0)
})

test('all full Exchanges auto-show cumulative ranking, exclude Gambler, and finish after ranking 3', { timeout: 15_000 }, async t => {
  const f = await scoringHost(t)
  const gm = await f.login('GM')
  await f.gm(gm.cookie, { type: 'scoresEnable', enabled: true })
  await fill(f, gm.cookie, 1)
  const initial = await f.core({ type: 'phase', index: 2, start: false })
  assert.equal(initial.body.state.results.presentation, null)
  const one = await expire(f, 2, 1_010_000)
  assert.equal(one.state.results.presentation.kind, 'ranking')
  assert.equal(one.state.results.presentation.round, 1)
  assert.deepEqual(one.state.results.presentation.places.map(place => place.rank), [1, 1, 3, 4])
  assertPublicOnly(one)
  assert.equal((await f.core({ type: 'toggle' })).status, 400)
  const next = await f.core({ type: 'resultsNext' })
  assert.equal(next.status, 200)
  assert.equal(next.body.state.rundown.phaseIndex, 3)
  assert(next.body.state.presentation)
  assert.equal(next.body.state.results.presentation, null)
  await fill(f, gm.cookie, 2, ['warden', 'vip', 'warden', 'warden'], ['warden', 'vip', 'warden', 'warden'])
  const gambler = await expire(f, 5, 1_020_000)
  assert.equal(gambler.state.results.presentation, null)
  const two = await expire(f, 6, 1_030_000)
  assert.equal(two.state.results.presentation.kind, 'ranking')
  assert.equal(two.state.results.presentation.round, 2)
  assert.equal(two.state.results.presentation.places[0].factionId, FACTION_IDS[1])
  assertPublicOnly(two)
  await f.core({ type: 'resultsNext' })
  await fill(f, gm.cookie, 3)
  const three = await expire(f, 9, 1_040_000)
  assert.equal(three.state.results.presentation.kind, 'ranking')
  assert.equal(three.state.results.presentation.round, 3)
  const done = await f.core({ type: 'resultsNext' })
  assert.equal(done.status, 200)
  assert.equal(done.body.state.results.presentation, null)
  assert.equal(done.body.state.rundown.phaseIndex, 9)
  assert.equal(done.body.state.rundown.bank.timers.movement.remainingMs, 0)
})

test('incomplete results show waiting and the last valid record automatically switches both subscribers to ranking', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  const gm = await f.login('GM')
  await f.gm(gm.cookie, { type: 'scoresEnable', enabled: true })
  for (const faction of FACTION_IDS) await f.gm(gm.cookie, command(faction, 'warden', 'a'))
  for (const faction of FACTION_IDS.slice(0, 3)) await f.gm(gm.cookie, command(faction, 'civilian', 'b'))
  const waiting = await expire(f, 2, 1_010_000)
  assert.equal(waiting.state.results.presentation.kind, 'waiting')
  assert.equal((await f.core({ type: 'resultsNext' })).status, 400)
  const a = await f.events(), b = await f.events()
  await a.next(); await b.next()
  await f.gm(gm.cookie, command(FACTION_IDS[3], 'civilian', 'b'))
  const current = await f.publicState()
  assert.equal(current.state.results.presentation.kind, 'ranking')
  assert.deepEqual((await a.next(current.state.revision)).state, (await b.next(current.state.revision)).state)
  assertPublicOnly(current)
  a.close(); b.close()
})

test('optional mode can be disabled mid-result, and new games reject pending inputs for the previous game', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  const gm = await f.login('GM')
  await f.gm(gm.cookie, { type: 'scoresEnable', enabled: true })
  await fill(f, gm.cookie, 1)
  await expire(f, 2, 1_010_000)
  await f.gm(gm.cookie, { type: 'scoresEnable', enabled: false })
  assert.equal((await f.publicState()).state.results.presentation, null)
  const privateData = (await f.request('/api/gm/session', { cookie: gm.cookie })).body
  assert.equal(privateData.scoring.entries.length, 8)
  assert.equal((await f.gm(gm.cookie, command(FACTION_IDS[0], 'vip', 'a', 2))).status, 400)
  const priorGame = privateData.scoring.gameId
  await f.core({ type: 'newGame' })
  const fresh = (await f.request('/api/gm/session', { cookie: gm.cookie })).body
  assert.notEqual(fresh.scoring.gameId, priorGame)
  assert.deepEqual(fresh.scoring.entries, [])
  assert.equal((await f.gm(gm.cookie, command(FACTION_IDS[0], 'vip'), { gameId: priorGame })).status, 409)
})

test('restart restores scores, corrections, ranking, and deduplication while requiring GM login again', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  let gm = await f.login('GM')
  await f.gm(gm.cookie, { type: 'scoresEnable', enabled: true })
  await fill(f, gm.cookie, 1)
  const privateData = (await f.request('/api/gm/session', { cookie: gm.cookie })).body
  const entry = privateData.scoring.entries.find(value => value.factionId === FACTION_IDS[0] && value.room === 'a')
  const correction = command(FACTION_IDS[0], 'pretender', 'a', 1, entry.revision)
  await f.gm(gm.cookie, correction, { id: 'persisted-correction' })
  const ranking = await expire(f, 2, 1_010_000)
  const saved = JSON.parse(await readFile(f.stateFile, 'utf8'))
  await f.stop(); await f.start()
  assert.equal((await f.request('/api/gm/session', { cookie: gm.cookie })).status, 401)
  assert.deepEqual((await f.publicState()).state, ranking.state)
  gm = await f.login('GM')
  assert.deepEqual((await f.request('/api/gm/session', { cookie: gm.cookie })).body.scoring, saved.scoring)
  const duplicate = await f.gm(gm.cookie, correction, { id: 'persisted-correction' })
  assert.equal(duplicate.status, 200)
  assert.equal(duplicate.body.scoring.history.length, 9)
  assertPublicOnly(await f.publicState())
})

test('invalid roles, slot data, and corrupt saved score files are rejected', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  const gm = await f.login('GM')
  await f.gm(gm.cookie, { type: 'scoresEnable', enabled: true })
  for (const role of ['gambler', 'leader', ['vip']]) assert.equal((await f.gm(gm.cookie, command(FACTION_IDS[0], role))).status, 400)
  assert.equal((await f.gm(gm.cookie, command('other-faction', 'vip'))).status, 400)
  assert.equal((await f.gm(gm.cookie, command(FACTION_IDS[0], 'vip', 'a', 4))).status, 400)
  const raw = JSON.parse(await readFile(f.stateFile, 'utf8'))
  await f.stop()
  raw.scoring.version = 99
  const corrupted = JSON.stringify(raw)
  await writeFile(f.stateFile, corrupted)
  assert.throws(() => createGameHost({ stateDirectory: f.stateDirectory, distDirectory: f.distDirectory }), /File progres .*tidak valid/)
  assert.equal(await readFile(f.stateFile, 'utf8'), corrupted)
})

test('GM clear preserves the running timer and targets, survives restart, and deduplicates safely', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  let gm = await f.login('GM-clear')
  await f.gm(gm.cookie, { type: 'scoresEnable', enabled: true })
  await fill(f, gm.cookie, 1)
  await f.core({ type: 'phase', index: 1, start: true })
  const before = await f.publicState()
  const records = (await f.request('/api/gm/session', { cookie: gm.cookie })).body
  const clear = { type: 'scoresClear', expectedRevision: records.scoring.revision }
  const cleared = await f.gm(gm.cookie, clear, { id: 'clear-once' })
  assert.equal(cleared.status, 200)
  assert.deepEqual(cleared.body.scoring.entries, [])
  assert.deepEqual(cleared.body.scoring.history, [])
  assert(Object.values(cleared.body.totals).every(value => value === 0))
  const after = await f.publicState()
  for (const field of ['gameId', 'rundown', 'draws', 'presentation', 'cue']) assert.deepEqual(after.state[field], before.state[field])
  assert.equal(after.state.results.enabled, true)
  assert.equal((await f.gm(gm.cookie, command(FACTION_IDS[0], 'vip', 'a', 2))).status, 409)
  const fresh = { ...command(FACTION_IDS[0], 'vip', 'a', 2), expectedClearRevision: cleared.body.scoring.lastCleared.revision }
  assert.equal((await f.gm(gm.cookie, fresh)).status, 200)
  assert.equal((await f.gm(gm.cookie, clear, { id: 'clear-once' })).body.scoring.entries.length, 1)
  await f.stop(); await f.start()
  gm = await f.login('GM-clear')
  const restored = (await f.request('/api/gm/session', { cookie: gm.cookie })).body
  assert.equal(restored.scoring.lastCleared.actor, 'GM-clear')
  assert.equal(restored.scoring.entries.length, 1)
  assertPublicOnly(await f.publicState())
})

test('clear cannot erase an intervening edit and switches both projected rankings back to waiting', { timeout: 10_000 }, async t => {
  const f = await scoringHost(t)
  const a = await f.login('GM-a'), b = await f.login('GM-b')
  await f.gm(a.cookie, { type: 'scoresEnable', enabled: true })
  await fill(f, a.cookie, 1)
  await expire(f, 2, 1_010_000)
  const review = (await f.request('/api/gm/session', { cookie: a.cookie })).body.scoring
  const entry = review.entries[0]
  await f.gm(b.cookie, command(entry.factionId, 'pretender', entry.room, entry.round, entry.revision))
  assert.equal((await f.gm(a.cookie, { type: 'scoresClear', expectedRevision: review.revision })).status, 409)
  const latest = (await f.request('/api/gm/session', { cookie: a.cookie })).body.scoring
  assert.equal(latest.entries.length, 8)
  const left = await f.events(), right = await f.events()
  await left.next(); await right.next()
  const cleared = await f.gm(a.cookie, { type: 'scoresClear', expectedRevision: latest.revision })
  assert.equal(cleared.status, 200)
  const current = await f.publicState()
  assert.equal(current.state.results.presentation.kind, 'waiting')
  assert.deepEqual((await left.next(current.state.revision)).state, (await right.next(current.state.revision)).state)
  assertPublicOnly(current)
  left.close(); right.close()
})
