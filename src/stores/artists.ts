import { create } from 'zustand'
import type { Artist, ArtistInfo, SimilarArtist, ArtistSortOption } from '../api/types'
import { getArtists, getArtistInfo, getSimilarArtists } from '../api/artists'
import { toggleFavorite } from '../api/favorites'

type ArtistState = {
  artists: Artist[]
  isLoading: boolean
  error: string | null
  totalArtists: number
  currentPage: number
  pageSize: number
  sortBy: ArtistSortOption
  sortReverse: boolean
  currentArtist: ArtistInfo | null
  similarArtists: SimilarArtist[]
  isLoadingDetail: boolean
  detailError: string | null
  artistStack: string[]
  loadArtists: (reset?: boolean) => Promise<void>
  loadMore: () => Promise<void>
  loadArtistDetail: (artistHash: string, addToStack?: boolean) => Promise<void>
  navigateToSimilarArtist: (artistHash: string) => Promise<void>
  navigateBack: () => Promise<void>
  setSortOption: (option: ArtistSortOption, reverse?: boolean) => Promise<void>
  toggleArtistFavorite: (artist: Artist) => Promise<void>
  clearDetail: () => void
  refresh: () => Promise<void>
}

export const useArtistStore = create<ArtistState>((set, get) => ({
  artists: [],
  isLoading: false,
  error: null,
  totalArtists: 0,
  currentPage: 0,
  pageSize: 50,
  sortBy: 'name',
  sortReverse: false,
  currentArtist: null,
  similarArtists: [],
  isLoadingDetail: false,
  detailError: null,
  artistStack: [],
  loadArtists: async (reset = true) => {
    const state = get()
    if (state.isLoading) return
    set({ isLoading: true, error: null })
    const page = reset ? 0 : state.currentPage
    try {
      const response = await getArtists({
        start: page * state.pageSize,
        limit: state.pageSize,
        sortBy: state.sortBy,
        reverse: state.sortReverse
      })
      set({
        artists: reset ? response.artists : [...state.artists, ...response.artists],
        totalArtists: response.total,
        currentPage: page
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to load artists'
      set({ error: message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },
  loadMore: async () => {
    const state = get()
    if (state.isLoading) return
    const hasMore = state.artists.length < state.totalArtists
    if (!hasMore) return
    set({ currentPage: state.currentPage + 1 })
    await get().loadArtists(false)
  },
  loadArtistDetail: async (artistHash, addToStack = false) => {
    const state = get()
    set({ isLoadingDetail: true, detailError: null })
    if (addToStack && state.currentArtist) {
      set({ artistStack: [...state.artistStack, state.currentArtist.artist.artisthash] })
    }
    try {
      const [info, similar] = await Promise.all([
        getArtistInfo(artistHash),
        getSimilarArtists(artistHash)
      ])
      set({ currentArtist: info, similarArtists: similar })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to load artist'
      set({ detailError: message })
      throw e
    } finally {
      set({ isLoadingDetail: false })
    }
  },
  navigateToSimilarArtist: async (artistHash) => {
    await get().loadArtistDetail(artistHash, true)
  },
  navigateBack: async () => {
    const state = get()
    if (state.artistStack.length === 0) return
    const previousHash = state.artistStack[state.artistStack.length - 1]
    set({ artistStack: state.artistStack.slice(0, state.artistStack.length - 1) })
    await get().loadArtistDetail(previousHash, false)
  },
  setSortOption: async (option, reverse = false) => {
    set({ sortBy: option, sortReverse: reverse })
    await get().loadArtists(true)
  },
  toggleArtistFavorite: async (artist) => {
    try {
      await toggleFavorite(artist.artisthash, 'artist', false)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to toggle favorite'
      set({ error: message })
    }
  },
  clearDetail: () => {
    set({ currentArtist: null, similarArtists: [], artistStack: [], detailError: null })
  },
  refresh: async () => {
    await get().loadArtists(true)
  }
}))
