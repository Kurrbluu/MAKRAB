import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { subscribeCloud, readSessionMetadata } from '../src/lib/sessionTransport.ts'
import { createSharedGame } from '../src/lib/sharedGame.ts'

test('cloud transport requests confirmed database readiness and receives only its public session state', { timeout: 10_000 }, async t => {
  const server = createServer(), sockets = new WebSocketServer({ server })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let socket, socketPath, joinMessage, acceptJoin
  const joined = new Promise(resolve => { acceptJoin = resolve })
  sockets.on('connection', (incoming, request) => {
    socketPath = new URL(request.url, 'http://localhost').pathname
    socket = incoming
    incoming.on('message', raw => {
      const message = JSON.parse(raw.toString())
      const [joinRef, ref, topic, event] = message
      if (event === 'phx_join') { joinMessage = message; acceptJoin() }
      else if (event === 'phx_leave' || event === 'heartbeat') incoming.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]))
    })
  })
  let stop
  t.after(async () => {
    stop?.()
    for (const client of sockets.clients) client.terminate()
    await new Promise(resolve => sockets.close(resolve))
    await new Promise(resolve => server.close(resolve))
  })
  let ready = false, readyResolve, stateResolve
  const subscribed = new Promise(resolve => { readyResolve = resolve })
  const received = new Promise(resolve => { stateResolve = resolve })
  stop = await subscribeCloud({ transport: 'supabase', online: true, authRequired: true,
    url: `http://127.0.0.1:${server.address().port}/rest/v1/`, publishableKey: 'sb_publishable_test', sessionKey: 'event-test' },
    state => stateResolve(state), connected => { ready = connected; if (connected) readyResolve() })
  await joined
  assert.equal(socketPath, '/realtime/v1/websocket', 'a pasted REST endpoint must not become part of the Realtime URL')
  assert.equal(ready, false)
  const [joinRef, ref, topic, , payload] = joinMessage
  assert.equal(payload.config.postgres_changes_options.wait, true)
  assert.deepEqual(payload.config.postgres_changes, [{ event: '*', schema: 'public', table: 'makrab_public_sessions', filter: 'session_key=eq.event-test' }])
  socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: payload.config.postgres_changes.map(filter => ({ ...filter, id: 42 })) } }]))
  await subscribed
  const state = createSharedGame(Date.now(), () => 'transport-game')
  socket.send(JSON.stringify([joinRef, null, topic, 'postgres_changes', { ids: [42], data: {
    schema: 'public', table: 'makrab_public_sessions', type: 'UPDATE', commit_timestamp: new Date().toISOString(),
    columns: [{ name: 'session_key', type: 'text' }, { name: 'state', type: 'jsonb' }],
    record: { session_key: 'event-test', state }, old_record: {},
  } }]))
  assert.deepEqual(await received, state)
})

test('online metadata uses the Project URL even when setup contains a pasted REST endpoint', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  for (const url of ['https://project.supabase.co', 'https://project.supabase.co/rest/v1', 'https://project.supabase.co/rest/v1/']) {
    globalThis.fetch = async () => Response.json({ transport: 'supabase', online: true, authRequired: true,
      url, publishableKey: 'sb_publishable_test', sessionKey: 'event-test' })
    assert.equal((await readSessionMetadata()).url, 'https://project.supabase.co')
  }
})

test('missing backend setup is reported clearly and an older local host can still use SSE', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  globalThis.fetch = async () => Response.json({ error: 'Backend online belum dikonfigurasi.' }, { status: 503 })
  await assert.rejects(readSessionMetadata(), /belum dikonfigurasi/)
  globalThis.fetch = async () => Response.json({}, { status: 404 })
  assert.deepEqual(await readSessionMetadata(), { transport: 'sse', online: false, authRequired: false })
})
