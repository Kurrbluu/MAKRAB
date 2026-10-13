import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveApiPath } from '../server/api-route.mjs'

test('public and GM routes survive rewritten URL and Vercel query helper formats', () => {
  for (const route of ['meta', 'session', 'access', 'command', 'gm/login', 'gm/session', 'gm/command', 'gm/logout', 'gm/login-info']) {
    const expected = `/api/${route}`
    for (const entry of ['/api', '/api/index', '/api/index.mjs', '/api/index.js']) {
      assert.equal(resolveApiPath({ url: `${entry}?__makrab_path=${encodeURIComponent(route)}` }), expected)
      assert.equal(resolveApiPath({ url: `${entry}/`, query: { __makrab_path: route } }), expected)
      assert.equal(resolveApiPath({ url: entry, query: { __makrab_path: route.split('/') } }), expected)
      assert.equal(resolveApiPath({ url: `${entry}?route=${encodeURIComponent(expected)}` }), expected)
      assert.equal(resolveApiPath({ url: entry, query: { path: route.split('/') } }), expected)
    }
  }
})

test('a real API path wins over query hints and malformed forwarded paths cannot escape the API namespace', () => {
  assert.equal(resolveApiPath({ url: '/api/session?__makrab_path=access', query: { __makrab_path: 'access' } }), '/api/session')
  assert.equal(resolveApiPath({ url: '/api/session/' }), '/api/session')
  for (const value of [undefined, '', '../gm/session', '%2E%2E/gm/session', 'session?private=value', 'https://example.com', 123, {}, ['gm', 1], '%', 'x'.repeat(161)]) {
    assert.equal(resolveApiPath({ url: '/api/index.mjs', query: { __makrab_path: value } }), '/api/index.mjs')
  }
})
