import { createSessionDocument, assertSessionDocument } from './session-engine.mjs'
import { jsonEqual } from '../src/lib/jsonEqual.ts'

export class StorageUnavailable extends Error {
  constructor(message, { code = 'SUPABASE_UNAVAILABLE', status } = {}) {
    super(message)
    this.code = code
    this.status = status
  }
}
export function createSupabaseStore({ url, secretKey, sessionKey = 'makrab-big-game', fetchImpl = fetch, clock = Date.now }) {
  const base = new URL('/rest/v1/', url)
  const headers = { apikey: secretKey, 'Content-Type': 'application/json' }
  // New secret keys are API keys, not JWTs. Legacy service_role keys also need Bearer auth.
  if (!secretKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secretKey}`
  async function request(path, { method = 'GET', body, prefer } = {}) {
    let response
    try { response = await fetchImpl(new URL(path, base), { method, headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(7000) }) }
    catch { throw new StorageUnavailable('Penyimpanan online belum tersambung.') }
    if (!response.ok) throw new StorageUnavailable('Penyimpanan online belum siap.', { code: 'SUPABASE_HTTP_ERROR', status: response.status })
    if (response.status === 204) return null
    try { return await response.json() }
    catch { throw new StorageUnavailable('Respons penyimpanan tidak valid.', { code: 'SUPABASE_RESPONSE_INVALID' }) }
  }
  const query = (table, filters) => `${table}?${new URLSearchParams(filters)}`
  const validateStored = row => {
    try { assertSessionDocument(row?.document) }
    catch { throw new StorageUnavailable('Data sesi tersimpan tidak valid.', { code: 'INVALID_STORED_SESSION' }) }
    return row
  }
  async function load() {
    const rows = await request(query('makrab_game_sessions', { session_key: `eq.${sessionKey}`, select: 'store_version,document' }))
    if (!Array.isArray(rows)) throw new StorageUnavailable('Respons penyimpanan tidak valid.', { code: 'SUPABASE_RESPONSE_INVALID' })
    const [row] = rows
    if (row) return validateStored(row)
    const initialized = await request('rpc/makrab_init_session', { method: 'POST', body: { p_session_key: sessionKey, p_document: createSessionDocument(clock()) } })
    if (!Array.isArray(initialized)) throw new StorageUnavailable('Respons penyimpanan tidak valid.', { code: 'SUPABASE_RESPONSE_INVALID' })
    const [created] = initialized
    if (!created) throw new StorageUnavailable('Sesi online belum berhasil dibuat.')
    return validateStored(created)
  }
  async function transact(operation) {
    for (let retry = 0; retry < 8; retry++) {
      const current = await load()
      const result = operation(current.document, clock())
      assertSessionDocument(result.document)
      if (jsonEqual(current.document, result.document)) return result
      const saved = await request('rpc/makrab_compare_session', { method: 'POST', body: { p_session_key: sessionKey, p_expected_version: current.store_version, p_document: result.document } })
      if (saved === true) return result
    }
    throw new StorageUnavailable('Sesi sedang diperbarui. Periksa keadaan terbaru lalu coba lagi.', { code: 'SESSION_BUSY' })
  }
  async function saveLogin(tokenHash, actor, fingerprint, expiresAt) {
    await load()
    await request('makrab_gm_sessions', { method: 'POST', body: { token_hash: tokenHash, session_key: sessionKey, actor, pin_fingerprint: fingerprint, expires_at: new Date(expiresAt).toISOString() }, prefer: 'return=minimal' })
    await request(query('makrab_gm_sessions', { expires_at: `lt.${new Date(clock()).toISOString()}` }), { method: 'DELETE' })
  }
  async function login(tokenHash, fingerprint) {
    const [session] = await request(query('makrab_gm_sessions', { token_hash: `eq.${tokenHash}`, session_key: `eq.${sessionKey}`, pin_fingerprint: `eq.${fingerprint}`, expires_at: `gt.${new Date(clock()).toISOString()}`, select: 'actor' }))
    return session ?? null
  }
  async function logout(tokenHash) { await request(query('makrab_gm_sessions', { token_hash: `eq.${tokenHash}`, session_key: `eq.${sessionKey}` }), { method: 'DELETE' }) }
  async function loginAttempt(bucket) { return request('rpc/makrab_login_attempt', { method: 'POST', body: { p_bucket: bucket, p_now: new Date(clock()).toISOString() } }) }
  async function clearAttempts(bucket) { await request(query('makrab_login_limits', { bucket: `eq.${bucket}` }), { method: 'DELETE' }) }
  return { transact, login, saveLogin, logout, loginAttempt, clearAttempts }
}
