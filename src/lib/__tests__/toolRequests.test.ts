import { expect, test } from 'vitest'
import { getToolRequestUrl } from '@/lib/toolRequests'

test('opens a prefilled issue draft for the correct repository', () => {
  const url = new URL(getToolRequestUrl('remove image background'))
  expect(url.origin + url.pathname).toBe(
    'https://github.com/akshetpandey/toolbox/issues/new',
  )
  expect(url.searchParams.get('title')).toBe(
    'Tool request: remove image background',
  )
  expect(url.searchParams.get('body')).toContain('remove image background')
  expect(url.searchParams.get('body')).toContain('What should the tool do?')
  expect([...url.searchParams.keys()]).toEqual(['title', 'body'])
})

test('encodes search text without introducing extra URL parameters or markup', () => {
  const query = 'JPG & PNG? #file <script> 🌄'
  const url = new URL(getToolRequestUrl(query))
  expect(url.searchParams.get('title')).toBe(`Tool request: ${query}`)
  expect(url.searchParams.get('body')).toContain(query)
  expect(url.hash).toBe('')
  expect([...url.searchParams.keys()]).toEqual(['title', 'body'])
})

test('keeps long or multiline queries within a bounded issue draft', () => {
  const url = new URL(
    getToolRequestUrl(`  remove\n background\t${'x'.repeat(2000)} `),
  )
  const title = url.searchParams.get('title')!
  expect(title).toHaveLength('Tool request: '.length + 200)
  expect(title.startsWith('Tool request: remove background ')).toBe(true)
  expect(title).not.toContain('\n')
  expect(url.toString().length).toBeLessThan(2000)
})

test('blank input produces a useful generic request', () => {
  const url = new URL(getToolRequestUrl('   '))
  expect(url.searchParams.get('title')).toBe('Tool request')
  expect(url.searchParams.get('body')).toContain(
    'Describe the task you need help with.',
  )
})
