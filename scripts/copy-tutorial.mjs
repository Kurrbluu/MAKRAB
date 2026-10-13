// Ship the standalone tutorial with the game without bundling or changing it.
import { cpSync, mkdirSync, readdirSync } from 'node:fs'
const source = new URL('../tutorial-demo/', import.meta.url)
const destination = new URL('../dist/tutorial-demo/', import.meta.url)
mkdirSync(destination, { recursive: true })
const reviews = readdirSync(source).filter(name => /^review-[\w-]+\.html$/.test(name))
for (const item of ['index.html', ...reviews, 'styles.css', 'script.js', 'assets']) {
  cpSync(new URL(item, source), new URL(item, destination), { recursive: true })
}
console.log('Standalone tutorial included in dist/tutorial-demo/')
