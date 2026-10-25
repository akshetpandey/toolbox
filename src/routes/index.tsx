import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ArrowRight, Search, ShieldCheck, X, ArrowUpRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { allTools, findTools, toolCategories } from '@/lib/tools'
import { getToolRequestUrl } from '@/lib/toolRequests'

export const Route = createFileRoute('/')({
  component: App,
  head: () => ({
    meta: [
      {
        title: 'Toolbox - Free Open Source Browser-Based File Processing Tools',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based file processing tools. Convert, compress, and edit images, videos, PDFs, archives, and office documents entirely in your browser. No uploads, privacy-focused.',
      },
      {
        name: 'keywords',
        content:
          'free file tools, browser file processing, open source, image converter, video compressor, PDF editor, privacy-focused, no upload',
      },
      {
        property: 'og:title',
        content:
          'Toolbox - Free Open Source Browser-Based File Processing Tools',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based file processing tools. Process files entirely in your browser with complete privacy.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
    ],
  }),
})

export function App() {
  const [query, setQuery] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const clearSearch = () => {
    setQuery('')
    searchInput.current?.focus()
  }
  const matches = findTools(query)
  const popularRoutes = [
    '/images/resize',
    '/images/compress',
    '/pdfs/merge',
    '/office-documents/convert',
    '/videos/trim',
    '/archives/extract',
  ]
  const popular = popularRoutes.flatMap((route) =>
    allTools.filter((tool) => tool.route === route),
  )
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12 lg:py-16">
        <header className="max-w-3xl">
          <p className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Private by design
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Private file tools,
            <br className="hidden sm:block" /> right in your browser.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Resize, convert, and organize your files. Everything is processed on
            your device, with no uploads or account required.
          </p>
        </header>
        <div className="relative mt-8 max-w-2xl">
          <label
            htmlFor="tool-search"
            className="mb-2 block text-sm font-medium"
          >
            What would you like to do?
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchInput}
              id="tool-search"
              type="search"
              placeholder="Try “JPG to PNG” or “merge PDFs”"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-14 rounded-xl bg-card pl-12 pr-12 text-base"
            />
            {query && (
              <Button
                aria-label="Clear search"
                variant="ghost"
                size="icon"
                onClick={clearSearch}
                className="absolute right-1 top-1"
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        <section aria-labelledby="popular-tools" className="mt-9">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="popular-tools" className="text-lg font-semibold">
              {query.trim() ? 'Search results' : 'Popular tools'}
            </h2>
            {query.trim() && (
              <p role="status" className="text-sm text-muted-foreground">
                {matches.length} {matches.length === 1 ? 'tool' : 'tools'} found
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(query.trim() ? matches : popular).map((tool) => (
              <Link
                key={tool.route}
                to={tool.route}
                className="tool-card group flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-ring"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className={`rounded-lg bg-muted p-2.5 ${tool.color}`}>
                    <tool.icon aria-hidden="true" className="size-5" />
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1"
                  />
                </div>
                <h3 className="font-semibold">{tool.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {tool.description}
                </p>
              </Link>
            ))}
          </div>
          {query.trim() && matches.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-medium">No tools found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a file type such as image, PDF, or ZIP, or browse the
                categories below.
              </p>
              <Button variant="outline" className="mt-4" onClick={clearSearch}>
                Show popular tools
              </Button>
            </div>
          )}
          {query.trim() && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Missing the tool you need?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Suggest a feature on GitHub. Your search is included in the
                  issue draft.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <a
                  href={getToolRequestUrl(query)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Request a tool
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </a>
              </Button>
            </div>
          )}
        </section>
        <section
          aria-labelledby="all-tools"
          className="mt-12 border-t border-border pt-8"
        >
          <h2 id="all-tools" className="mb-6 text-lg font-semibold">
            Explore all tools
          </h2>
          <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {toolCategories.map((category) => (
              <div key={category.path}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <category.icon
                    aria-hidden="true"
                    className={`size-4 ${category.color}`}
                  />
                  {category.name}
                </h3>
                <ul>
                  {category.tools.map((tool) => (
                    <li key={tool.route}>
                      <Link
                        to={tool.route}
                        className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-ring"
                      >
                        {tool.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>No signup. No ads. Your files stay yours.</p>
          <div className="flex flex-wrap gap-5">
            <a
              className="inline-flex min-h-11 items-center gap-1 hover:text-foreground"
              href="https://github.com/akshetpandey/toolbox"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
              <ArrowUpRight aria-hidden="true" className="size-3" />
            </a>
            <a
              className="inline-flex min-h-11 items-center hover:text-foreground"
              href="https://github.com/akshetpandey/toolbox/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              Report an issue
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
