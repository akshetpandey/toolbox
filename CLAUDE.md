# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an open-source SPA web application that provides browser-based file processing tools for non-technical users. All processing happens client-side using JavaScript and WebAssembly packages, ensuring privacy and offline capability. The application offers tools for image/video processing, PDF manipulation, archive handling, and office document conversion.

## Common Commands

### Development

```bash
pnpm dev            # Start development server on port 5050
pnpm build          # Build for production
pnpm serve          # Preview production build locally
```

### Code Quality

```bash
pnpm lint           # Run ESLint
pnpm format         # Format code with Prettier
pnpm check          # Format and lint fix in one command
pnpm test           # Run tests with Vitest
```

### Deployment

```bash
pnpm preview        # Preview with Wrangler for Cloudflare Workers
pnpm deploy         # Build and deploy to Cloudflare Workers
```

### UI Components

```bash
pnpx shadcn@latest add button    # Add new Shadcn components
```

## Architecture

### Tech Stack

- **Framework**: React 19 with TypeScript (strict mode)
- **Routing**: TanStack Router with file-based routing and auto code-splitting
- **Styling**: Tailwind CSS v4 with Shadcn/ui components (Radix UI primitives)
- **Build Tool**: Vite 7 (target: Chrome 130+, Safari 18+, Firefox 102+)
- **Deployment**: Cloudflare Workers with static assets
- **Icons**: Lucide React
- **Drag & Drop**: @dnd-kit (used for PDF page reordering)
- **Processing Libraries** (all WASM, all client-side):
  - `@ffmpeg/ffmpeg` + `@ffmpeg/core-mt` - Video processing (loaded from CDN)
  - `@imagemagick/magick-wasm` - Image processing
  - `pdf-lib` - PDF manipulation
  - `7z-wasm` - Archive compression/extraction
  - `wasm-pandoc` + `@bjorn3/browser_wasi_shim` - Document conversion via WASI
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
| **Office Documents** | convert to PDF                                   | `OfficeToolsContext`  | `pandoc.ts`, `pandoc-cdn.ts`         |
| **Utilities**        | file hashes, file metadata                       | `UtilitiesContext`    | `metadata.ts`                        |

**WASM Lazy Loading Pattern**: Heavy WASM libraries use a singleton pattern with module-level promises to prevent duplicate initialization:

- `useInitFFmpeg` hook - loads FFmpeg from unpkg CDN with progress callback
- `useInitImageMagick` hook - loads ImageMagick WASM
- `metadata.ts`, `pandoc-cdn.ts` - inline lazy loading with cached instances

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
- Maintain responsive design with mobile support
- `routeTree.gen.ts` is auto-generated by TanStack Router plugin - do not edit manually
- **After making code changes, always run `pnpm check` (formats and lints) and `pnpm test` to verify nothing is broken**

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
