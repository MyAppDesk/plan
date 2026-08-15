import { create } from 'zustand'
import type { ID } from '../types'

interface DoorState {
  /** doors the walker has opened — everything starts closed */
  open: Record<ID, boolean>
  near: { id: ID; open: boolean; label: string } | null
  toggle: (id: ID) => void
  setNear: (near: DoorState['near']) => void
  closeAll: () => void
}

/**
 * Which doors are standing open is a property of the walkthrough, not of the
 * plan, so it lives outside the project store and never reaches undo or disk.
 */
export const useDoors = create<DoorState>((set) => ({
  open: {},
  near: null,
  toggle: (id) => set((s) => ({ open: { ...s.open, [id]: !s.open[id] } })),
  setNear: (near) =>
    set((s) => (s.near?.id === near?.id && s.near?.open === near?.open ? s : { near })),
  closeAll: () => set({ open: {}, near: null }),
}))
