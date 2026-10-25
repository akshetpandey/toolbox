# Repository guidance

This is the shared source of repository instructions for coding agents. Keep
project guidance here so agents and editors follow the same conventions.

## Project Overview

This is an open-source SPA web application that provides browser-based file processing tools for non-technical users. All processing happens client-side using JavaScript and WebAssembly packages, ensuring privacy and offline capability. The application offers tools for image/video processing, PDF manipulation, archive handling, and office document conversion.

## Common Commands

### Development

```bash
pnpm dev            # Start development server on port 5050
pnpm build          # Build for production
pnpm serve          # Preview production build with Vite on port 4173
```

The developer normally keeps a development server running. Check for an existing
server before starting another; the browser test command manages its own server.

Use pnpm. Node.js must satisfy `package.json`'s `engines` range. Type checking
uses TypeScript 7 directly. Oxlint's type-aware rules use `oxlint-tsgolint`.

### Code Quality

```bash
pnpm lint           # Run Oxlint, including type-aware rules
pnpm lint:fix       # Apply safe Oxlint fixes
pnpm format         # Format with Oxfmt
pnpm format:check   # Check formatting without writing files
pnpm typecheck      # Check types with TypeScript 7
pnpm check          # Format, lint fix, and check types
pnpm test           # Run Node and Chromium suites with Vitest
pnpm test:unit      # Run unit and real-WASM integration tests in Node
pnpm test:browser   # Run real-WASM, redaction canvas, and keyboard tests in Chromium
```

Before the first browser test run (and after Playwright upgrades), install its
matching browser with `pnpm exec playwright install chromium`.

### Deployment

```bash
pnpm preview        # Preview with Wrangler for Cloudflare Workers on port 8787
pnpm deploy         # Build and deploy to Cloudflare Workers
```

### UI Components

```bash
pnpx shadcn@latest add button    # Add new Shadcn components
```

## Architecture

### Tech Stack

- **Framework**: React 19 with TypeScript 7 (strict mode)
- **Routing**: TanStack Router with file-based routing; automatic route code-splitting is disabled in `vite.config.ts`
- **Styling**: Tailwind CSS v4 with Shadcn/ui components (Radix UI primitives)
- **Build Tool**: Vite 8 (target: Chrome 135+, Safari 26+, Firefox 140+)
- **Deployment**: Cloudflare Workers with static assets
- **Icons**: Lucide React
- **Drag & Drop**: @dnd-kit (used for PDF page reordering)
- **Processing Libraries** (all WASM, all client-side):
  - `@ffmpeg/ffmpeg` + `@ffmpeg/core-mt` - Video processing (loaded from local package assets)
  - `@imagemagick/magick-wasm` - Image processing
  - `pdf-lib` - PDF manipulation
  - `7z-wasm` - Archive compression/extraction
  - `pandoc-wasm` + `@bjorn3/browser_wasi_shim` - Document conversion via WASI
  - `@myriaddreamin/typst.ts` - Typst WASM compiler for PDF generation (used with pandoc)
  - `libimagequant-wasm` - PNG compression/quantization
  - `@uswriting/exiftool` - EXIF metadata extraction
  - `hash-wasm` - File hashing (MD5, SHA1, SHA256)
  - `wasmagic` - MIME type detection

### Directory Structure

```
src/
├── routes/           # File-based routing with TanStack Router (33 route files)
├── contexts/         # React contexts for tool-specific state management (8 contexts)
├── lib/              # Core processing libraries and utilities (14 files)
├── components/       # Reusable UI components
│   └── ui/           # Shadcn/ui components (13 primitives)
├── hooks/            # Custom React hooks for WASM library initialization
├── main.tsx          # Application entry point
├── routeTree.gen.ts  # Auto-generated route tree (do not edit manually)
└── styles.css        # Global styles
```

### Key Architecture Patterns

**Tool Categories**: The app is organized into 6 tool categories, each with their own:

- Route group in `src/routes/[category]/`
- Context provider in `src/contexts/[Category]ToolsContext.tsx`
- Processing functions in `src/lib/`

| Category             | Tools                                            | Context               | Lib files                            |
| -------------------- | ------------------------------------------------ | --------------------- | ------------------------------------ |
| **Images**           | resize, convert, compress, metadata, redact      | `ImageToolsContext`   | `imagemagick.ts`, `libimagequant.ts` |
| **Videos**           | convert, compress, trim, extract audio, metadata | `VideoToolsContext`   | `ffmpeg.ts`, `videoToolsUtils.tsx`   |
| **PDFs**             | merge, split (WIP), compress (WIP)               | `PDFToolsContext`     | `pdf.ts`                             |
| **Archives**         | compress (zip/7z/tar/gzip), extract              | `ArchiveToolsContext` | `archive.ts`                         |
| **Office Documents** | convert to PDF                                   | `OfficeToolsContext`  | `pandoc.ts`, `typst.ts`              |
| **Utilities**        | file hashes, file metadata                       | `UtilitiesContext`    | `metadata.ts`                        |

