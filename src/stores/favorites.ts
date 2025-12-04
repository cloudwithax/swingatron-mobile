import { create } from 'zustand'
import type { Track, Album, Artist, FavoritesCount, RecentFavoriteItem } from '../api/types'
import { getFavorites, toggleFavorite } from '../api/favorites'

type FavoritesTab = 'tracks' | 'albums' | 'artists' | 'recents'

type FavoritesState = {
  tracks: Track[]
  albums: Album[]
  artists: Artist[]
  recents: RecentFavoriteItem[]
  count: FavoritesCount
  isLoading: boolean
  error: string | null
  activeTab: FavoritesTab
  loadFavorites: () => Promise<void>
  removeTrackFavorite: (track: Track) => Promise<void>
  removeAlbumFavorite: (album: Album) => Promise<void>
  removeArtistFavorite: (artist: Artist) => Promise<void>
  setActiveTab: (tab: FavoritesTab) => void
  refresh: () => Promise<void>
  clear: () => void
}

const emptyCount: FavoritesCount = { tracks: 0, albums: 0, artists: 0 }

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  tracks: [],
  albums: [],
  artists: [],
  recents: [],
  count: emptyCount,
  isLoading: false,
  error: null,
  activeTab: 'tracks',
  loadFavorites: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await getFavorites({
        track_limit: 100,
        album_limit: 100,
        artist_limit: 100
      })
      set({
        tracks: response.tracks,
        albums: response.albums,
        artists: response.artists,
        recents: response.recents,
        count: response.count
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to load favorites'
      set({ error: message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },
  removeTrackFavorite: async (track) => {
    const state = get()
    try {
      await toggleFavorite(track.trackhash, 'track', false)
      set({
        tracks: state.tracks.filter((t) => t.trackhash !== track.trackhash),
        recents: state.recents.filter(
          (r) => !(r.type === 'track' && r.item.trackhash === track.trackhash)
        ),
        count: { ...state.count, tracks: Math.max(0, state.count.tracks - 1) }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to remove favorite'
      set({ error: message })
    }
  },
  removeAlbumFavorite: async (album) => {
    const state = get()
    try {
      await toggleFavorite(album.albumhash, 'album', false)
      set({
        albums: state.albums.filter((a) => a.albumhash !== album.albumhash),
        count: { ...state.count, albums: Math.max(0, state.count.albums - 1) }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to remove favorite'
      set({ error: message })
    }
  },
  removeArtistFavorite: async (artist) => {
    const state = get()
    try {
      await toggleFavorite(artist.artisthash, 'artist', false)
      set({
        artists: state.artists.filter((a) => a.artisthash !== artist.artisthash),
        count: { ...state.count, artists: Math.max(0, state.count.artists - 1) }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to remove favorite'
      set({ error: message })
    }
  },
  setActiveTab: (tab) => {
    set({ activeTab: tab })
  },
  refresh: async () => {
    await get().loadFavorites()
  },
  clear: () => {
    set({
      tracks: [],
      albums: [],
      artists: [],
      recents: [],
      count: emptyCount,
      error: null
    })
  }
}))
