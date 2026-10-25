import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import {
  resetWorkspaceState,
  useWorkspaceState,
} from '@/hooks/useWorkspaceState'
import { downloadBlob } from '@/lib/shared'
import { findTools } from '@/lib/tools'

vi.mock('@/lib/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shared')>()),
  downloadBlob: vi.fn(),
}))
afterEach(() => {
  cleanup()
  resetWorkspaceState()
  vi.clearAllMocks()
})

test('file and edits survive route unmount in memory and explicit clear removes them', () => {
  const file = new File(['private'], 'photo.png')
  const first = renderHook(() =>
    useWorkspaceState<{ file: File | null; areas: number[] }>('test.work', {
      file: null,
      areas: [],
    }),
  )
  act(() => first.result.current[1]({ file, areas: [1, 2] }))
  first.unmount()
  const returned = renderHook(() =>
    useWorkspaceState<{ file: File | null; areas: number[] }>('test.work', {
      file: null,
      areas: [],
    }),
  )
  expect(returned.result.current[0]).toEqual({ file, areas: [1, 2] })
  act(() => returned.result.current[1]({ file: null, areas: [] }))
  returned.unmount()
  const cleared = renderHook(() =>
    useWorkspaceState<{ file: File | null; areas: number[] }>('test.work', {
      file: null,
      areas: [],
    }),
  )
  expect(cleared.result.current[0].file).toBeNull()
  expect(cleared.result.current[0].areas).toEqual([])
})

test('result survives navigation but never leaks to a same-name replacement', () => {
  const source = new File(['one'], 'same.png')
  const output = { blob: new Blob(['output']), filename: 'resized.png' }
  const first = renderHook(() => useToolResult(source, 'resize-test'))
  act(() => first.result.current.setResult(output))
  first.unmount()
  const back = renderHook(({ file }) => useToolResult(file, 'resize-test'), {
    initialProps: { file: source },
  })
  expect(back.result.current.result).toBe(output)
  back.rerender({ file: new File(['two'], 'same.png') })
  expect(back.result.current.result).toBeNull()
  back.rerender({ file: source })
  expect(back.result.current.result).toBeNull()
})

test('larger outputs are explained and Download again reuses the existing output', () => {
  const blob = new Blob(['1234567890'])
  render(
    <ResultCard
      result={{
        blob,
        filename: 'output.mp4',
        sourceSize: 8,
        details: ['3 seconds · MP4'],
      }}
    />,
  )
  expect(screen.getByRole('status').textContent).toContain('25.0% larger')
  expect(screen.getByText(/The output is larger/)).toBeTruthy()
  expect(screen.getByText('3 seconds · MP4')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Download again' }))
  expect(downloadBlob).toHaveBeenCalledWith(blob, 'output.mp4')
})

test('task search understands everyday wording and excludes unavailable tools', () => {
  expect(findTools('shrink photo').map((tool) => tool.route)).toEqual([
    '/images/compress',
  ])
  expect(findTools('merge PDFs').map((tool) => tool.route)).toEqual([
    '/pdfs/merge',
  ])
  expect(findTools('split pdf')).toHaveLength(0)
  expect(findTools('definitely unavailable')).toHaveLength(0)
})

test('obsolete callbacks cannot replace a newer or remounted tool result', () => {
  const a = new File(['a'], 'same.png')
  const b = new File(['b'], 'same.png')
  const oldOutput = { blob: new Blob(['old']), filename: 'old.png' }
  const newOutput = { blob: new Blob(['new']), filename: 'new.png' }
  const hook = renderHook(({ file }) => useToolResult(file, 'late-result'), {
    initialProps: { file: a },
  })
  const obsolete = hook.result.current.setResult
  hook.rerender({ file: b })
  act(() => hook.result.current.setResult(newOutput))
  act(() => obsolete(oldOutput))
  expect(hook.result.current.result).toBe(newOutput)
  const abandoned = hook.result.current.setResult
  hook.unmount()
  const back = renderHook(() => useToolResult(b, 'late-result'))
  act(() => abandoned(oldOutput))
  expect(back.result.current.result).toBe(newOutput)
})
