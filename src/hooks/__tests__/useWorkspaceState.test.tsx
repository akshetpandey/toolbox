import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import {
  invalidateWorkspaceState,
  resetWorkspaceState,
  useWorkspaceState,
} from '@/hooks/useWorkspaceState'
import { useToolResult } from '@/components/ResultCard'

afterEach(() => {
  cleanup()
  resetWorkspaceState()
})

test('scope invalidation releases inactive work without touching preserved sources or other categories', () => {
  const file = new File(['private input'], 'photo.png')
  const output = { blob: new Blob(['private output']), filename: 'resized.png' }
  const files = renderHook(() => useWorkspaceState('images.files', [file]))
  const settings = renderHook(() =>
    useWorkspaceState('images.resize.settings', { source: file, width: '700' }),
  )
  const result = renderHook(() => useToolResult(file, 'images.resize'))
  const video = renderHook(() => useWorkspaceState('videos.test', 'retained'))
  act(() => result.result.current.setResult(output))
  const abandonedSettings = settings.result.current[1]
  const abandonedResult = result.result.current.setResult
  settings.unmount()
  result.unmount()
  act(() => {
    files.result.current[1]([])
    invalidateWorkspaceState(['images.', 'result.images.'], {
      preserve: ['images.files'],
    })
  })
  const returnedSettings = renderHook(() =>
    useWorkspaceState<{ source: File | null; width: string }>(
      'images.resize.settings',
      { source: null, width: '' },
    ),
  )
  const returnedResult = renderHook(() =>
    useToolResult(undefined, 'images.resize'),
  )
  expect(files.result.current[0]).toEqual([])
  expect(returnedSettings.result.current[0]).toEqual({
    source: null,
    width: '',
  })
  expect(returnedResult.result.current.result).toBeNull()
  expect(video.result.current[0]).toBe('retained')
  act(() => {
    abandonedSettings({ source: file, width: '999' })
    abandonedResult(output)
  })
  expect(returnedSettings.result.current[0]).toEqual({
    source: null,
    width: '',
  })
  expect(returnedResult.result.current.result).toBeNull()
})

test('mounted subscribers stay connected after invalidation and reject earlier generation setters', () => {
  const first = renderHook(() => useWorkspaceState('shared.counter', 0))
  const second = renderHook(() => useWorkspaceState('shared.counter', 0))
  act(() => first.result.current[1](7))
  const previousGeneration = second.result.current[1]
  expect(second.result.current[0]).toBe(7)
  act(() => invalidateWorkspaceState(['shared.']))
  expect(first.result.current[0]).toBe(0)
  expect(second.result.current[0]).toBe(0)
  act(() => first.result.current[1]((previous) => previous + 2))
  expect(first.result.current[0]).toBe(2)
  expect(second.result.current[0]).toBe(2)
  act(() => previousGeneration(99))
  expect(first.result.current[0]).toBe(2)
  expect(second.result.current[0]).toBe(2)
  act(() => second.result.current[1]((previous) => previous + 1))
  expect(first.result.current[0]).toBe(3)
})

test('a mounted result invalidates even when its source identity stays the same', () => {
  const file = new File(['source'], 'same.png')
  const oldOutput = { blob: new Blob(['old']), filename: 'old.png' }
  const newOutput = { blob: new Blob(['new']), filename: 'new.png' }
  const result = renderHook(() => useToolResult(file, 'images.redact'))
  act(() => result.result.current.setResult(oldOutput))
  const staleCompletion = result.result.current.setResult
  act(() => invalidateWorkspaceState(['result.images.']))
  expect(result.result.current.result).toBeNull()
  act(() => staleCompletion(oldOutput))
  expect(result.result.current.result).toBeNull()
  act(() => result.result.current.setResult(newOutput))
  expect(result.result.current.result).toBe(newOutput)
  result.unmount()
  const returned = renderHook(() => useToolResult(file, 'images.redact'))
  expect(returned.result.current.result).toBe(newOutput)
})

test('cleared defaults are evaluated once and cannot revive the original mounted File', () => {
  const file = new File(['first file'], 'original.mov')
  const other = new File(['next file'], 'replacement.mov')
  const initialProps: { source: File | null } = { source: file }
  const hook = renderHook(
    ({ source }: { source: File | null }) =>
      useWorkspaceState('videos.test-settings', { source, width: 'original' }),
    { initialProps },
  )
  act(() => hook.result.current[1]({ source: other, width: 'changed' }))
  hook.rerender({ source: null })
  act(() => invalidateWorkspaceState(['videos.']))
  expect(hook.result.current[0]).toEqual({ source: null, width: 'original' })
  const freshDefault = hook.result.current[0]
  hook.rerender({ source: null })
  expect(hook.result.current[0]).toBe(freshDefault)
  hook.unmount()
  const remounted = renderHook(() =>
    useWorkspaceState('videos.test-settings', { source: null, width: 'fresh' }),
  )
  expect(remounted.result.current[0]).toEqual({ source: null, width: 'fresh' })
})

test('reset invalidates active and abandoned work without disconnecting mounted hooks', () => {
  const hook = renderHook(() => useWorkspaceState('reset.test', 'default'))
  act(() => hook.result.current[1]('changed'))
  const stale = hook.result.current[1]
  act(() => resetWorkspaceState())
  expect(hook.result.current[0]).toBe('default')
  act(() => stale('obsolete'))
  expect(hook.result.current[0]).toBe('default')
  act(() => hook.result.current[1]('current'))
  expect(hook.result.current[0]).toBe('current')
})
