import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { cloudDatabase } from './helpers/cloud-store.mjs'
import { createCloudHandler, cloudConfiguration } from '../server/cloud-api.mjs'
import { createSessionDocument, advanceSession, coreTransition, scoringTransition, assertSessionDocument } from '../server/session-engine.mjs'
import { FACTION_IDS } from '../src/data/factionIds.ts'
import { createServerClock } from '../src/lib/serverClock.ts'
import { readFileSync } from 'node:fs'
import { createSupabaseStore } from '../server/supabase-store.mjs'

const configuration = { url: 'https://test.supabase.co', secretKey: 'sb_secret_test', publishableKey: 'sb_publishable_test', pin: '246810', sessionKey: 'makrab-big-game' }
async function fixture(t, { rewrite } = {}) {
  let now = 1_000_000
  const clock = () => now
  const database = await cloudDatabase({ clock })
  const handlers = [0, 1].map(() => createCloudHandler({ configuration, store: database.store(), clock }))
  const routeConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const server = createServer((request, response) => {
    const index = request.url.startsWith('/two') ? 1 : 0
    request.url = request.url.replace(/^\/(one|two)/, '')
    if (rewrite) {
      const original = new URL(request.url, 'https://localhost')
      const wildcard = original.pathname.slice('/api/'.length)
      const destination = new URL(routeConfig.rewrites[0].destination.replace(':path*', wildcard), 'https://localhost')
      request.query = { ...Object.fromEntries(original.searchParams), ...Object.fromEntries(destination.searchParams) }
      request.url = rewrite === 'query-only' ? Object.keys(routeConfig.functions)[0].replace(/^/, '/') : destination.pathname + destination.search
    }
    void handlers[index](request, response)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = `http://127.0.0.1:${server.address().port}`
  const request = async (path, { body, raw, cookie, instance = 'one', method = body !== undefined || raw !== undefined ? 'POST' : 'GET', headers = {} } = {}) => {
    const response = await fetch(`${address}/${instance}${path}`, { method, headers: { ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) })
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie'), headers: response.headers }
  }
  const login = async (name = 'GM', instance = 'one') => request('/api/gm/login', { instance, body: { name, pin: configuration.pin } })
  const state = async () => (await request('/api/session')).body.state
  const gm = async (cookie, command, options = {}) => request('/api/gm/command', { cookie, instance: options.instance, body: { commandId: options.id ?? crypto.randomUUID(), gameId: options.gameId ?? (await state()).gameId, command } })
  const core = async (cookie, command, options = {}) => request('/api/command', { cookie, instance: options.instance, body: { commandId: options.id ?? crypto.randomUUID(), expectedRevision: options.revision ?? (await state()).revision, command } })
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await database.close() })
  return { ...database, request, login, gm, core, state, setNow: value => { now = value }, replace: (index, config = configuration) => { handlers[index] = createCloudHandler({ configuration: config, store: database.store(), clock }) } }
}

test('online metadata exposes only public keys, and public viewers cannot control timer or access scores', async t => {
  const f = await fixture(t)
  const metadata = await f.request('/api/meta')
  assert.equal(metadata.body.transport, 'supabase')
  assert(!JSON.stringify(metadata.body).includes(configuration.secretKey))
  assert(!JSON.stringify(metadata.body).includes(configuration.pin))
  assert.deepEqual((await f.request('/api/gm/login-info')).body, { pinHint: null })
  assert.deepEqual((await f.request('/api/access')).body, { canControl: false })
  assert.equal((await f.request('/api/gm/session')).status, 401)
  assert.equal((await f.core(undefined, { type: 'begin' })).status, 401)
  assert.equal((await f.state()).active, false)
  assert.equal((await f.request('/api?route=session')).status, 200)
  assert.equal((await f.request('/api/?route=session')).status, 200)
  assert.equal((await f.request('/api/index/?route=session')).status, 200)
  assert.equal((await f.request('/api/session/')).status, 200)
  assert.equal((await f.request('/api/session')).headers.get('cache-control'), 'no-store')
})

