import { pageAlternates, pageMeta } from '@/lib/seo'
import type { Page } from '@/lib/seo'
import type { Translator } from '@/i18n/messages'

export function PageHead({ page, t }: { page: Page; t: Translator }) {
  return (
    <>
      <title data-toolbox-head="">{page.title}</title>
      {pageMeta(page, t).map((meta) => (
        <meta key={meta.name ?? meta.property} data-toolbox-head="" {...meta} />
      ))}
      {page.canonical && (
        <>
          <link rel="canonical" href={page.canonical} data-toolbox-head="" />
          {pageAlternates(page.path).map((alternate) => (
            <link
              key={alternate.hrefLang}
              rel="alternate"
              data-toolbox-head=""
              {...alternate}
            />
          ))}
        </>
      )}
    </>
  )
}
