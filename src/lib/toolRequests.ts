/** Open a reviewable issue draft; nothing is submitted from the app. */
export function getToolRequestUrl(query: string) {
  const request = query.trim().replace(/\s+/gu, ' ').slice(0, 200)
  const url = new URL('https://github.com/akshetpandey/toolbox/issues/new')
  url.searchParams.set(
    'title',
    request ? `Tool request: ${request}` : 'Tool request',
  )
  url.searchParams.set(
    'body',
    [
      '### What would you like to do?',
      request || 'Describe the task you need help with.',
      '',
      '### What should the tool do?',
      'Describe your input file, the result you need, and any relevant options.',
      '',
      'Requested from Toolbox search.',
    ].join('\n'),
  )
  return url.toString()
}
