import { create } from 'zustand'
import type { Folder, Track } from '../api/types'
import { getRootFolders, getFolderContent } from '../api/folders'
import { toggleFavorite } from '../api/favorites'

type FolderState = {
  folders: Folder[]
  tracks: Track[]
  rootFolders: string[]
  currentPath: string
  pathHistory: string[]
  isLoading: boolean
  error: string | null
  totalItems: number
  currentPage: number
  pageSize: number
  loadRootFolders: () => Promise<void>
  loadFolderContent: (path: string, reset?: boolean) => Promise<void>
  loadMore: () => Promise<void>
  navigateToFolder: (folder: Folder) => Promise<void>
  navigateToRootFolder: (path: string) => Promise<void>
  navigateBack: () => Promise<void>
  navigateToPathPart: (index: number) => Promise<void>
  toggleTrackFavorite: (track: Track) => Promise<void>
  updateTrackFavorite: (track: Track, isFavorite: boolean) => void
  refresh: () => Promise<void>
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  tracks: [],
  rootFolders: [],
  currentPath: '',
  pathHistory: [],
  isLoading: false,
  error: null,
  totalItems: 0,
  currentPage: 0,
  pageSize: 50,
  loadRootFolders: async () => {
    set({ isLoading: true, error: null })
    try {
      const roots = await getRootFolders()
      set({
        rootFolders: roots,
        currentPath: '',
        pathHistory: [],
        folders: [],
        tracks: [],
        totalItems: 0,
        currentPage: 0
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to load root folders'
      set({ error: message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },
  loadFolderContent: async (path, reset = true) => {
    const state = get()
    set({ isLoading: true, error: null })
    const page = reset ? 0 : state.currentPage
    try {
      const response = await getFolderContent({
        folder: path,
        start: page * state.pageSize,
        limit: state.pageSize
      })
      set({
        folders: reset ? response.folders : [...state.folders, ...response.folders],
        tracks: reset ? response.tracks : [...state.tracks, ...response.tracks],
        totalItems: response.total,
        currentPath: path,
        currentPage: page
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to load folder content'
      set({ error: message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },
  loadMore: async () => {
    const state = get()
    if (state.isLoading) return
    const loadedCount = state.folders.length + state.tracks.length
    const hasMore = loadedCount < state.totalItems
    if (!hasMore) return
    set({ currentPage: state.currentPage + 1 })
    await get().loadFolderContent(state.currentPath, false)
  },
  navigateToFolder: async (folder) => {
    const state = get()
    set({ pathHistory: [...state.pathHistory, state.currentPath] })
    await get().loadFolderContent(folder.path, true)
  },
  navigateToRootFolder: async (path) => {
    set({ pathHistory: [] })
    await get().loadFolderContent(path, true)
  },
  navigateBack: async () => {
    const state = get()
    if (state.pathHistory.length > 0) {
      const previousPath = state.pathHistory[state.pathHistory.length - 1]
      set({ pathHistory: state.pathHistory.slice(0, state.pathHistory.length - 1) })
      await get().loadFolderContent(previousPath, true)
    } else {
      await get().loadRootFolders()
    }
  },
  navigateToPathPart: async (index) => {
    const state = get()
    if (!state.currentPath) return
    const parts = state.currentPath.split(/[/\\]/).filter(Boolean)
    const targetParts = parts.slice(0, index + 1)
    const newPath = targetParts.join('/')
    const historyIndex = state.pathHistory.length - (parts.length - index - 1)
    const newHistory = state.pathHistory.slice(0, Math.max(0, historyIndex))
    set({ pathHistory: newHistory })
    await get().loadFolderContent(newPath, true)
  },
  toggleTrackFavorite: async (track) => {
    const state = get()
    try {
      const newStatus = await toggleFavorite(track.trackhash, 'track', track.is_favorite ?? false)
      const updatedTracks = state.tracks.map((t) =>
        t.trackhash === track.trackhash ? { ...t, is_favorite: newStatus } : t
      )
      set({ tracks: updatedTracks })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to toggle favorite'
      set({ error: message })
    }
  },
  updateTrackFavorite: (track, isFavorite) => {
    const state = get()
    const updatedTracks = state.tracks.map((t) =>
      t.trackhash === track.trackhash ? { ...t, is_favorite: isFavorite } : t
    )
    set({ tracks: updatedTracks })
  },
  refresh: async () => {
    const state = get()
    if (state.currentPath) {
      await get().loadFolderContent(state.currentPath, true)
    } else {
      await get().loadRootFolders()
    }
  }
}))
