import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { Dispatch, SetStateAction } from 'react'

interface WorkspaceEntry<T> {
  value: T
  initial: T
  listeners: Set<() => void>
}

// Session memory only: files and edits never enter localStorage or a server.
const workspace = new Map<string, WorkspaceEntry<unknown>>()

export function useWorkspaceState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const entry = useMemo(() => {
    const existing = workspace.get(key)
    if (existing) return existing as WorkspaceEntry<T>
    const value =
      typeof initial === 'function' ? (initial as () => T)() : initial
    const created: WorkspaceEntry<T> = {
      value,
      initial: value,
      listeners: new Set(),
    }
    workspace.set(key, created)
    return created
  }, [key, initial])
  const subscribe = useCallback(
    (listener: () => void) => {
      entry.listeners.add(listener)
      return () => {
        entry.listeners.delete(listener)
      }
    },
    [entry],
  )
  const snapshot = useCallback(() => entry.value, [entry])
  const value = useSyncExternalStore(subscribe, snapshot, snapshot)
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (update) => {
      entry.value =
        typeof update === 'function'
          ? (update as (previous: T) => T)(entry.value)
          : update
      for (const listener of entry.listeners) listener()
    },
    [entry],
  )
  return [value, setValue]
}

/** Release retained session work, also used to isolate component tests. */
export function resetWorkspaceState() {
  for (const entry of workspace.values()) {
    entry.value = entry.initial
    for (const listener of entry.listeners) listener()
  }
  workspace.clear()
}
