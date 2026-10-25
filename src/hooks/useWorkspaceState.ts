import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { Dispatch, SetStateAction } from 'react'

interface WorkspaceSnapshot<T> {
  value: T | undefined
  populated: boolean
  generation: number
}

interface WorkspaceEntry<T> {
  snapshot: WorkspaceSnapshot<T>
  listeners: Set<() => void>
}

// Session memory only: files and edits never enter localStorage or a server.
const workspace = new Map<string, WorkspaceEntry<unknown>>()

/**
 * Retain work across route changes. A scoped invalidation starts a new setter
 * generation, so include the returned setter in memoized callback dependencies.
 */
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
      snapshot: { value, populated: true, generation: 0 },
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
  const snapshot = useCallback(() => entry.snapshot, [entry])
  const current = useSyncExternalStore(subscribe, snapshot, snapshot)
  // Invalidating a mounted key must keep its subscribers connected without
  // retaining a second copy of the original defaults (which may contain Files).
  // A cleared key reads fresh defaults from its current consumer until written.
  const fallback = useMemo(
    () =>
      current.populated
        ? undefined
        : typeof initial === 'function'
          ? (initial as () => T)()
          : initial,
    // Defaults are evaluated once per invalidation, just like useState's initial
    // value. Inline objects/functions must not change them on every render.
    [entry, current.generation, current.populated],
  )
  const value = current.populated ? (current.value as T) : (fallback as T)
  const generation = current.generation
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (update) => {
      // An async completion from a cleared/replaced workspace cannot resurrect
      // its old files, edits, or output, including after its route unmounts.
      if (entry.snapshot.generation !== generation) return
      const previous = entry.snapshot.populated
        ? (entry.snapshot.value as T)
        : (fallback as T)
      const next =
        typeof update === 'function'
          ? (update as (previous: T) => T)(previous)
          : update
      if (entry.snapshot.populated && Object.is(previous, next)) return
      entry.snapshot = {
        value: next,
        populated: true,
        generation,
      }
      for (const listener of entry.listeners) listener()
    },
    [entry, generation, fallback],
  )
  return [value, setValue]
}

/** Release dependent session work without resetting other categories or sources. */
export function invalidateWorkspaceState(
  prefixes: readonly string[],
  { preserve = [] }: { preserve?: readonly string[] } = {},
) {
  const invalidated = []
  for (const [key, entry] of workspace) {
    if (
      preserve.includes(key) ||
      !prefixes.some((prefix) => key.startsWith(prefix))
    )
      continue
    entry.snapshot = {
      value: undefined,
      populated: false,
      generation: entry.snapshot.generation + 1,
    }
    // Keep the empty entry identity even when a route is currently unmounted.
    // A concurrent mount may already have read it but not subscribed yet.
    // Only its small key/generation shell remains; all cached data is released.
    invalidated.push(entry)
  }
  // Drop every affected value before notifying any active consumer.
  for (const entry of invalidated) {
    for (const listener of entry.listeners) listener()
  }
}

/** Release retained session work, also used to isolate component tests. */
export function resetWorkspaceState() {
  invalidateWorkspaceState([''])
}
