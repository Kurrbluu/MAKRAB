import { createServer } from 'node:http'
import { randomUUID, randomInt, createHash, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, statSync, openSync, fsyncSync, closeSync, createReadStream } from 'node:fs'
import { resolve, sep, extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { networkInterfaces } from 'node:os'
import { parseArgs } from 'node:util'
import { createSharedGame, advanceSharedGame, applySharedCommand, assertSharedGame, isSharedCommand } from '../src/lib/sharedGame.ts'
import { createScoring, syncScoring, publicResults, scoreTotals, applyScoringCommand, assertScoring, isScoringCommand, ScoreConflict } from '../src/lib/gameScoring.ts'
import { roundCountFor } from '../src/lib/gameRundown.ts'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ico': 'image/x-icon' }

function localPinHintAllowed(request) {
  const loopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1', '[::1]'].includes(address)
  if (!loopback(request.socket.remoteAddress)) return false
  // Vite appends the actual client address, so earlier forwarded values cannot impersonate a local operator.
  const forwarded = request.headers['x-forwarded-for']
  if (forwarded && !loopback(String(forwarded).split(',').at(-1).trim())) return false
  try {
    const hostname = new URL(`http://${request.headers.host}`).hostname
    return hostname === 'localhost' || hostname.endsWith('.localhost') || loopback(hostname)
  } catch { return false }
}

export function createGameHost({ stateDirectory = resolve(projectRoot, '.game-state'), distDirectory = resolve(projectRoot, 'dist'), clock = Date.now, gmPin } = {}) {
  mkdirSync(stateDirectory, { recursive: true })
  const stateFile = resolve(stateDirectory, 'session.json')
  let store
  if (existsSync(stateFile)) {
    try {
      store = JSON.parse(readFileSync(stateFile, 'utf8'))
      assertSharedGame(store.state)
      if (store.scoring) { assertScoring(store.scoring, roundCountFor(store.state.rundown)); if (store.scoring.gameId !== store.state.gameId) throw new Error('Catatan poin berasal dari sesi lain.') }
      if (store.gmPin !== undefined && !/^\d{4,12}$/.test(store.gmPin)) throw new Error('PIN GM tidak valid.')
      if (store.version !== 1 || !Array.isArray(store.commands) || store.commands.length > 128
        || store.commands.some(entry => typeof entry.id !== 'string' || typeof entry.hash !== 'string')) throw new Error('Riwayat perintah tidak valid.')
    } catch (error) { throw new Error(`File progres ${stateFile} tidak valid. File tetap disimpan; pulihkan salinan yang benar sebelum menjalankan server. ${error.message}`) }
  } else store = { version: 1, state: createSharedGame(clock(), randomUUID), commands: [] }
  const pin = gmPin ?? store.gmPin ?? String(randomInt(100000, 1000000))
  if (typeof pin !== 'string' || !/^\d{4,12}$/.test(pin)) throw new Error('PIN GM harus terdiri dari 4–12 digit.')
  store = { ...store, gmPin: pin, scoring: store.scoring ?? createScoring(store.state.gameId) }
  const gmSessions = new Map()
  const failedLogins = new Map()
  const subscribers = new Set()
  let ticker
  let closed = false
  let lastHeartbeat = 0
  function persist(next) {
    const temporary = `${stateFile}.tmp`
    writeFileSync(temporary, JSON.stringify(next, null, 2), { mode: 0o600 })
    // Windows FlushFileBuffers requires write access to the file handle.
    const file = openSync(temporary, 'r+')
    try { fsyncSync(file) } finally { closeSync(file) }
    renameSync(temporary, stateFile)
    store = next
  }
  function snapshot() { return { state: store.state, serverNow: clock() } }
  function gmSnapshot(actor) { return { scoring: store.scoring, totals: scoreTotals(store.scoring), roundCount: roundCountFor(store.state.rundown), actor, serverNow: clock() } }
  function reconcile(nextStore) {
    const scoring = syncScoring(nextStore.scoring, nextStore.state)
    const results = publicResults(scoring, nextStore.state)
    let state = nextStore.state
    if ((results.enabled || state.results !== undefined) && JSON.stringify(results) !== JSON.stringify(state.results)) {
      state = { ...state, results, revision: Math.max(state.revision, store.state.revision + 1), updatedAt: clock() }
    }
    return { ...nextStore, state, scoring }
  }
  function send(response, event, value) { response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`) }
  function broadcast() { for (const response of subscribers) send(response, 'state', snapshot()) }
  function advance() {
    const next = reconcile({ ...store, state: advanceSharedGame(store.state, clock(), randomUUID) })
    if (next.state !== store.state || next.scoring !== store.scoring) { persist(next); broadcast() }
  }
  persist(store)
  advance()
  const server = createServer(async (request, response) => {
    const json = (status, value) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify(value))
    }
    try {
      const url = new URL(request.url, 'http://localhost')
      if (url.pathname.startsWith('/api/')) {
        if (request.headers.origin) {
          let origin
          try { origin = new URL(request.headers.origin) } catch { json(403, { error: 'Origin tidak diizinkan.' }); return }
          if (origin.host !== request.headers.host) { json(403, { error: 'Origin tidak diizinkan.' }); return }
        }
        advance()
        if (request.method === 'GET' && url.pathname === '/api/meta') { json(200, { transport: 'sse', online: false, authRequired: false }); return }
        if (request.method === 'GET' && url.pathname === '/api/access') { json(200, { canControl: true }); return }
        const readJson = async () => {
          if (!request.headers['content-type']?.startsWith('application/json')) { json(415, { error: 'Perintah harus berupa JSON.' }); return null }
          let raw = ''
          for await (const chunk of request) {
            raw += chunk.toString()
            if (Buffer.byteLength(raw) > 16_384) { json(413, { error: 'Perintah terlalu besar.' }); return null }
          }
          try { const value = JSON.parse(raw); if (!value || typeof value !== 'object') throw new Error(); return value }
          catch { json(400, { error: 'JSON tidak valid.' }); return null }
        }
        if (request.method === 'GET' && url.pathname === '/api/gm/login-info') {
          json(200, { pinHint: localPinHintAllowed(request) ? pin : null }); return
        }
        if (request.method === 'POST' && url.pathname === '/api/gm/login') {
          const body = await readJson()
          if (!body) return
          const address = request.socket.remoteAddress ?? 'unknown'
          const failures = failedLogins.get(address)
          if (failures && failures.count >= 6 && clock() - failures.at < 60_000) { json(429, { error: 'Tunggu satu menit sebelum mencoba PIN lagi.' }); return }
          const supplied = Buffer.from(typeof body.pin === 'string' ? body.pin : '')
          const expected = Buffer.from(pin)
          if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
            failedLogins.set(address, { count: failures && clock() - failures.at < 60_000 ? failures.count + 1 : 1, at: clock() })
            json(401, { error: 'PIN GM tidak cocok.' }); return
          }
          failedLogins.delete(address)
          const actor = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 40) : 'GM'
          const token = randomUUID()
          gmSessions.set(token, { actor, expiresAt: clock() + 12 * 60 * 60 * 1000 })
          response.setHeader('Set-Cookie', `makrab_gm=${token}; HttpOnly; SameSite=Strict; Path=/api/gm; Max-Age=43200`)
          json(200, gmSnapshot(actor)); return
        }
        if (url.pathname.startsWith('/api/gm/')) {
          const token = request.headers.cookie?.match(/(?:^|;\s*)makrab_gm=([^;]+)/)?.[1]
          const session = gmSessions.get(token)
          if (!session || session.expiresAt <= clock()) { if (token) gmSessions.delete(token); json(401, { error: 'Masuk dengan PIN GM untuk membuka catatan poin.' }); return }
          if (request.method === 'GET' && url.pathname === '/api/gm/session') { json(200, gmSnapshot(session.actor)); return }
          if (request.method === 'POST' && url.pathname === '/api/gm/logout') {
            gmSessions.delete(token)
            response.setHeader('Set-Cookie', 'makrab_gm=; HttpOnly; SameSite=Strict; Path=/api/gm; Max-Age=0')
            json(200, { ok: true }); return
          }
          if (request.method === 'POST' && url.pathname === '/api/gm/command') {
            const body = await readJson()
            if (!body) return
            if (typeof body.commandId !== 'string' || !/^[a-zA-Z0-9:_-]{1,160}$/.test(body.commandId) || !isScoringCommand(body.command)) { json(400, { error: 'Input GM tidak valid.' }); return }
            advance()
            if (body.gameId !== store.state.gameId) { json(409, { ...gmSnapshot(session.actor), error: 'Permainan sudah berganti. Periksa sesi terbaru sebelum menginput.' }); return }
            const hash = createHash('sha256').update(JSON.stringify({ gameId: body.gameId, gm: body.command })).digest('hex')
            const previous = store.commands.find(entry => entry.id === body.commandId)
            if (previous) { json(previous.hash === hash ? 200 : 409, previous.hash === hash ? gmSnapshot(session.actor) : { ...gmSnapshot(session.actor), error: 'ID perintah sudah digunakan.' }); return }
            let scoring
            try { scoring = applyScoringCommand(store.scoring, body.command, session.actor, clock(), randomUUID, roundCountFor(store.state.rundown)); assertScoring(scoring, roundCountFor(store.state.rundown)) }
            catch (error) { json(error instanceof ScoreConflict ? 409 : 400, { ...gmSnapshot(session.actor), error: error.message }); return }
            const next = reconcile({ ...store, scoring, commands: [...store.commands, { id: body.commandId, hash }].slice(-128) })
            const changed = next.state !== store.state
            persist(next)
            if (changed) broadcast()
            json(200, gmSnapshot(session.actor)); return
          }
          json(404, { error: 'Alamat GM tidak ditemukan.' }); return
        }
        if (request.method === 'GET' && url.pathname === '/api/session') { json(200, snapshot()); return }
        if (request.method === 'GET' && url.pathname === '/api/events') {
          response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
          response.write('retry: 1000\n\n')
          subscribers.add(response)
          send(response, 'state', snapshot())
          request.on('close', () => subscribers.delete(response))
          return
        }
        if (request.method === 'POST' && url.pathname === '/api/command') {
          if (!request.headers['content-type']?.startsWith('application/json')) { json(415, { error: 'Perintah harus berupa JSON.' }); return }
          let raw = ''
          for await (const chunk of request) {
            raw += chunk.toString()
            if (Buffer.byteLength(raw) > 16_384) { json(413, { error: 'Perintah terlalu besar.' }); return }
          }
          let body
          try { body = JSON.parse(raw) } catch { json(400, { error: 'JSON tidak valid.' }); return }
          if (!body || typeof body !== 'object' || typeof body.commandId !== 'string' || !/^[a-zA-Z0-9:_-]{1,160}$/.test(body.commandId)
            || !Number.isInteger(body.expectedRevision) || !isSharedCommand(body.command)) { json(400, { error: 'Perintah tidak valid.' }); return }
          advance()
          const hash = createHash('sha256').update(JSON.stringify(body.command)).digest('hex')
          const previous = store.commands.find(entry => entry.id === body.commandId)
          if (previous) { json(previous.hash === hash ? 200 : 409, previous.hash === hash ? snapshot() : { ...snapshot(), error: 'ID perintah sudah digunakan.' }); return }
          if (body.expectedRevision !== store.state.revision) { json(409, { ...snapshot(), error: 'Permainan sudah diperbarui oleh perangkat lain. Periksa layar lalu coba lagi.' }); return }
          let next
          let scoring = store.scoring
          try {
            if (store.state.results?.presentation && ['toggle', 'pause', 'reset', 'replay', 'duration'].includes(body.command.type)) throw new Error('Gunakan Lanjut untuk meninggalkan layar hasil.')
            if (body.command.type === 'resultsNext') {
              const result = store.state.results?.presentation
              if (result?.kind !== 'ranking') throw new Error('Ranking belum siap dilanjutkan.')
              scoring = { ...scoring, revision: scoring.revision + 1, dismissed: [...new Set([...scoring.dismissed, result.round])] }
              next = result.round < roundCountFor(store.state.rundown) ? applySharedCommand(store.state, { type: 'phase', index: store.state.rundown.phaseIndex + 1, start: true }, clock(), { id: randomUUID, chooseIndex: randomInt }) : store.state
            } else next = applySharedCommand(store.state, body.command, clock(), { id: randomUUID, chooseIndex: randomInt })
            assertSharedGame(next)
          }
          catch (error) { json(400, { ...snapshot(), error: error.message }); return }
          const resolved = reconcile({ ...store, state: next, scoring, commands: [...store.commands, { id: body.commandId, hash }].slice(-128) })
          const changed = resolved.state !== store.state
          persist(resolved)
          if (changed) broadcast()
          json(200, snapshot())
          return
        }
        json(404, { error: 'Alamat API tidak ditemukan.' })
        return
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return }
      const pathname = decodeURIComponent(url.pathname)
      const file = resolve(distDirectory, `.${pathname === '/' ? '/index.html' : pathname}`)
      if (!file.startsWith(`${resolve(distDirectory)}${sep}`) || !existsSync(file) || !statSync(file).isFile()) { response.writeHead(404); response.end('Tidak ditemukan.'); return }
      const type = mime[extname(file)] ?? 'application/octet-stream'
      response.setHeader('Content-Type', type)
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('X-Content-Type-Options', 'nosniff')
      if (file === resolve(distDirectory, 'index.html')) {
        const html = readFileSync(file, 'utf8').replace('<head>', '<head><meta name="makrab-session" content="shared">')
        response.end(request.method === 'HEAD' ? undefined : html)
      } else {
        const size = statSync(file).size
        const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/)
        if (range) {
          const start = Number(range[1]), end = Math.min(Number(range[2] || size - 1), size - 1)
          if (start > end || start >= size) { response.writeHead(416, { 'Content-Range': `bytes */${size}` }); response.end(); return }
          response.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' })
          if (request.method === 'HEAD') response.end()
          else createReadStream(file, { start, end }).pipe(response)
        } else {
          response.writeHead(200, { 'Content-Length': size, 'Accept-Ranges': 'bytes' })
          if (request.method === 'HEAD') response.end()
          else createReadStream(file).pipe(response)
        }
      }
    } catch (error) {
      console.error('Server error:', error.message)
      if (!response.headersSent) json(500, { error: 'Server tidak dapat menyimpan atau membaca sesi. Perintah belum diterapkan.' })
      else response.end()
    }
  })
  server.on('listening', () => {
    ticker = setInterval(() => {
      try { advance() } catch (error) { console.error('Progres belum tersimpan:', error.message) }
      if (clock() - lastHeartbeat >= 2000) {
        lastHeartbeat = clock()
        for (const response of subscribers) send(response, 'clock', { serverNow: clock() })
      }
    }, 100)
    ticker.unref()
  })
  server.requestTimeout = 10_000
  return {
    server, stateFile, gmPin: pin,
    async close() {
      if (closed) return
      closed = true
      clearInterval(ticker)
      for (const response of subscribers) response.end()
      subscribers.clear()
      server.closeAllConnections()
      await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
    },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { host: { type: 'string', default: process.env.MAKRAB_HOST ?? '0.0.0.0' },
    port: { type: 'string', default: process.env.MAKRAB_PORT ?? '3000' }, 'state-dir': { type: 'string' }, help: { type: 'boolean' } } })
  if (values.help) { console.log('node --experimental-strip-types server/host.mjs [--host 0.0.0.0] [--port 3000] [--state-dir directory]'); process.exit(0) }
  if (!existsSync(resolve(projectRoot, 'dist/index.html'))) { console.error('Jalankan npm run build terlebih dahulu.'); process.exit(1) }
  const port = Number(values.port)
  if (!Number.isInteger(port) || port < 0 || port > 65535) { console.error('Port tidak valid.'); process.exit(1) }
  try {
    const host = createGameHost({ stateDirectory: values['state-dir'] ? resolve(values['state-dir']) : undefined, gmPin: process.env.MAKRAB_GM_PIN })
    host.server.on('error', error => { console.error(`Server tidak dapat dijalankan: ${error.message}`); process.exitCode = 1 })
    host.server.listen(port, values.host, () => {
      const actual = host.server.address().port
      console.log(`Sesi bersama: http://localhost:${actual}/#/game`)
      if (values.host === '0.0.0.0') for (const addresses of Object.values(networkInterfaces())) for (const address of addresses ?? []) {
        if (address.family === 'IPv4' && !address.internal) console.log(`Alamat jaringan: http://${address.address}:${actual}/#/game`)
      }
      console.log(`Progres disimpan: ${host.stateFile}`)
      console.log('Aktifkan suara pada setiap laptop. Satu operator mengendalikan timer dan undian.')
      console.log(`GM Access: /#/gm · PIN GM: ${host.gmPin}`)
    })
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void host.close().then(() => process.exit(0)) })
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
