import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createGameHost } from '../server/host.mjs'
import { remainingTime } from '../src/lib/gameTimer.ts'

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'makrab session test-'))
  const stateDirectory = join(directory, 'private'), distDirectory = join(directory, 'dist')
  await mkdir(distDirectory)
  await writeFile(join(distDirectory, 'index.html'), '<html><head><title>Game</title></head><body>Game</body></html>')
  await writeFile(join(distDirectory, 'audio.wav'), '0123456789')
  await writeFile(join(directory, 'secret.txt'), 'private')
  let now = 1_000_000, host, address
  const rooms = []
  const start = async () => {
    host = createGameHost({ stateDirectory, distDirectory, clock: () => now })
    host.server.listen(0, '127.0.0.1')
    await once(host.server, 'listening')
    address = `http://127.0.0.1:${host.server.address().port}`
  }
  const stop = async () => { await host.close(); host = undefined }
  t.after(async () => { for (const room of rooms) room.close(); if (host) await stop(); await rm(directory, { recursive: true, force: true }) })
  await start()
  const get = async () => (await fetch(`${address}/api/session`)).json()
  const command = async (value, revision, id = crypto.randomUUID()) => {
    const response = await fetch(`${address}/api/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId: id, expectedRevision: revision, command: value }) })
    return { status: response.status, body: await response.json() }
  }
  const connect = async () => {
    const controller = new AbortController()
    const response = await fetch(`${address}/api/events`, { signal: controller.signal })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /text\/event-stream/)
    const reader = response.body.getReader(), decoder = new TextDecoder()
    let pending = ''
    const room = {
      close: () => { controller.abort(); void reader.cancel().catch(() => {}) },
      async next(revision) {
        while (true) {
          const boundary = pending.indexOf('\n\n')
          if (boundary >= 0) {
            const event = pending.slice(0, boundary); pending = pending.slice(boundary + 2)
            if (!event.startsWith('event: state\n')) continue
            const snapshot = JSON.parse(event.slice(event.indexOf('data: ') + 6))
            if (revision === undefined || snapshot.state.revision >= revision) return snapshot
          } else {
            const chunk = await reader.read()
            if (chunk.done) throw new Error('SSE closed before the expected update')
            pending += decoder.decode(chunk.value, { stream: true })
          }
        }
      },
    }
    rooms.push(room)
    return room
  }
  return { get, command, connect, start, stop, setNow: value => { now = value }, stateFile: join(stateDirectory, 'session.json'), address: () => address, stateDirectory, distDirectory }
}

test('two connected rooms receive the same draw, phase, pause, and countdown after a late join', { timeout: 10_000 }, async t => {
  const f = await fixture(t)
  const roomA = await f.connect(), roomB = await f.connect()
  const initialA = await roomA.next(), initialB = await roomB.next()
  assert.deepEqual(initialA.state, initialB.state)
  const begun = await f.command({ type: 'begin' }, initialA.state.revision)
  assert.equal(begun.status, 200)
  const drawA = await roomA.next(begun.body.state.revision), drawB = await roomB.next(begun.body.state.revision)
  assert.deepEqual(drawA.state, drawB.state)
  const presentation = drawA.state.presentation
  roomB.close()
  f.setNow(presentation.startsAt + 2_500)
  const lateRoom = await f.connect()
  const late = await lateRoom.next()
  assert.deepEqual(late.state.presentation, presentation)
  assert.deepEqual(late.state.draws, drawA.state.draws)
  f.setNow(presentation.completesAt + 5_000)
  const running = await f.get()
  assert.equal(running.state.rundown.bank.timers.terawang.deadline, presentation.completesAt + 90_000)
  assert.equal(remainingTime(running.state.rundown.bank.timers.terawang, running.serverNow), 85_000)
  assert.deepEqual((await roomA.next(running.state.revision)).state, (await lateRoom.next(running.state.revision)).state)
  const paused = await f.command({ type: 'pause' }, running.state.revision)
  assert.equal(paused.status, 200)
  assert.equal(paused.body.state.rundown.bank.timers.terawang.remainingMs, 85_000)
  const next = await f.command({ type: 'phase', index: 1, start: true }, paused.body.state.revision)
  assert.equal(next.status, 200)
  assert.deepEqual((await roomA.next(next.body.state.revision)).state, (await lateRoom.next(next.body.state.revision)).state)
  assert.equal(next.body.state.rundown.phaseIndex, 1)
})

test('simultaneous commands reject the stale device and duplicate command IDs apply only once', { timeout: 10_000 }, async t => {
  const f = await fixture(t)
  const initial = await f.get()
  const commands = [{ type: 'phase', index: 1, start: false }, { type: 'phase', index: 2, start: false }]
  const results = await Promise.all(commands.map((command, i) => f.command(command, initial.state.revision, `room-${i}`)))
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
  const winner = results.findIndex(result => result.status === 200)
  const current = await f.get()
  assert.equal(current.state.revision, 1)
  assert.equal(current.state.rundown.phaseIndex, commands[winner].index)
  const retry = await f.command(commands[winner], initial.state.revision, `room-${winner}`)
  assert.equal(retry.status, 200)
  assert.deepEqual(retry.body.state, current.state)
  assert.equal((await f.command({ type: 'home' }, current.state.revision, `room-${winner}`)).status, 409)
})

test('server restart preserves a draw and deduplication, and downtime counts toward the original deadline', { timeout: 10_000 }, async t => {
  const f = await fixture(t)
  const initial = await f.get()
  const begun = await f.command({ type: 'begin' }, initial.state.revision, 'first-start')
  const draw = begun.body.state
  await f.stop()
  f.setNow(draw.presentation.startsAt + 3_000)
  await f.start()
  const restoredDraw = await f.get()
  assert.deepEqual(restoredDraw.state, draw)
  const retried = await f.command({ type: 'begin' }, initial.state.revision, 'first-start')
  assert.equal(retried.status, 200)
  assert.deepEqual(retried.body.state, draw)
  await f.stop()
  f.setNow(draw.presentation.completesAt + 12_000)
  await f.start()
  const restored = await f.get()
  assert.equal(restored.state.presentation, null)
  assert.equal(remainingTime(restored.state.rundown.bank.timers.terawang, restored.serverNow), 78_000)
  assert.equal(restored.state.cue.startsAt, draw.presentation.completesAt)
  assert.deepEqual(restored.state.draws, draw.draws)
  assert.deepEqual(JSON.parse(await readFile(f.stateFile, 'utf8')).state, restored.state)
  await f.stop()
  f.setNow(draw.presentation.completesAt + 500_000)
  await f.start()
  const expired = await f.get()
  assert.equal(expired.state.rundown.phaseIndex, 0)
  assert.equal(expired.state.rundown.bank.timers.terawang.remainingMs, 0)
  assert.equal(expired.state.rundown.bank.timers.terawang.deadline, null)
})

test('paused state survives a server restart without losing duration or remaining time', { timeout: 10_000 }, async t => {
  const f = await fixture(t)
  const selected = await f.command({ type: 'phase', index: 2, start: true }, 0)
  f.setNow(1_030_400)
  const paused = await f.command({ type: 'pause' }, selected.body.state.revision)
  assert.equal(paused.body.state.rundown.bank.timers.movement.remainingMs, 150_000)
  await f.stop()
  f.setNow(2_000_000)
  await f.start()
  assert.deepEqual((await f.get()).state, paused.body.state)
})

test('invalid input is rejected, static hosting injects shared mode, audio ranges work, and private files stay private', { timeout: 10_000 }, async t => {
  const f = await fixture(t)
  const page = await fetch(f.address())
  assert.match(await page.text(), /<meta name="makrab-session" content="shared">/)
  const audio = await fetch(`${f.address()}/audio.wav`, { headers: { Range: 'bytes=2-5' } })
  assert.equal(audio.status, 206)
  assert.equal(audio.headers.get('content-range'), 'bytes 2-5/10')
  assert.equal(await audio.text(), '2345')
  assert.equal((await fetch(`${f.address()}/audio.wav`, { headers: { Range: 'bytes=20-' } })).status, 416)
  for (const path of ['/server/host.mjs', '/.game-state/session.json', '/%2e%2e%2fsecret.txt']) assert.equal((await fetch(`${f.address()}${path}`)).status, 404)
  for (const payload of ['null', '{}', '{', JSON.stringify({ commandId: 'bad', expectedRevision: 0, command: { type: 'phase', index: 1 } })]) {
    const response = await fetch(`${f.address()}/api/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
    assert.equal(response.status, 400)
  }
  const crossOrigin = await fetch(`${f.address()}/api/command`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://example.invalid' }, body: '{}' })
  assert.equal(crossOrigin.status, 403)
  assert.equal((await f.get()).state.revision, 0)
})

test('a corrupt progress file prevents startup and is retained for recovery', { timeout: 10_000 }, async t => {
  const f = await fixture(t)
  await f.stop()
  const corrupt = '{broken progress'
  await writeFile(f.stateFile, corrupt)
  assert.throws(() => createGameHost({ stateDirectory: f.stateDirectory, distDirectory: f.distDirectory }), /File progres .*tidak valid/)
  assert.equal(await readFile(f.stateFile, 'utf8'), corrupt)
})
