# Toolbox localization

English copy is split into `locales/en.json` for the homepage and navigation,
`en-tool-content.json` for tool descriptions and page metadata, and
`en-workspaces.json` for controls and messages in tool workspaces. Add a message key for each
new piece of UI text. Use named placeholders for values such as filenames and
page counts. Store message keys with any result text that can outlive a language
change, and format the message when the result is shown. Keep output filenames,
technical format identifiers, and user-supplied content as supplied.

## Initial languages

The first release adds Japanese, Spanish, Russian, Arabic, and Dutch. The
selection uses the written language of Toolbox's relevant Google Search
Console queries. Country impressions break ties between languages with equal
query impressions. Country is a proxy, and the data came from a site that
served English during the measured period.

The translations were back-translated and checked for placeholder coverage.
The review focused on workflow directions, privacy claims, and ambiguous
terms such as redaction and archive extraction.

## URLs and preferences

Existing English URLs are the fallback. The five other languages have an
explicit path prefix. Every indexable URL has localized prerendered content,
a self-canonical URL, and reciprocal `hreflang` links with English as
`x-default`. The sitemap includes every localized URL. The browser applies its
preferred supported language or the user's saved preference on entry through an
unprefixed URL. An explicit locale URL serves its own language.

Test catalog coverage and placeholders with `pnpm test`. The build
prerenders each supported locale from the same routes and local catalogs. No
translation service is needed in the app.
