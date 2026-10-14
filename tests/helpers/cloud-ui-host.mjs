// Isolated browser QA fixture. Uses temporary in-memory PostgreSQL and a local
// Phoenix-compatible socket; it never reads the real .game-state or cloud keys.
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { cloudDatabase } from './cloud-store.mjs'
import { createCloudHandler } from '../../server/cloud-api.mjs'

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)))
const dist = resolve(root, 'dist'), port = Number(process.env.MAKRAB_QA_PORT || 39013)
const address = `http://127.0.0.1:${port}`
const projectUrl = address + (process.env.MAKRAB_QA_REST_URL === '1' ? '/rest/v1/' : '')
let sessionDelay = Math.max(0, Number(process.env.MAKRAB_QA_SESSION_DELAY_MS) || 0)
const rewriteDestination = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')).rewrites[0].destination
let socketsEnabled = true
const sockets = new WebSocketServer({ noServer: true })
let reads = 0, delivered = 0
const database = await cloudDatabase({ onPublish: row => {
  for (const socket of sockets.clients) {
    if (!socket.subscription || !socketsEnabled) continue
    socket.send(JSON.stringify([socket.joinRef, null, socket.topic, 'postgres_changes', {
      ids: [42], data: { schema: 'public', table: 'makrab_public_sessions', type: 'UPDATE',
        commit_timestamp: new Date().toISOString(), columns: [{ name: 'session_key', type: 'text' }, { name: 'state', type: 'jsonb' }], record: row, old_record: {} },
    }]))
    delivered++
  }
} })
const handler = createCloudHandler({ configuration: { url: projectUrl, secretKey: 'sb_secret_test', publishableKey: 'sb_publishable_test', pin: '246810', sessionKey: 'makrab-big-game' }, store: database.store(), secureCookies: false })
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp4': 'video/mp4' }
const server = createServer((request, response) => {
  const pathname = new URL(request.url, address).pathname
  if (pathname === '/__qa/sockets-off') {
    socketsEnabled = false
    for (const socket of sockets.clients) socket.close(1012)
    response.end('ok'); return
  }
  if (pathname === '/__qa/sockets-on') { socketsEnabled = true; response.end('ok'); return }
  if (pathname === '/__qa/session-delay') {
    sessionDelay = Math.max(0, Math.min(2000, Number(new URL(request.url, address).searchParams.get('ms')) || 0))
    response.end('ok'); return
  }
  if (pathname === '/__qa/stats') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ reads, delivered, sockets: sockets.clients.size })); return }
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/session') reads++
    if (process.env.MAKRAB_QA_REWRITE === '1') {
      const original = new URL(request.url, address)
      const destination = new URL(rewriteDestination.replace(':path*', original.pathname.slice('/api/'.length)), address)
      request.query = { ...Object.fromEntries(original.searchParams), ...Object.fromEntries(destination.searchParams) }
      request.url = '/api/index.mjs'
    }
    if (pathname === '/api/session' && sessionDelay) setTimeout(() => { void handler(request, response) }, sessionDelay)
    else void handler(request, response)
    return
  }
  const file = resolve(dist, `.${pathname === '/' ? '/index.html' : decodeURIComponent(pathname)}`)
  if (!file.startsWith(dist + sep) || !existsSync(file) || !statSync(file).isFile()) { response.statusCode = 404; response.end(); return }
  response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream')
  response.setHeader('Cache-Control', 'no-store')
  const contents = readFileSync(file)
  response.end(file.endsWith('/index.html') ? contents.toString().replace('<head>', '<head><meta name="makrab-session" content="shared">') : contents)
})
server.on('upgrade', (request, socket, head) => {
  if (new URL(request.url, address).pathname !== '/realtime/v1/websocket') {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return
  }
  if (!socketsEnabled) { socket.destroy(); return }
  sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws, request))
})
sockets.on('connection', socket => {
  socket.on('message', raw => {
    const [joinRef, ref, topic, event, payload] = JSON.parse(raw.toString())
    const reply = result => socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: result }]))
    if (event === 'phx_join') {
      socket.joinRef = joinRef; socket.topic = topic; socket.subscription = true
      reply({ postgres_changes: payload.config.postgres_changes.map(binding => ({ ...binding, id: 42 })) })
      socket.send(JSON.stringify([joinRef, null, topic, 'system', { extension: 'postgres_changes', status: 'ok', message: 'Subscribed to PostgreSQL' }]))
    } else if (event === 'heartbeat' || event === 'phx_leave') reply({})
  })
})
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
console.log(`Cloud UI QA fixture: ${address}`)
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  for (const socket of sockets.clients) socket.terminate()
  server.close(() => { void database.close().then(() => process.exit(0)) })
})