test('GM auth survives independent functions and restarts, and logout revokes timer access everywhere', async t => {
  const f = await fixture(t), logged = await f.login('GM Satu')
  assert.equal(logged.status, 200)
  for (const field of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api']) assert(logged.cookie.includes(field))
  const cookie = logged.cookie.split(';')[0]
  f.replace(1)
  assert.deepEqual((await f.request('/api/access', { cookie, instance: 'two' })).body, { canControl: true })
  assert.equal((await f.request('/api/gm/session', { cookie, instance: 'two' })).body.actor, 'GM Satu')
  assert.equal((await f.core(cookie, { type: 'begin' }, { instance: 'two' })).status, 200)
  assert.equal((await f.request('/api/gm/logout', { cookie, instance: 'two', method: 'POST' })).status, 200)
  assert.equal((await f.core(cookie, { type: 'home' })).status, 401)
  assert.equal((await f.request('/api/gm/session', { cookie })).status, 401)
})

test('PIN rotation and expiration invalidate persisted sessions', async t => {
  const f = await fixture(t), cookie = (await f.login()).cookie.split(';')[0]
  f.replace(1, { ...configuration, pin: '135790' })
  assert.equal((await f.request('/api/gm/session', { cookie, instance: 'two' })).status, 401)
  f.setNow(1_000_000 + 12 * 60 * 60 * 1000)
  assert.equal((await f.request('/api/gm/session', { cookie })).status, 401)
})

test('concurrent GM inputs use SQL compare-and-swap and publish ranking without exposing scores', async t => {
  const f = await fixture(t), first = (await f.login('GM Satu')).cookie.split(';')[0], second = (await f.login('GM Dua', 'two')).cookie.split(';')[0]
  await f.gm(first, { type: 'scoresEnable', enabled: true })
  await f.core(first, { type: 'phase', index: 2, start: true })
  const deadline = (await f.state()).rundown.bank.timers.movement.deadline
  const inputs = ['a', 'b'].flatMap(room => FACTION_IDS.map((factionId, index) => f.gm(room === 'a' ? first : second, { type: 'scoreAdd', expectedRound: 1, room, factionId, role: ['vip', 'pretender', 'warden', 'civilian'][index] }, { instance: room === 'a' ? 'one' : 'two' })))
  const results = await Promise.all(inputs)
  assert(results.every(result => result.status === 200), results.map(result => JSON.stringify(result.body)).join('\n'))
  const gm = await f.request('/api/gm/session', { cookie: first })
  assert.equal(gm.body.scoring.entries.length, 8)
  assert.equal(gm.body.totals[FACTION_IDS[0]], 6)
  assert.equal(gm.body.totals[FACTION_IDS[1]], -6)
  assert.equal((await f.state()).results.presentation, null)
  f.setNow(deadline + 1)
  const publicState = await f.state()
  assert.equal(publicState.results.presentation.kind, 'ranking')
  assert.deepEqual(publicState.results.presentation.places.map(value => value.rank), [1, 2, 3, 4])
  const projected = (await f.db.query('select state from public.makrab_public_sessions')).rows[0].state
  assert.deepEqual(projected, publicState)
  for (const key of ['points', 'totals', 'actor', 'history', 'scoring', 'entries', 'gmPin']) assert(!JSON.stringify(projected).includes(`"${key}"`))
  assert.equal((await f.core(first, { type: 'resultsNext' })).status, 200)
  assert.equal((await f.state()).rundown.phaseIndex, 3)
})

test('durable command IDs prevent duplicate writes and stale timer/edit/clear inputs are rejected', async t => {
  const f = await fixture(t), cookie = (await f.login()).cookie.split(';')[0]
  await f.gm(cookie, { type: 'scoresEnable', enabled: true })
  const command = { type: 'scoreAdd', expectedRound: 1, room: 'a', factionId: FACTION_IDS[0], role: 'vip' }, id = 'same-input'
  assert.equal((await f.gm(cookie, command, { id })).status, 200)
  f.replace(1)
  assert.equal((await f.gm(cookie, command, { id, instance: 'two' })).status, 200)
  assert.equal((await f.gm(cookie, { ...command, role: 'pretender' }, { id })).status, 409)
  const saved = (await f.request('/api/gm/session', { cookie })).body.scoring
  assert.equal(saved.entries.length, 1)
  assert.equal(saved.history.length, 1)
  await f.gm(cookie, { ...command, factionId: FACTION_IDS[1] })
  assert.equal((await f.gm(cookie, { type: 'scoresClear', expectedRevision: saved.revision })).status, 409)
  const current = await f.state()
  await f.core(cookie, { type: 'begin' })
  assert.equal((await f.core(cookie, { type: 'duration', durationMs: 30_000 }, { revision: current.revision })).status, 409)
  assert.equal((await f.gm(cookie, { ...command, role: 'gambler' })).status, 400)
  assert.equal((await f.gm(cookie, { ...command, role: 'leader' })).status, 400)
})

test('wrong PIN limits persist across instances, reset after a minute, and do not leak the PIN', async t => {
  const f = await fixture(t)
  for (let index = 0; index < 6; index++) assert.equal((await f.request('/api/gm/login', { instance: index % 2 ? 'one' : 'two', body: { pin: '000000' } })).status, 401)
  f.replace(0)
  assert.equal((await f.login()).status, 429)
  f.setNow(1_060_000)
  assert.equal((await f.login()).status, 200)
})

test('cloud endpoints reject cross-site requests, malformed bodies and missing configuration', async t => {
  const f = await fixture(t), cookie = (await f.login()).cookie.split(';')[0]
  assert.equal((await f.request('/api/session', { headers: { Origin: 'https://wrong.example' } })).status, 403)
  assert.equal((await f.request('/api/session', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403)
  assert.equal((await f.request('/api/command', { cookie, raw: 'bad json' })).status, 400)
  assert.equal((await f.request('/api/command', { cookie, raw: '[]' })).status, 400)
  assert.equal((await f.request('/api/command', { cookie, raw: 'x'.repeat(16_385) })).status, 413)
  assert.equal((await f.request('/api/command', { cookie, method: 'POST' })).status, 415)
  f.replace(0, null)
  assert.equal((await f.request('/api/session')).status, 503)
  const env = { SUPABASE_URL: configuration.url, SUPABASE_SECRET_KEY: configuration.secretKey, SUPABASE_PUBLISHABLE_KEY: configuration.publishableKey, MAKRAB_GM_PIN: configuration.pin }
  assert(cloudConfiguration(env))
  assert.equal(cloudConfiguration({ ...env, SUPABASE_PUBLISHABLE_KEY: configuration.secretKey }), null)
  assert.equal(cloudConfiguration({ ...env, MAKRAB_GM_PIN: 'abc123' }), null)
})

test('SQL installs repeatedly, keeps private data inaccessible and public projection read-only', async t => {
  const f = await fixture(t)
  await f.db.exec(f.schema)
  await f.state()
  await f.db.exec('set role anon')
  assert.equal((await f.db.query('select * from public.makrab_public_sessions')).rows.length, 1)
  await assert.rejects(f.db.query('select * from public.makrab_game_sessions'), /permission denied/)
  await assert.rejects(f.db.query('select * from public.makrab_gm_sessions'), /permission denied/)
  await assert.rejects(f.db.query('select * from public.makrab_login_limits'), /permission denied/)
  await assert.rejects(f.db.query('delete from public.makrab_public_sessions'), /permission denied/)
  await assert.rejects(f.db.query('select public.makrab_compare_session($1,$2,$3)', ['makrab-big-game', 0, {}]), /permission denied/)
  await f.db.exec('reset role')
  assert.deepEqual((await f.db.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")).rows, [{ tablename: 'makrab_public_sessions' }])
  await assert.rejects(f.db.query("update public.makrab_public_sessions set state = state || '{\"points\":3}'::jsonb"), /check constraint/)
})

test('JSONB ordering causes no revision churn, race-safe initialization keeps one session, and deadlines advance on reads', async t => {
  const f = await fixture(t)
  const initial = await Promise.all([f.store().transact(document => ({ document })), f.store().transact(document => ({ document }))])
  assert.equal(initial[0].document.state.gameId, initial[1].document.state.gameId)
  for (let index = 0; index < 4; index++) await f.state()
  assert.equal((await f.db.query('select store_version from public.makrab_game_sessions')).rows[0].store_version, 0)
  const cookie = (await f.login()).cookie.split(';')[0]
  await f.core(cookie, { type: 'begin' })
  const started = await f.state(), due = started.presentation.completesAt
  f.setNow(due + 100)
  const advanced = await f.state()
  assert.equal(advanced.presentation, null)
  assert.equal(advanced.rundown.bank.timers.terawang.deadline, due + 90_000)
  assert.equal(advanced.cue.startsAt, due)
  assert.equal((await f.request('/api/session', { instance: 'two' })).body.state.revision, advanced.revision)
  assert.equal((await f.request('/api/session')).body.serverReceivedAt, due + 100)
})

test('private-field validation refuses contaminated public state; clock excludes database processing time', () => {
  const document = createSessionDocument(1_000_000)
  assertSessionDocument(document)
  assert.throws(() => assertSessionDocument({ ...document, state: { ...document.state, points: 3 } }), /privat/)
  const reversed = JSON.parse(JSON.stringify(document), (key, value) => value && !Array.isArray(value) && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse()) : value)
  assert.equal(advanceSession(reversed, 1_000_100), reversed)
  const clock = createServerClock(() => 2000)
  // 20 ms network each way plus 900 ms processing; server is 500 ms ahead.
  clock.observe(2420, 1000, 1940, 1520)
  assert.equal(clock.now(), 2500)
  const core = coreTransition(document, { commandId: 'begin', expectedRevision: 0, command: { type: 'begin' } }, 1_000_000)
  assert.equal(core.status, 200)
  assert.equal(scoringTransition(document, { commandId: 'bad', gameId: document.state.gameId, command: { type: 'scoreAdd', role: 'leader' } }, 'GM', 1_000_000).status, 400)
})

for (const rewrite of ['url', 'query-only']) test(`Vercel ${rewrite} rewrite reads the public session and preserves GM login, cookies and both rooms`, async t => {
  const f = await fixture(t, { rewrite })
  const initial = await f.request('/api/session?route=unrelated-client-query')
  assert.equal(initial.status, 200)
  assert.equal(initial.headers.get('x-makrab-api'), '2')
  assert(initial.body.state.gameId)
  assert.deepEqual((await f.request('/api/access')).body, { canControl: false })
  const unauthorized = await f.request('/api/gm/session')
  assert.equal(unauthorized.status, 401)
  assert.equal(unauthorized.body.code, 'GM_LOGIN_REQUIRED')
  const one = (await f.login('Operator One')).cookie.split(';')[0]
  const two = (await f.login('Operator Two', 'two')).cookie.split(';')[0]
  assert.deepEqual((await f.request('/api/access', { cookie: one })).body, { canControl: true })
  assert.equal((await f.request('/api/gm/session', { cookie: two, instance: 'two' })).status, 200)
  assert.equal((await f.gm(one, { type: 'scoresEnable', enabled: true })).status, 200)
  assert.equal((await f.core(one, { type: 'phase', index: 2, start: true })).status, 200)
  const inputs = await Promise.all([
    f.gm(one, { type: 'scoreAdd', expectedRound: 1, room: 'a', factionId: FACTION_IDS[0], role: 'vip' }),
    f.gm(two, { type: 'scoreAdd', expectedRound: 1, room: 'b', factionId: FACTION_IDS[0], role: 'pretender' }, { instance: 'two' }),
  ])
  assert(inputs.every(value => value.status === 200))
  const privateState = await f.request('/api/gm/session', { cookie: one })
  assert.equal(privateState.body.scoring.entries.length, 2)
  assert.equal(privateState.body.totals[FACTION_IDS[0]], 0)
  const publicState = (await f.request('/api/session', { instance: 'two' })).body
  assert.equal(publicState.state.rundown.phaseIndex, 2)
  assert(!/"(scoring|totals|entries|actor|history|gmPin)"/.test(JSON.stringify(publicState)))
  assert.equal((await f.request('/api/does-not-exist')).body.code, 'API_NOT_FOUND')
  assert.equal((await f.request('/api/gm/logout', { cookie: one, method: 'POST' })).status, 200)
  assert.equal((await f.request('/api/gm/session', { cookie: one, instance: 'two' })).status, 401)
})

test('invalid stored documents report a safe diagnostic without resetting database state', async t => {
  const f = await fixture(t, { rewrite: 'query-only' })
  await f.state()
  const before = (await f.db.query('select document from public.makrab_game_sessions')).rows[0].document
  const corrupt = { ...before, scoring: {} }
  await f.db.query('update public.makrab_game_sessions set document=$1', [corrupt])
  const response = await f.request('/api/session')
  assert.equal(response.status, 503)
  assert.equal(response.body.code, 'INVALID_STORED_SESSION')
  assert(!('state' in response.body))
  assert.deepEqual((await f.db.query('select document from public.makrab_game_sessions')).rows[0].document, corrupt)
})

test('Supabase permission failures are distinct from routing and never echo upstream secrets or data', async t => {
  const captured = []
  const store = createSupabaseStore({ url: configuration.url, secretKey: configuration.secretKey, fetchImpl: async () => Response.json({ error: 'private-upstream-sentinel' }, { status: 403 }) })
  const handler = createCloudHandler({ configuration, store, log: (...args) => { captured.push(args) } })
  let status, value
  await handler({ url: '/api/index.mjs', query: { __makrab_path: 'session' }, method: 'GET', headers: { host: 'localhost' }, socket: {} },
    { setHeader() {}, set statusCode(next) { status = next }, end(raw) { value = JSON.parse(raw) } })
  assert.equal(status, 503)
  assert.equal(value.code, 'SUPABASE_HTTP_ERROR')
  assert.equal(value.upstreamStatus, 403)
  const output = JSON.stringify([value, captured])
  assert(!output.includes('private-upstream-sentinel'))
  assert(!output.includes(configuration.secretKey))
  assert(!output.includes(configuration.pin))
})
