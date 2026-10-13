import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Pass file paths directly so cmd.exe, PowerShell, and Unix shells behave alike.
const directory = new URL('../tests/', import.meta.url)
const files = readdirSync(directory).filter(name => name.endsWith('.test.mjs')).sort()
  .map(name => fileURLToPath(new URL(name, directory)))
if (!files.length) throw new Error('No test files found.')
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...process.argv.slice(2), ...files], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
