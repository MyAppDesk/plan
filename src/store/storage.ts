import type { Project } from '../types'
import { uid } from '../lib/geometry'

/**
 * Everything lives in this browser. The library index keeps the list of plans
 * and which one is open; each plan is stored under its own key so a big project
 * never has to be rewritten to touch another one.
 */

const INDEX_KEY = 'measure.library.v1'
const DATA_PREFIX = 'measure.project.'
const LEGACY_KEY = 'measure.project.v2'

export interface LibraryEntry {
  id: string
  name: string
  updatedAt: number
  floors: number
}

export interface LibraryIndex {
  entries: LibraryEntry[]
  currentId: string | null
  seenLanding: boolean
  cookiesAck: boolean
}

const EMPTY_INDEX: LibraryIndex = { entries: [], currentId: null, seenLanding: false, cookiesAck: false }

export function readIndex(): LibraryIndex {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return { ...EMPTY_INDEX }
    const parsed = JSON.parse(raw) as Partial<LibraryIndex>
    return {
      entries: parsed.entries ?? [],
      currentId: parsed.currentId ?? null,
      seenLanding: !!parsed.seenLanding,
      cookiesAck: !!parsed.cookiesAck,
    }
  } catch {
    return { ...EMPTY_INDEX }
  }
}

export function writeIndex(index: LibraryIndex) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    /* storage full or blocked — carry on in memory */
  }
}

export function readProjectData(id: string): Project | null {
  try {
    const raw = localStorage.getItem(DATA_PREFIX + id)
    return raw ? (JSON.parse(raw) as Project) : null
  } catch {
    return null
  }
}

export function writeProjectData(id: string, project: Project) {
  try {
    localStorage.setItem(DATA_PREFIX + id, JSON.stringify(project))
  } catch {
    /* ignore */
  }
}

export function deleteProjectData(id: string) {
  try {
    localStorage.removeItem(DATA_PREFIX + id)
  } catch {
    /* ignore */
  }
}

export function newProjectId() {
  return uid('prj')
}

/** Brings a plan saved by an earlier version into the library. */
export function migrateLegacy(index: LibraryIndex): LibraryIndex {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(LEGACY_KEY)
  } catch {
    return index
  }
  if (!raw) return index
  try {
    const project = JSON.parse(raw) as Project
    const id = newProjectId()
    writeProjectData(id, project)
    const next: LibraryIndex = {
      ...index,
      entries: [
        { id, name: project.name || 'My plan', updatedAt: Date.now(), floors: project.floors?.length ?? 1 },
        ...index.entries,
      ],
      currentId: index.currentId ?? id,
      seenLanding: true,
    }
    localStorage.removeItem(LEGACY_KEY)
    writeIndex(next)
    return next
  } catch {
    return index
  }
}

export function storageSize(): number {
  let total = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('measure.')) continue
      total += (localStorage.getItem(key)?.length ?? 0) * 2
    }
  } catch {
    /* ignore */
  }
  return total
}