**WASM Lazy Loading Pattern**: Heavy WASM libraries use a singleton pattern with module-level promises to prevent duplicate initialization:

- `useInitFFmpeg` hook - loads local FFmpeg assets with progress callback; `vite-plugin-ffmpeg-core.ts` serves and emits the multi-threaded core files
- `vite-plugin-pandoc-wasm.ts` keeps Pandoc's WASM import as an asset URL for its browser WASI shim under Vite 8.3+
- `vite-plugin-wasm-preview.ts` supplies gzip headers for precompressed WASM assets in Vite preview
- `useInitImageMagick` hook - loads ImageMagick WASM
- `metadata.ts`, `pandoc.ts`, `typst.ts` - inline lazy loading with cached instances

**State Management**: React Context API with typed hooks:

- `ProcessingContext` - Global `isProcessing` flag and `processingMessage` for progress UI
- `ThemeContext` - Dark/light/system theme management
- Per-category contexts manage file selection, processing state, and results

**File Processing Flow**:

1. File upload via `FileUpload` component (drag-and-drop supported)
2. Category context provider manages tool state
3. Processing functions in `src/lib/` handle WASM operations
4. Progress tracked via `ProcessingContext` (videos also track time estimates)
5. Results downloaded to user's device

### Route Structure

Routes follow TanStack Router file-based conventions:

- `__root.tsx` - Root layout with `ToolSidebar`
- `index.tsx` - Landing page with feature list and changelog
- `[category].tsx` - Category layout (wraps child routes in context provider)
- `[category].index.tsx` - Category overview page
- `[category].[tool].tsx` - Individual tool page
- Each route exports a `head()` function for SEO metadata

### Component Patterns

- **ToolLayout** - Wraps tool pages with header and responsive split layout (1/3 upload + 2/3 tools on desktop, stacked on mobile)
- **FileUpload** - Reusable file upload with drag-and-drop, file preview, badges
- **ToolSidebar** - Collapsible navigation sidebar with tool categories
- **ThemeToggle** - Light/dark/system theme switcher
- All UI primitives are Shadcn/ui in `src/components/ui/`

### Shared Utilities (`src/lib/shared.ts`)

- `formatFileSize()` - Bytes to human-readable (KB, MB, GB, TB)
- `formatDuration()` - Seconds to HH:MM:SS
- `truncateFilename()` - Smart truncation preserving file extension
- `downloadBlob()` / `downloadMultipleFiles()` - Trigger file downloads
- File validation helpers

## Important Notes

### Development Guidelines

- Always prefer WASM packages over server-side processing
- Process files entirely in the browser for privacy
- Use existing tool contexts and processing patterns when adding new tools
- Follow Shadcn component patterns and Tailwind styling
- Install new Shadcn components with `pnpx shadcn@latest add <component>`
- Maintain responsive design with mobile support
- `routeTree.gen.ts` is auto-generated by TanStack Router plugin - do not edit manually
- **After making code changes, always run `pnpm check`, `pnpm test`, and `pnpm build` to verify formatting, linting, types, Node/browser tests, and production bundling**
- During dependency upgrades, review official release notes for major and pre-1.0 breaking changes and keep paired packages compatible. Preserve client-side processing and lazy WASM loading.
- Linting is configured in `.oxlintrc.json`; formatting is configured in `.oxfmtrc.json`. Preserve migrated rule severities and type-aware checks.
- Use `oxlint-disable` directives with `typescript/*` rule names for narrow exceptions. Generated `src/routeTree.gen.ts` is excluded from linting and formatting.

### Build Configuration

- Vite config includes manual chunk splitting for each WASM library into separate bundles
- All WASM packages are excluded from Vite's `optimizeDeps` pre-bundling
- COOP/COEP headers required for SharedArrayBuffer support (needed by FFmpeg multi-threading)
- Source maps enabled for production debugging
- WASM files included via `assetsInclude: ['**/*.wasm']`
- Web workers use ES module format

### Testing

- Tests run with Vitest and JSDOM environment
- Uses Testing Library for React component testing
- Test files should follow the pattern `*.test.ts` or `*.test.tsx`
- Real-WASM integration tests use `// @vitest-environment node`; browser tests use `*.browser.test.ts` and Playwright Chromium
- Resolve package assets through public exports instead of hard-coding `node_modules` layouts
- Vitest artifacts are written under `.vitest/` and are ignored by Git

### Security Headers

Development server includes required headers for WASM:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These headers enable SharedArrayBuffer, required by FFmpeg's multi-threaded WASM core.

### Adding a New Tool

To add a new tool to an existing category:

1. Create route file: `src/routes/[category].[tool].tsx`
2. Add processing logic to the appropriate `src/lib/` file
3. Add state management to the category's context in `src/contexts/`
4. Add the tool to the sidebar navigation in `src/components/ToolSidebar.tsx`
5. Use `ToolLayout` and `FileUpload` components for consistent UI
