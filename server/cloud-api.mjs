import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createSupabaseStore, StorageUnavailable } from './supabase-store.mjs'
import { advanceSession, coreTransition, scoringTransition, publicSnapshot, privateSnapshot } from './session-engine.mjs'
import { resolveApiPath } from './api-route.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
const sessionLifetime = 12 * 60 * 60 * 1000

export function cloudConfiguration(env = process.env) {
  const url = env.SUPABASE_URL
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY
  const pin = env.MAKRAB_GM_PIN
  const sessionKey = env.MAKRAB_SESSION_KEY || 'makrab-big-game'
  if (!url || !secretKey || !publishableKey || !/^\d{6}$/.test(pin ?? '') || !/^[a-zA-Z0-9_-]{1,64}$/.test(sessionKey)) return null
  try { if (new URL(url).protocol !== 'https:') return null } catch { return null }
  // A secret/service_role key must never become the browser's public Realtime key.
  if (publishableKey === secretKey || publishableKey.startsWith('sb_secret_')) return null
  try {
    if (!publishableKey.startsWith('sb_publishable_') && JSON.parse(Buffer.from(publishableKey.split('.')[1], 'base64url')).role !== 'anon') return null
  } catch { return null }
  return { url, secretKey, publishableKey, pin, sessionKey }
}

export function createCloudHandler({ configuration = cloudConfiguration(), store, clock = Date.now, secureCookies = true, log = console.error } = {}) {
  const storage = store ?? (configuration && createSupabaseStore({ ...configuration, clock }))
  const fingerprint = configuration ? hash(`${configuration.sessionKey}:${configuration.pin}`) : ''
  const cookie = (token, age) => `makrab_gm=${token}; HttpOnly; ${secureCookies ? 'Secure; ' : ''}SameSite=Strict; Path=/api; Max-Age=${age}`
  return async function handler(request, response) {
    const receivedAt = clock()
    const json = (status, value) => {
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.setHeader('X-Makrab-API', '2')
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.statusCode = status
      response.end(JSON.stringify(value.state ? { ...value, serverReceivedAt: receivedAt, serverNow: clock() } : value))
    }
    try {
      const pathname = resolveApiPath(request)
      if (request.headers.origin) {
        let origin
        try { origin = new URL(request.headers.origin) } catch { json(403, { error: 'Origin tidak diizinkan.' }); return }
        if (origin.host !== request.headers.host) { json(403, { error: 'Origin tidak diizinkan.' }); return }
      }
      if (request.headers['sec-fetch-site'] === 'cross-site') { json(403, { error: 'Origin tidak diizinkan.' }); return }
      if (!configuration || !storage) { json(503, { error: 'Backend online belum dikonfigurasi. Lengkapi pengaturan Supabase dan PIN GM.' }); return }
      const readJson = async () => {
        if (!request.headers['content-type']?.startsWith('application/json')) { json(415, { error: 'Perintah harus berupa JSON.' }); return null }
        let raw = ''
        if (request.body !== undefined) raw = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
        else for await (const chunk of request) {
          raw += chunk.toString()
          if (Buffer.byteLength(raw) > 16_384) { json(413, { error: 'Perintah terlalu besar.' }); return null }
        }
        if (Buffer.byteLength(raw) > 16_384) { json(413, { error: 'Perintah terlalu besar.' }); return null }
        try { const body = JSON.parse(raw); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); return body }
        catch { json(400, { error: 'JSON tidak valid.' }); return null }
      }
      const getPublic = () => storage.transact((document, now) => ({ document: advanceSession(document, now) }))
      if (pathname === '/api/meta' && request.method === 'GET') {
        json(200, { transport: 'supabase', online: true, authRequired: true, url: configuration.url, publishableKey: configuration.publishableKey, sessionKey: configuration.sessionKey }); return
      }
      if (pathname === '/api/gm/login-info' && request.method === 'GET') { json(200, { pinHint: null }); return }
      if (pathname === '/api/session' && request.method === 'GET') {
        const result = await getPublic(); json(200, publicSnapshot(result.document, clock())); return
      }
      if (pathname === '/api/gm/login' && request.method === 'POST') {
        const body = await readJson()
        if (!body) return
        // Vercel overwrites this header with the client address. Only hashes enter the database.
        const address = request.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown'
        const bucket = hash(`${configuration.sessionKey}:${address}`)
        if (await storage.loginAttempt(bucket) > 6) { json(429, { error: 'Tunggu satu menit sebelum mencoba PIN lagi.' }); return }
        const supplied = Buffer.from(typeof body.pin === 'string' ? body.pin : ''), expected = Buffer.from(configuration.pin)
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { json(401, { error: 'PIN GM tidak cocok.' }); return }
        const actor = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 40) : 'GM'
        const token = randomBytes(32).toString('base64url')
        await storage.saveLogin(hash(token), actor, fingerprint, clock() + sessionLifetime)
        await storage.clearAttempts(bucket)
        const result = await getPublic()
        response.setHeader('Set-Cookie', cookie(token, 43200))
        json(200, privateSnapshot(result.document, actor, clock())); return
      }
      const token = request.headers.cookie?.match(/(?:^|;\s*)makrab_gm=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1]
      const login = token ? await storage.login(hash(token), fingerprint) : null
      if (pathname === '/api/access' && request.method === 'GET') { json(200, { canControl: Boolean(login) }); return }
      if (pathname === '/api/command' || pathname.startsWith('/api/gm/')) {
        if (!login) { json(401, { error: 'Masuk melalui GM Access untuk mengendalikan permainan.', code: 'GM_LOGIN_REQUIRED' }); return }
        if (pathname === '/api/gm/logout' && request.method === 'POST') {
          await storage.logout(hash(token)); response.setHeader('Set-Cookie', cookie('', 0)); json(200, { ok: true }); return
        }
        if (pathname === '/api/gm/session' && request.method === 'GET') {
          const result = await getPublic(); json(200, privateSnapshot(result.document, login.actor, clock())); return
        }
        if (request.method === 'POST' && (pathname === '/api/command' || pathname === '/api/gm/command')) {
          const body = await readJson()
          if (!body) return
          const result = await storage.transact((document, now) => pathname === '/api/command' ? coreTransition(document, body, now) : scoringTransition(document, body, login.actor, now))
          json(result.status, result.body); return
        }
      }
      json(404, { error: 'Alamat API tidak ditemukan.', code: 'API_NOT_FOUND' })
    } catch (error) {
      // Do not expose database responses, keys, or private state to public clients.
      const code = error instanceof StorageUnavailable ? error.code : 'SESSION_REQUEST_FAILED'
      const upstreamStatus = error instanceof StorageUnavailable ? error.status : undefined
      log('MAKRAB cloud request failed:', { code, ...(upstreamStatus ? { upstreamStatus } : {}) })
      json(503, { error: 'Sesi online belum tersedia. Periksa koneksi dan pengaturan backend.', code, ...(upstreamStatus ? { upstreamStatus } : {}) })
    }
  }
}
