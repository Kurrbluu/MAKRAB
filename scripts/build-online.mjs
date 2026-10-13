import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Explicit online mode also works when Vercel's automatic system variables are disabled.
// Use Node directly so the command behaves the same on Windows and macOS.
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const result = spawnSync(process.execPath, [vite, 'build', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, MAKRAB_ONLINE: '1' },
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
