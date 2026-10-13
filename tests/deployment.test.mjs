import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('production build stays shared without Vercel system variables and keeps secrets out of browser assets', t => {
  const directory = mkdtempSync(join(tmpdir(), 'makrab-production-build-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const root = fileURLToPath(new URL('../', import.meta.url))
  const env = { ...process.env, SUPABASE_SECRET_KEY: 'sb_secret_build_test_never_ship', MAKRAB_GM_PIN: '135790' }
  delete env.VERCEL
  delete env.MAKRAB_ONLINE
  const result = spawnSync(process.execPath, ['scripts/build-online.mjs', '--outDir', directory], { cwd: root, env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  const html = readFileSync(join(directory, 'index.html'), 'utf8')
  assert.match(html, /name="makrab-session" content="shared"/)
  const browserCode = readdirSync(join(directory, 'assets')).filter(file => file.endsWith('.js'))
    .map(file => readFileSync(join(directory, 'assets', file), 'utf8')).join('\n')
  assert(!browserCode.includes(env.SUPABASE_SECRET_KEY))
  assert(!browserCode.includes(env.MAKRAB_GM_PIN))
})
