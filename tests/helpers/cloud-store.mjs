import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { createSupabaseStore } from '../../server/supabase-store.mjs'

// Exercise the actual SQL, JSONB ordering, triggers and compare-and-swap through
// the same REST requests used in production. No cloud credentials are needed.
export async function cloudDatabase({ clock = Date.now, secretKey = 'sb_secret_test', onPublish = () => {} } = {}) {
  const db = new PGlite()
  const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  await db.exec(schema)
  const requests = []
  const fetchImpl = async (input, options) => {
    const url = new URL(input), route = url.pathname.replace('/rest/v1/', '')
    requests.push({ route, method: options.method, headers: options.headers })
    if (options.headers.apikey !== secretKey || (secretKey.startsWith('sb_secret_') && options.headers.Authorization)) return new Response('{}', { status: 403 })
    try {
      let result
      const body = options.body ? JSON.parse(options.body) : null
      if (route === 'rpc/makrab_init_session') result = (await db.query('select * from public.makrab_init_session($1,$2)', [body.p_session_key, body.p_document])).rows
      else if (route === 'rpc/makrab_compare_session') result = (await db.query('select public.makrab_compare_session($1,$2,$3) as saved', [body.p_session_key, body.p_expected_version, body.p_document])).rows[0].saved
      else if (route === 'rpc/makrab_login_attempt') result = (await db.query('select public.makrab_login_attempt($1,$2) as attempts', [body.p_bucket, body.p_now])).rows[0].attempts
      else {
        if (!['makrab_game_sessions', 'makrab_gm_sessions', 'makrab_login_limits'].includes(route)) throw new Error('Unexpected table')
        const values = [], filters = []
        for (const [key, filter] of url.searchParams) {
          if (key === 'select') continue
          if (!['session_key', 'token_hash', 'pin_fingerprint', 'expires_at', 'bucket'].includes(key)) throw new Error('Unexpected filter')
          const [operator, ...parts] = filter.split('.')
          const comparator = { eq: '=', gt: '>', lt: '<' }[operator]
          if (!comparator) throw new Error('Unexpected comparator')
          values.push(parts.join('.')); filters.push(`${key} ${comparator} $${values.length}`)
        }
        const where = filters.length ? `where ${filters.join(' and ')}` : ''
        if (options.method === 'GET') {
          const select = url.searchParams.get('select') || '*'
          if (!['*', 'store_version,document', 'actor'].includes(select)) throw new Error('Unexpected columns')
          result = (await db.query(`select ${select} from public.${route} ${where}`, values)).rows
        } else if (options.method === 'DELETE') {
          await db.query(`delete from public.${route} ${where}`, values); return new Response(null, { status: 204 })
        } else if (options.method === 'POST' && route === 'makrab_gm_sessions') {
          await db.query('insert into public.makrab_gm_sessions(token_hash,session_key,actor,pin_fingerprint,expires_at) values($1,$2,$3,$4,$5)', [body.token_hash, body.session_key, body.actor, body.pin_fingerprint, body.expires_at])
          return new Response(null, { status: 201, headers: { 'Preference-Applied': 'return=minimal' } })
        } else throw new Error('Unexpected request')
      }
      if (route === 'rpc/makrab_compare_session' && result === true) {
        const row = (await db.query('select * from public.makrab_public_sessions where session_key=$1', [body.p_session_key])).rows[0]
        onPublish(row)
      }
      return Response.json(result)
    } catch (error) { return Response.json({ error: error.message }, { status: 500 }) }
  }
  const store = (sessionKey = 'makrab-big-game') => createSupabaseStore({ url: 'https://test.supabase.co', secretKey, sessionKey, fetchImpl, clock })
  return { db, store, fetchImpl, requests, schema, close: () => db.close() }
}
