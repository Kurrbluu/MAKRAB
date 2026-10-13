import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createServer } from 'vite'
import { scoringHost } from './helpers/scoring-host.mjs'

test('development preview connects to the game session and forwards GM auth and live events', { timeout: 20_000 }, async t => {
  const fixture = await scoringHost(t)
  const root = fileURLToPath(new URL('../', import.meta.url))
  const previous = process.env.MAKRAB_GAME_SERVER
  let preview
  try {
    process.env.MAKRAB_GAME_SERVER = fixture.address()
    preview = await createServer({ root, configFile: join(root, 'vite.config.ts'), cacheDir: join(fixture.stateDirectory, 'vite-cache'),
      logLevel: 'error', server: { host: '127.0.0.1', port: 0, strictPort: true, open: false }, optimizeDeps: { noDiscovery: true, include: [] } })
  } finally {
    if (previous === undefined) delete process.env.MAKRAB_GAME_SERVER
    else process.env.MAKRAB_GAME_SERVER = previous
  }
  t.after(() => preview.close())
  await preview.listen()
  const address = `http://127.0.0.1:${preview.httpServer.address().port}`
  const html = await (await fetch(address)).text()
  assert.match(html, /name="makrab-session" content="shared"/)
  const current = await (await fetch(address + '/api/session')).json()
  assert.equal(current.state.gameId, (await fixture.publicState()).state.gameId)
  assert.equal((await fetch(address + '/api/gm/session')).status, 401)
  const hint = await (await fetch(address + '/api/gm/login-info')).json()
  assert.deepEqual(hint, { pinHint: '246810' })

  const controller = new AbortController()
  t.after(() => controller.abort())
  const events = await fetch(address + '/api/events', { signal: controller.signal })
  assert.match(events.headers.get('content-type'), /text\/event-stream/)
  const reader = events.body.getReader()
  const event = new TextDecoder().decode((await reader.read()).value)
  assert(event.includes(current.state.gameId))
  controller.abort()

  const login = await fetch(address + '/api/gm/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: address }, body: JSON.stringify({ pin: '246810', name: 'Preview GM' }) })
  assert.equal(login.status, 200)
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Path=\/api\/gm/)
  const cookie = login.headers.get('set-cookie').split(';')[0]
  assert.equal((await login.json()).actor, 'Preview GM')
  const send = command => fetch(address + '/api/gm/command', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: address, Cookie: cookie }, body: JSON.stringify({ commandId: crypto.randomUUID(), gameId: current.state.gameId, command }) })
  assert.equal((await send({ type: 'scoresEnable', enabled: true })).status, 200)
  const saved = await send({ type: 'scoreSet', round: 1, room: 'a', factionId: 'vermilion-bird', role: 'pretender', expectedEntryRevision: null })
  assert.equal(saved.status, 200)
  assert.equal((await saved.json()).totals['vermilion-bird'], -3)
  const publicSession = await (await fetch(address + '/api/session')).text()
  assert(!/"(?:totals|scoring|entries|history|gmPin)"/.test(publicSession))

  // The standalone timer remains available when no shared game server is running.
  await fixture.stop()
  const standalone = await (await fetch(address)).text()
  assert(!standalone.includes('name="makrab-session"'))
})
