# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an open-source SPA web application that provides browser-based file processing tools for non-technical users. All processing happens client-side using JavaScript and WebAssembly packages, ensuring privacy and offline capability. The application offers tools for image/video processing, PDF manipulation, archive handling, and office document conversion.

## Common Commands

### Development

```bash
pnpm dev            # Start development server on port 3000
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

- **Framework**: React 19 with TypeScript
- **Routing**: TanStack Router with file-based routing
- **Styling**: Tailwind CSS v4 with Shadcn/ui components
- **Build Tool**: Vite
- **Deployment**: Cloudflare Workers
- **Processing Libraries**: FFmpeg, ImageMagick, pdf-lib, 7z-wasm, Pandoc (all via WASM)
- **Error Tracking**: Sentry (currently commented out)

### Directory Structure

- `src/routes/` - File-based routing with TanStack Router
- `src/contexts/` - React contexts for tool-specific state management
- `src/lib/` - Core processing libraries and utilities
- `src/components/` - Reusable UI components
- `src/hooks/` - Custom React hooks for WASM library initialization

### Key Architecture Patterns

**Tool Categories**: The app is organized into tool categories (Images, Videos, PDFs, Archives, Office Documents, Utilities), each with their own:

- Route group in `src/routes/[category]/`
- Context provider in `src/contexts/[Category]ToolsContext.tsx`
- Processing functions in `src/lib/`

**WASM Integration**: Heavy processing is handled by WebAssembly libraries:

- FFmpeg for video processing (`src/lib/ffmpeg.ts`)
- ImageMagick for image processing (`src/lib/imagemagick.ts`)
- pdf-lib for PDF manipulation (`src/lib/pdf.ts`)
- 7z-wasm for archive handling (`src/lib/archive.ts`)
- Pandoc for document conversion (`src/lib/pandoc.ts`)

**State Management**: Uses React Context API with specific providers:

- `ProcessingContext` - Global processing state and progress tracking
- `ThemeContext` - Dark/light theme management
- Tool-specific contexts for each category

**File Processing Flow**:

1. File upload via `FileUpload` component
2. Context provider manages tool state
3. Processing functions in `src/lib/` handle WASM operations
4. Progress tracked via `ProcessingContext`
5. Results downloaded to user's device

### Route Structure

Routes follow TanStack Router file-based conventions:

- `routes/index.tsx` - Landing page
- `routes/[category].tsx` - Category layout
- `routes/[category].[tool].tsx` - Individual tool pages
- `routes/__root.tsx` - Root layout with sidebar

### Component Patterns

- All UI components use Shadcn/ui with Tailwind CSS
- Tool layouts use `ToolLayout` wrapper component
- File uploads handled by reusable `FileUpload` component
- Responsive design with mobile-first approach

## Important Notes

### Development Guidelines

- Always prefer WASM packages over server-side processing
- Process files entirely in the browser for privacy
- Use existing tool contexts and processing patterns
- Follow Shadcn component patterns and Tailwind styling
- Maintain responsive design with mobile support

### Build Configuration

- Vite config includes manual chunk splitting for WASM libraries
- COOP/COEP headers required for SharedArrayBuffer support
- Source maps enabled for debugging
- Optimized build excludes FFmpeg and other WASM from pre-bundling

### Testing

- Tests run with Vitest and JSDOM
- Uses Testing Library for React component testing
- Test files should follow the pattern `*.test.ts` or `*.test.tsx`

### Security Headers

Development server includes required headers for WASM:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
