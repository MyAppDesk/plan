import { create } from 'zustand'
import type { Project } from '../types'
import { normalizeProject, useProject } from './useProject'
import { useDoors } from './useDoors'
import {
  deleteProjectData,
  migrateLegacy,
  newProjectId,
  readIndex,
  readProjectData,
  storageSize,
  writeIndex,
  writeProjectData,
  type LibraryEntry,
  type LibraryIndex,
} from './storage'

export type Screen = 'landing' | 'onboarding' | 'editor'

interface LibraryState {
  entries: LibraryEntry[]
  currentId: string | null
  screen: Screen
  cookiesAck: boolean
  seenLanding: boolean

  create: (project: Project, open?: boolean) => string
  open: (id: string) => void
  rename: (id: string, name: string) => void
  duplicate: (id: string) => void
  remove: (id: string) => void
  setScreen: (s: Screen) => void
  ackCookies: () => void
  bytes: () => number
}

let index: LibraryIndex = migrateLegacy(readIndex())

const persist = (patch: Partial<LibraryIndex>) => {
  index = { ...index, ...patch }
  writeIndex(index)
}

const entryFor = (id: string, project: Project): LibraryEntry => ({
  id,
  name: project.name || 'Untitled plan',
  updatedAt: Date.now(),
  floors: project.floors.length,
})

function initialScreen(): Screen {
  if (index.currentId && readProjectData(index.currentId)) return 'editor'
  if (index.entries.length) return 'editor'
  return index.seenLanding ? 'onboarding' : 'landing'
}

export const useLibrary = create<LibraryState>((set, get) => ({
  entries: index.entries,
  currentId: index.currentId,
  screen: initialScreen(),
  cookiesAck: index.cookiesAck,
  seenLanding: index.seenLanding,

  create: (project, open = true) => {
    const id = newProjectId()
    writeProjectData(id, project)
    const entries = [entryFor(id, project), ...index.entries]
    persist({ entries, currentId: open ? id : index.currentId, seenLanding: true })
    set({ entries, currentId: index.currentId, seenLanding: true })
    if (open) {
      useDoors.getState().closeAll()
      useProject.getState().loadProject(project, id)
      set({ screen: 'editor' })
    }
    return id
  },

  open: (id) => {
    const data = readProjectData(id)
    if (!data) return
    persist({ currentId: id })
    useDoors.getState().closeAll()
    useProject.getState().loadProject(data, id)
    set({ currentId: id, screen: 'editor' })
  },

  rename: (id, name) => {
    const entries = index.entries.map((e) => (e.id === id ? { ...e, name, updatedAt: Date.now() } : e))
    persist({ entries })
    set({ entries })
    if (useProject.getState().projectId === id) useProject.getState().setProjectName(name)
    const data = readProjectData(id)
    if (data) writeProjectData(id, { ...data, name })
  },

  duplicate: (id) => {
    const data = readProjectData(id)
    if (!data) return
    const copy = normalizeProject({ ...data, name: `${data.name} copy` })
    get().create(copy, false)
  },

  remove: (id) => {
    deleteProjectData(id)
    const entries = index.entries.filter((e) => e.id !== id)
    const wasCurrent = index.currentId === id
    const nextCurrent = wasCurrent ? (entries[0]?.id ?? null) : index.currentId
    persist({ entries, currentId: nextCurrent })
    set({ entries, currentId: nextCurrent })
    if (!wasCurrent) return
    const data = nextCurrent ? readProjectData(nextCurrent) : null
    if (data && nextCurrent) {
      useProject.getState().loadProject(data, nextCurrent)
      set({ screen: 'editor' })
    } else {
      set({ screen: 'onboarding' })
    }
  },

  setScreen: (screen) => {
    if (screen !== 'landing') persist({ seenLanding: true })
    set({ screen, seenLanding: index.seenLanding })
  },

  ackCookies: () => {
    persist({ cookiesAck: true })
    set({ cookiesAck: true })
  },

  bytes: () => storageSize(),
}))

/* open whatever was in use last time ---------------------------------- */
{
  const id = index.currentId ?? index.entries[0]?.id ?? null
  const data = id ? readProjectData(id) : null
  if (id && data) {
    useProject.getState().loadProject(data, id)
    if (index.currentId !== id) persist({ currentId: id })
  }
}

/* autosave ------------------------------------------------------------ */
let timer: number | undefined
useProject.subscribe((state, prev) => {
  if (state.project === prev.project) return
  const id = state.projectId
  if (!useLibrary.getState().entries.some((e) => e.id === id)) return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    writeProjectData(id, state.project)
    const entries = index.entries.map((e) => (e.id === id ? entryFor(id, state.project) : e))
    persist({ entries })
    useLibrary.setState({ entries })
  }, 400)
})
