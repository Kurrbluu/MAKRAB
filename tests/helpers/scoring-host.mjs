import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createGameHost } from '../../server/host.mjs'

export async function scoringHost(t) {
  const directory = await mkdtemp(join(tmpdir(), 'makrab GM test '))
  const stateDirectory = join(directory, 'private'), distDirectory = join(directory, 'dist')
  await mkdir(distDirectory)
  await writeFile(join(distDirectory, 'index.html'), '<html><head></head><body>Game</body></html>')
  let now = 1_000_000, host, address
  const aborters = []
  const start = async () => {
    host = createGameHost({ stateDirectory, distDirectory, clock: () => now, gmPin: '246810' })
    host.server.listen(0, '127.0.0.1'); await once(host.server, 'listening')
    address = `http://127.0.0.1:${host.server.address().port}`
  }
  const stop = async () => { await host.close(); host = undefined }
  t.after(async () => { for (const controller of aborters) controller.abort(); if (host) await stop(); await rm(directory, { recursive: true, force: true }) })
  await start()
  async function request(path, { cookie, body, method } = {}) {
    const response = await fetch(address + path, { method: method ?? (body ? 'POST' : 'GET'),
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  const publicState = async () => (await request('/api/session')).body
  const login = async (name = 'GM') => request('/api/gm/login', { body: { name, pin: '246810' } })
  const gm = async (cookie, command, options = {}) => request('/api/gm/command', { cookie, body: { commandId: options.id ?? crypto.randomUUID(), gameId: options.gameId ?? (await publicState()).state.gameId, command } })
  const core = async command => { const current = await publicState(); return request('/api/command', { body: { commandId: crypto.randomUUID(), expectedRevision: current.state.revision, command } }) }
  const events = async () => {
    const controller = new AbortController(); aborters.push(controller)
    const response = await fetch(address + '/api/events', { signal: controller.signal })
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffered = ''
    return { close: () => controller.abort(), async next(revision = 0) {
      while (true) {
        const end = buffered.indexOf('\n\n')
        if (end >= 0) {
          const event = buffered.slice(0, end); buffered = buffered.slice(end + 2)
          if (!event.startsWith('event: state\n')) continue
          const value = JSON.parse(event.slice(event.indexOf('data: ') + 6))
          if (value.state.revision >= revision) return value
        } else { const chunk = await reader.read(); if (chunk.done) throw new Error('SSE ended'); buffered += decoder.decode(chunk.value, { stream: true }) }
      }
    } }
  }
  return { request, publicState, login, gm, core, events, start, stop, setNow: value => { now = value }, stateFile: join(stateDirectory, 'session.json'), stateDirectory, distDirectory, address: () => address }
}
