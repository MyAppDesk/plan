type Handler = () => void

const listeners = new Map<string, Set<Handler>>()

export function on(event: string, fn: Handler): () => void {
  const set = listeners.get(event) ?? new Set<Handler>()
  set.add(fn)
  listeners.set(event, set)
  return () => set.delete(fn)
}

export function emit(event: string): void {
  listeners.get(event)?.forEach((fn) => fn())
}
