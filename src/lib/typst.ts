import {
  createTypstCompiler,
  type TypstCompiler,
  CompileFormatEnum,
} from '@myriaddreamin/typst.ts/compiler'
import { withAccessModel } from '@myriaddreamin/typst.ts/options.init'
import type { FsAccessModel } from '@myriaddreamin/typst.ts/internal.types'
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url'

/**
 * Virtual project root for typst compilation.
 * All files (main source + resources) are mapped under this path.
 */
const PROJECT_ROOT = '/project'

/**
 * In-memory access model that serves files from a mutable Map.
 * Unlike the built-in MemoryAccessModel, this doesn't require
 * a /@memory/ prefix — it serves any path that has been added.
 */
class InMemoryAccessModel implements FsAccessModel {
  private files = new Map<string, Uint8Array>()

  /** Replace all files with a new set */
  setFiles(files: Record<string, Uint8Array>) {
    this.files.clear()
    for (const [path, data] of Object.entries(files)) {
      this.files.set(path, data)
    }
  }

  clear() {
    this.files.clear()
  }

  getMTime(path: string): Date | undefined {
    return this.files.has(path) ? new Date() : undefined
  }

  isFile(path: string): boolean | undefined {
    // Return true if known, undefined if unknown.
    // IMPORTANT: Do NOT return false — Typst interprets false as
    // "path exists but is a directory", causing "is a directory" errors.
    return this.files.has(path) ? true : undefined
  }

  getRealPath(path: string): string | undefined {
    return path
  }

  readAll(path: string): Uint8Array | undefined {
    return this.files.get(path)
  }
}

/**
 * Lazy-loading singleton for the Typst compiler.
 * Initializes on first use and reuses the instance for subsequent calls.
 */
let _compiler: TypstCompiler | null = null
let _initPromise: Promise<void> | null = null
const _accessModel = new InMemoryAccessModel()

async function ensureTypstReady(): Promise<TypstCompiler> {
  if (_compiler && _initPromise) {
    await _initPromise
    return _compiler
  }

  _compiler = createTypstCompiler()
  _initPromise = _compiler.init({
    beforeBuild: [withAccessModel(_accessModel)],
    getModule: () => fetch(compilerWasmUrl).then((r) => r.arrayBuffer()),
  })
  await _initPromise
  return _compiler
}

/**
 * Compile Typst markup (with optional resource files) to a PDF Uint8Array.
 *
 * @param typstContent - The Typst markup string (output from pandoc)
 * @param files - Optional map of resource files (images, etc.) referenced
 *                by the document. Keys are file paths, values are binary data.
 * @returns PDF binary data
 */
export async function compileTypstToPDF(
  typstContent: string,
  files?: Record<string, Uint8Array>,
): Promise<Uint8Array> {
  const compiler = await ensureTypstReady()

  // Clear any previous state
  compiler.resetShadow()

  // Populate the access model and shadow filesystem with resource files.
  // Files are mapped under the project root with both prefixed and
  // bare variants so typst can resolve either form of reference.
  const accessFiles: Record<string, Uint8Array> = {}
  if (files) {
    for (const [path, data] of Object.entries(files)) {
      const prefixed = `${PROJECT_ROOT}/${path}`
      accessFiles[prefixed] = data
      accessFiles['/' + path] = data
      accessFiles[path] = data
      compiler.mapShadow(prefixed, data)
      compiler.mapShadow('/' + path, data)
      if (!path.startsWith('/')) {
        compiler.mapShadow(path, data)
      }
    }
  }
  _accessModel.setFiles(accessFiles)

  // Write the main typst source into the shadow filesystem
  const mainPath = `${PROJECT_ROOT}/main.typ`
  const typstBytes = new TextEncoder().encode(typstContent)
  compiler.mapShadow(mainPath, typstBytes)

  // Compile to PDF
  const result = await compiler.compile({
    mainFilePath: mainPath,
    root: PROJECT_ROOT,
    format: CompileFormatEnum.pdf,
    diagnostics: 'full',
  })

  // Clean up the access model after compilation
  _accessModel.clear()

  if (!result.result) {
    // Extract error messages from diagnostics if available
    const messages: string[] = []
    if (result.diagnostics) {
      for (const d of result.diagnostics) {
        if (d.message) {
          let msg = d.message
          // Include hints if present (they often contain useful context)
          const diag = d as unknown as Record<string, unknown>
          if (Array.isArray(diag.hints) && diag.hints.length > 0) {
            msg += ', hints: ' + (diag.hints as string[]).join(', ')
          }
          messages.push(msg)
        }
      }
    }
    if (messages.length > 0) {
      throw new Error(`Typst compilation failed: ${messages.join('; ')}`)
    }
    throw new Error('Typst compilation produced no PDF output')
  }

  return result.result
}
