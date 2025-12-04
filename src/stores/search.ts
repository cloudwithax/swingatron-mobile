import { create } from 'zustand'
import type { Track, Album, Artist, SearchResults } from '../api/types'
import * as searchApi from '../api/search'
import { toggleFavorite } from '../api/favorites'

export type SearchCategory = 'all' | 'tracks' | 'albums' | 'artists'

type SearchState = {
  query: string
  activeCategory: SearchCategory
  isLoading: boolean
  error: string | null
  topResults: SearchResults | null
  tracks: Track[]
  albums: Album[]
  artists: Artist[]
  search: (q: string) => Promise<void>
  searchImmediate: (q: string) => Promise<void>
  setCategory: (category: SearchCategory) => Promise<void>
  toggleTrackFavorite: (track: Track) => Promise<void>
  clearResults: () => void
  clear: () => void
}

let debounceTimeout: ReturnType<typeof setTimeout> | null = null
const debounceDelay = 500

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  activeCategory: 'all',
  isLoading: false,
  error: null,
  topResults: null,
  tracks: [],
  albums: [],
  artists: [],
  search: async (searchQuery) => {
    set({ query: searchQuery })
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      get().clearResults()
      return
    }
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }
    debounceTimeout = setTimeout(async () => {
      set({ isLoading: true, error: null })
      try {
        const state = get()
        if (state.activeCategory === 'all') {
          const results = await searchApi.search(trimmed)
          set({ topResults: results })
        } else if (state.activeCategory === 'tracks') {
          const tracks = await searchApi.searchTracks(trimmed)
          set({ tracks })
        } else if (state.activeCategory === 'albums') {
          const albums = await searchApi.searchAlbums(trimmed)
          set({ albums })
        } else if (state.activeCategory === 'artists') {
          const artists = await searchApi.searchArtists(trimmed)
          set({ artists })
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'search failed'
        set({ error: message })
      } finally {
        set({ isLoading: false })
      }
    }, debounceDelay)
  },
  searchImmediate: async (searchQuery) => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
      debounceTimeout = null
    }
    const trimmed = searchQuery.trim()
    set({ query: trimmed, isLoading: true, error: null })
    if (!trimmed) {
      get().clearResults()
      set({ isLoading: false })
      return
    }
    try {
      const state = get()
      if (state.activeCategory === 'all') {
        const results = await searchApi.search(trimmed)
        set({ topResults: results })
      } else if (state.activeCategory === 'tracks') {
        const tracks = await searchApi.searchTracks(trimmed)
        set({ tracks })
      } else if (state.activeCategory === 'albums') {
        const albums = await searchApi.searchAlbums(trimmed)
        set({ albums })
      } else if (state.activeCategory === 'artists') {
        const artists = await searchApi.searchArtists(trimmed)
        set({ artists })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'search failed'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },
  setCategory: async (category) => {
    set({ activeCategory: category })
    const state = get()
    if (state.query) {
      await get().searchImmediate(state.query)
    }
  },
  toggleTrackFavorite: async (track) => {
    const state = get()
    try {
      const newStatus = await toggleFavorite(track.trackhash, 'track', track.is_favorite ?? false)
      if (state.topResults) {
        const updatedTopTracks = state.topResults.tracks.map((t) =>
          t.trackhash === track.trackhash ? { ...t, is_favorite: newStatus } : t
        )
        set({ topResults: { ...state.topResults, tracks: updatedTopTracks } })
      }
      const updatedTracks = state.tracks.map((t) =>
        t.trackhash === track.trackhash ? { ...t, is_favorite: newStatus } : t
      )
      set({ tracks: updatedTracks })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to toggle favorite'
      set({ error: message })
    }
  },
  clearResults: () => {
    set({ topResults: null, tracks: [], albums: [], artists: [] })
  },
  clear: () => {
    set({
      query: '',
      activeCategory: 'all',
      isLoading: false,
      error: null,
      topResults: null,
      tracks: [],
      albums: [],
      artists: []
    })
  }
}))
