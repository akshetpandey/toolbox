import { useLocale, useTranslator } from '@/i18n/LocaleContext'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ArrowRight, Search, ShieldCheck, X, ArrowUpRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { getToolCatalog } from '@/lib/toolCatalog'
import type { findTools } from '@/lib/toolSearch'
import { getHomePage } from '@/lib/seo'
import { getToolRequestUrl } from '@/lib/toolRequests'

export const Route = createFileRoute('/')({
  // The homepage is part of the app shell. Tools keep their split routes.
  codeSplitGroupings: [],
  component: App,
})

function App() {
  const { language } = useLocale()
  const t = useTranslator()
  const { tools: allTools, categories: toolCategories } = getToolCatalog(t)
  const homePage = getHomePage(t)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<
    'idle' | 'loading' | 'unavailable' | typeof findTools
  >('idle')
  const searchInput = useRef<HTMLInputElement>(null)
  const loadSearch = () => {
    if (search === 'loading' || typeof search === 'function') return
    setSearch('loading')
    void import('@/lib/toolSearch').then(
      (module) => setSearch(() => module.findTools),
      () => setSearch('unavailable'),
    )
  }
  const clearSearch = () => {
    setQuery('')
    searchInput.current?.focus()
  }
  const hasQuery = Boolean(query.trim())
  const matches =
    hasQuery && typeof search === 'function' ? search(query, t, language) : null
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
            {t('indexPrivateByDesign')}
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {homePage.heading}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {homePage.intro}
          </p>
        </header>
        <div className="relative mt-8 max-w-2xl">
          <label
            htmlFor="tool-search"
            className="mb-2 block text-sm font-medium"
          >
            {t('indexWhatWouldYouLikeToDo')}
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={searchInput}
              id="tool-search"
              type="search"
              placeholder={t('indexTryJPGToPNGOrMerge')}
              value={query}
              onFocus={loadSearch}
              onChange={(event) => {
                setQuery(event.target.value)
                if (event.target.value.trim()) loadSearch()
              }}
              className="flex h-14 w-full min-w-0 rounded-xl border border-input bg-card py-1 px-12 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
            />
            {query && (
              <button
                type="button"
                aria-label={t('indexClearSearch')}
                onClick={clearSearch}
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'icon',
                  className: 'absolute end-1 top-1',
                })}
              >
                <X aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <section aria-labelledby="popular-tools" className="mt-9">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="popular-tools" className="text-lg font-semibold">
              {hasQuery ? t('indexSearchResults') : t('indexPopularTools')}
            </h2>
            {hasQuery && (
              <p role="status" className="text-sm text-muted-foreground">
                {matches
                  ? t('indexFound', { count: matches.length }, matches.length)
                  : search === 'unavailable'
                    ? t('indexSearchCouldNotLoadTryTyping')
                    : t('indexLoadingSearch')}
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(hasQuery ? (matches ?? []) : popular).map((tool) => (
              <Link
                key={language + tool.route}
                to={tool.route}
                className="tool-card group flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-ring"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className={`rounded-lg bg-muted p-2.5 ${tool.color}`}>
                    <tool.icon aria-hidden="true" className="size-5" />
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  />
                </div>
                <h3 className="font-semibold">{tool.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {tool.description}
                </p>
              </Link>
            ))}
          </div>
          {matches?.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-medium">{t('indexNoToolsFound')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('indexTryAFileTypeSuchAs')}
              </p>
              <button
                type="button"
                className={buttonVariants({
                  variant: 'outline',
                  className: 'mt-4',
                })}
                onClick={clearSearch}
              >
                {t('indexShowPopularTools')}
              </button>
            </div>
          )}
          {hasQuery && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t('indexMissingTheToolYouNeed')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('indexSuggestAFeatureOnGitHubYour')}
                </p>
              </div>
              <a
                className={buttonVariants({
                  variant: 'outline',
                  className: 'w-full sm:w-auto',
                })}
                href={getToolRequestUrl(query)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('indexRequestATool')}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </div>
          )}
        </section>
        <section
          aria-labelledby="all-tools"
          className="mt-12 border-t border-border pt-8"
        >
          <h2 id="all-tools" className="mb-6 text-lg font-semibold">
            {t('indexExploreAllTools')}
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
                        key={language}
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
          <p>{t('indexNoSignupNoAdsYourFiles')}</p>
          <div className="flex flex-wrap gap-5">
            <a
              className="inline-flex min-h-11 items-center gap-1 hover:text-foreground"
              href="https://github.com/akshetpandey/toolbox"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('indexGitHub')}
              <ArrowUpRight aria-hidden="true" className="size-3" />
            </a>
            <a
              className="inline-flex min-h-11 items-center hover:text-foreground"
              href="https://github.com/akshetpandey/toolbox/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('indexReportAnIssue')}
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
