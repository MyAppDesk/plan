import { create } from 'zustand'

interface CursorState {
  x: number
  y: number
  scale: number
  hint: string
  set: (v: Partial<CursorState>) => void
}

/** Kept out of the project store so plan movement never touches history. */
export const useCursor = create<CursorState>((set) => ({
  x: 0,
  y: 0,
  scale: 60,
  hint: '',
  set: (v) => set(v),
}))
