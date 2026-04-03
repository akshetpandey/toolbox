/**
 * Post-build script: gzip all .wasm files in dist/ so they fit under
 * Cloudflare Workers' 25 MiB per-asset limit.
 *
 * The companion Cloudflare Worker (src/worker.ts) serves these files
 * with `Content-Encoding: gzip` so browsers decompress them transparently.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { glob } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')

let count = 0

for await (const entry of glob('**/*.wasm', { cwd: DIST })) {
  const filePath = join(DIST, entry)
  const raw = readFileSync(filePath)
  const compressed = gzipSync(raw, { level: 9 })
  const savedPct = ((1 - compressed.length / raw.length) * 100).toFixed(1)

  writeFileSync(filePath, compressed)

  const rawMB = (raw.length / 1024 / 1024).toFixed(1)
  const gzMB = (compressed.length / 1024 / 1024).toFixed(1)
  console.log(`  ${entry}: ${rawMB} MB → ${gzMB} MB (${savedPct}% smaller)`)
  count++
}

console.log(`\n✅ Compressed ${count} WASM file(s) in dist/`)
