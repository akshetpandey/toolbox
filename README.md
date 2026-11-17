# Toolbox

Free, open-source file tools that run in your browser. Resize images, edit PDFs,
trim media, convert documents, and open archives without uploading your files
for processing.

[Use Toolbox](https://toolbox.computer)

## Available tools

| Category  | Tools                                                                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Images    | Resize, compress, convert, crop, rotate, flip, batch process, remove backgrounds, redact, and inspect or remove metadata                                                         |
| Videos    | Compress, convert, trim, join clips, extract audio, and inspect or remove metadata                                                                                               |
| Audio     | Convert, trim, and join recordings                                                                                                                                               |
| PDFs      | Merge, compress, split, organize pages, convert to and from images, recognize English text with OCR, redact, add visible signatures, watermark, and export editable text to Word |
| Documents | Convert Word (DOCX), Excel (XLSX), and PowerPoint (PPTX) files to PDF                                                                                                            |
| Archives  | Create ZIP, 7z, TAR, and TAR.GZ archives; extract ZIP, RAR, 7z, TAR, and GZIP files, including supported password-protected archives                                             |
| Utilities | Calculate and verify MD5, SHA-1, and SHA-256 checksums; detect file types and inspect metadata                                                                                   |

PDF-to-Word conversion is experimental and focuses on selectable text. Review
converted document layouts before sharing.

## How it works

Choose a tool, select or drop your files, adjust the settings, and download the
result. Processing uses JavaScript and WebAssembly on your device. Heavy engines
load as needed, and video and audio tools share a multithreaded FFmpeg engine.

Files, edits, and results stay in browser memory as you move between tools.
Refreshing or closing the page clears that workspace; download any results you
want to keep.

## Getting started

Use pnpm and Node.js 22.22.2+, 24.15.0+, or 26+ within the supported ranges in
[package.json](./package.json).

```bash
git clone https://github.com/akshetpandey/toolbox.git
cd toolbox
pnpm install
pnpm dev
```

Open [localhost:5050](http://localhost:5050). If a development server is already
running, reuse it.

The build targets Chrome 135+, Safari 26+, and Firefox 140+. Multithreaded
processing requires `SharedArrayBuffer` and cross-origin isolation. The local
server and deployed app supply the required COOP and COEP headers.

## Development commands

| Command             | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `pnpm dev`          | Start the development server on port 5050                            |
| `pnpm build`        | Build production assets in `dist/` and compress WASM files           |
| `pnpm serve`        | Preview the production build with Vite on port 4173                  |
| `pnpm preview`      | Preview the production build with the Cloudflare Worker on port 8787 |
| `pnpm lint`         | Run Oxlint, including type-aware rules                               |
| `pnpm lint:fix`     | Apply safe lint fixes                                                |
| `pnpm format`       | Format files with Oxfmt                                              |
| `pnpm format:check` | Check formatting without changing files                              |
| `pnpm typecheck`    | Check types with TypeScript 7                                        |
| `pnpm check`        | Apply lint fixes, format files, and check types                      |

Linting and formatting are configured in `.oxlintrc.json` and `.oxfmtrc.json`.

## Testing

Install the matching Playwright browsers before the first browser test run and
after Playwright upgrades:

```bash
pnpm exec playwright install chromium webkit
```

Run the full validation before submitting code changes:

```bash
pnpm check
pnpm test
pnpm build
```

`pnpm test` runs the Node suite, browser tests, and complete tool workflows in
Chromium and WebKit. The browser commands manage their own local servers.

| Command                      | Scope                                                         |
| ---------------------------- | ------------------------------------------------------------- |
| `pnpm test:unit`             | Node tests, including real-WASM integration tests             |
| `pnpm test:browser`          | Browser tests in Chromium and WebKit                          |
| `pnpm test:workflows`        | Complete tool workflows with representative files in Chromium |
| `pnpm test:workflows:webkit` | Complete tool workflows in WebKit                             |
| `pnpm test:watch`            | Run the Node suite in watch mode                              |

To focus on one tool, append `--only` and its path, for example
`pnpm test:workflows --only /pdfs/sign`. Add `--preview` to a workflow command to
test production bundles after building, and `--screenshots <dir>` to save
screenshots. Test artifacts are written under `.vitest/` and ignored by Git.

## Project structure

The interface uses React, TypeScript, Tailwind CSS, and Shadcn/ui components.
Category contexts manage tool state, while shared hooks retain session work and
track processing results.

```text
src/
├── components/      # Shared layouts, file pickers, results, and UI primitives
├── contexts/        # Category state, processing status, and theme
├── hooks/           # Session workspaces, engine loading, and prefetching
├── lib/             # File processing, tool catalog, and shared utilities
├── routes/          # Homepage, category layouts, and individual tool pages
├── main.tsx         # Browser entry point
└── worker.ts        # Static asset serving, redirects, and WASM response headers
scripts/             # WASM compression, bundle checks, and workflow tests
public/              # Static assets, models, and security headers
```

Processing engines include ImageMagick and libimagequant for images, FFmpeg for
video and audio, pdf-lib and PDF.js for PDFs, Tesseract for OCR, 7z-wasm for
archives, and Pandoc with Typst for document conversion.

When adding a tool, use the existing layouts and category contexts, keep file
processing in the browser, and register it in `src/lib/tools.ts`. Keep heavy
engines lazy-loaded and update `vite-plugin-tool-prefetch.ts` when a tool's
engine dependencies change. Do not edit `src/routeTree.gen.ts` manually.

[AGENTS.md](./AGENTS.md) contains the detailed architecture and repository
conventions for coding agents. `CLAUDE.md` imports the same guidance.

## Production and deployment

```bash
pnpm build
pnpm serve
```

The build prerenders each tool landing page, then the browser hydrates the
interface for navigation and file processing. New pages must support rendering
in Node; use browser APIs in effects or event handlers.

Vite's preview server supplies decoding headers for compressed WASM assets.
Use `pnpm preview` after building to check the Cloudflare Worker's redirects,
HTTP status codes, and initial HTML responses.

Deployment uses Cloudflare Workers with static assets, configured in
`wrangler.jsonc`. With Cloudflare credentials configured, build and deploy with:

```bash
pnpm deploy
```

The Worker serves the site and compressed WASM assets; file processing runs in
the browser.

## License

[MIT](./LICENSE)
