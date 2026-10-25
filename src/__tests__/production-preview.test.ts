// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

describe('production preview command', () => {
  let preview: ChildProcess | undefined
  let workspace: string
  let assets: string
  let origin: string
  const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
  const project = fileURLToPath(new URL('../../', import.meta.url))

  beforeAll(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'toolbox-preview-'))
    assets = join(workspace, 'assets')
    await mkdir(join(assets, 'nested'), { recursive: true })
    await Promise.all([
      writeFile(join(assets, 'test.wasm'), gzipSync(wasm)),
      writeFile(join(assets, 'nested/module file.wasm'), gzipSync(wasm)),
      writeFile(join(assets, 'uncompressed.wasm'), wasm),
      writeFile(join(assets, 'app.js'), 'export const preview = true'),
      writeFile(join(assets, 'index.html'), '<h1>Production preview</h1>'),
    ])

    // Exercise the documented command against a tiny build fixture instead of
    // requiring a full application build before every test run. Keep the real
    // Vite config, preview middleware, SPA routing and response headers.
    preview = spawn(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['serve', '--outDir', assets, '--port', '0', '--host', '127.0.0.1'],
      {
        cwd: project,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      },
    )

    origin = await new Promise<string>((resolve, reject) => {
      let output = ''
      const timeout = setTimeout(() => {
        reject(new Error(`Production preview did not start:\n${output}`))
      }, 40_000)
      const collect = (data: Buffer) => {
        output += data.toString()
        const ready = /Local:\s+(http:\/\/127\.0\.0\.1:\d+)/.exec(output)
        if (ready) {
          clearTimeout(timeout)
          resolve(ready[1])
        }
      }
      preview?.stdout?.on('data', collect)
      preview?.stderr?.on('data', collect)
      preview?.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      preview?.once('exit', (code) => {
        clearTimeout(timeout)
        reject(new Error(`Production preview exited (${code}):\n${output}`))
      })
    })
  }, 45_000)

  afterAll(async () => {
    if (preview?.pid && preview.exitCode === null) {
      const exited = new Promise<void>((resolve) => {
        preview?.once('exit', () => resolve())
      })
      if (process.platform === 'win32') preview.kill('SIGTERM')
      else process.kill(-preview.pid, 'SIGTERM')
      await exited
    }
    if (workspace) await rm(workspace, { recursive: true, force: true })
  }, 10_000)

  it.each(['/test.wasm', '/nested/module%20file.wasm?cache=1'])(
    'serves precompressed WASM at %s as a decodable, compilable module',
    async (path) => {
      const response = await fetch(`${origin}${path}`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-encoding')).toBe('gzip')
      expect(response.headers.get('content-type')).toBe('application/wasm')
      expect(
        await WebAssembly.compileStreaming(response.clone()),
      ).toBeInstanceOf(WebAssembly.Module)
      const decoded = await response.arrayBuffer()
      expect(new Uint8Array(decoded)).toEqual(wasm)
      expect(await WebAssembly.compile(decoded)).toBeInstanceOf(
        WebAssembly.Module,
      )
    },
  )

  it('serves uncompressed WASM without incorrectly labeling it as gzip', async () => {
    const response = await fetch(`${origin}/uncompressed.wasm`)
    expect(response.headers.get('content-encoding')).toBeNull()
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(wasm)
  })

  it('preserves compressed WASM headers on HEAD requests', async () => {
    const response = await fetch(`${origin}/test.wasm`, { method: 'HEAD' })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-encoding')).toBe('gzip')
    expect(response.headers.get('content-type')).toBe('application/wasm')
    expect(await response.text()).toBe('')
  })

  it('does not add WASM headers to other static assets', async () => {
    const response = await fetch(`${origin}/app.js`)
    expect(response.headers.get('content-encoding')).toBeNull()
    expect(response.headers.get('content-type')).toContain('javascript')
    expect(await response.text()).toBe('export const preview = true')
  })

  it('does not label missing-WASM HTML fallback responses as gzip', async () => {
    const response = await fetch(`${origin}/missing.wasm`, {
      headers: { Accept: 'text/html' },
    })
    expect(response.headers.get('content-encoding')).toBeNull()
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toBe('<h1>Production preview</h1>')
  })

  it('preserves SPA fallback and cross-origin isolation headers', async () => {
    const response = await fetch(`${origin}/images/resize`)
    expect(response.status).toBe(200)
    expect(response.headers.get('cross-origin-opener-policy')).toBe(
      'same-origin',
    )
    expect(response.headers.get('cross-origin-embedder-policy')).toBe(
      'require-corp',
    )
    expect(await response.text()).toBe('<h1>Production preview</h1>')
  })
})
