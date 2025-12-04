import { create } from 'zustand'
import type { Playlist, PlaylistWithTracks, Track } from '../api/types'
import {
  getAllPlaylists,
  getPlaylist,
  createPlaylist as apiCreatePlaylist,
  deletePlaylist as apiDeletePlaylist,
  togglePinPlaylist,
  addTracksToPlaylist,
  removeTracksFromPlaylist
} from '../api/playlists'

type PlaylistState = {
  playlists: Playlist[]
  isLoading: boolean
  error: string | null
  currentPlaylist: PlaylistWithTracks | null
  isLoadingDetail: boolean
  detailError: string | null
  loadPlaylists: () => Promise<void>
  loadPlaylistDetail: (playlistId: number | string) => Promise<void>
  createPlaylist: (name: string) => Promise<Playlist | null>
  deletePlaylist: (playlistId: number) => Promise<boolean>
  togglePin: (playlistId: number) => Promise<boolean>
  addTracks: (playlistId: number, tracks: Track[]) => Promise<boolean>
  removeTrack: (playlistId: number, track: Track, index: number) => Promise<boolean>
  clearDetail: () => void
  refresh: () => Promise<void>
  updatePlaylistInList: (updated: Playlist) => void
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  isLoading: false,
  error: null,
  currentPlaylist: null,
  isLoadingDetail: false,
  detailError: null,
  loadPlaylists: async () => {
    set({ isLoading: true, error: null })
    try {
      const playlists = await getAllPlaylists()
      set({ playlists })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to load playlists'
      set({ error: message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },
  loadPlaylistDetail: async (playlistId) => {
    set({ isLoadingDetail: true, detailError: null })
    try {
      const playlist = await getPlaylist(playlistId)
      set({ currentPlaylist: playlist })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to load playlist'
      set({ detailError: message })
      throw e
    } finally {
      set({ isLoadingDetail: false })
    }
  },
  createPlaylist: async (name) => {
    try {
      const playlist = await apiCreatePlaylist(name)
      if (playlist) {
        const state = get()
        set({ playlists: [playlist, ...state.playlists] })
      }
      return playlist
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to create playlist'
      set({ error: message })
      return null
    }
  },
  deletePlaylist: async (playlistId) => {
    try {
      const success = await apiDeletePlaylist(playlistId)
      if (success) {
        const state = get()
        set({
          playlists: state.playlists.filter((p) => p.id !== playlistId),
          currentPlaylist:
            state.currentPlaylist && state.currentPlaylist.info.id === playlistId
              ? null
              : state.currentPlaylist
        })
      }
      return success
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to delete playlist'
      set({ error: message })
      return false
    }
  },
  togglePin: async (playlistId) => {
    try {
      const success = await togglePinPlaylist(playlistId)
      if (success) {
        const state = get()
        const playlists = state.playlists.map((p) =>
          p.id === playlistId ? { ...p, pinned: !p.pinned } : p
        )
        let currentPlaylist = state.currentPlaylist
        if (currentPlaylist && currentPlaylist.info.id === playlistId) {
          currentPlaylist = {
            ...currentPlaylist,
            info: { ...currentPlaylist.info, pinned: !currentPlaylist.info.pinned }
          }
        }
        set({ playlists, currentPlaylist })
      }
      return success
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to toggle pin'
      set({ error: message })
      return false
    }
  },
  addTracks: async (playlistId, tracks) => {
    try {
      const success = await addTracksToPlaylist(playlistId, tracks)
      if (success) {
        const state = get()
        if (state.currentPlaylist && state.currentPlaylist.info.id === playlistId) {
          await get().loadPlaylistDetail(playlistId)
        }
      }
      return success
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to add tracks'
      set({ error: message })
      return false
    }
  },
  removeTrack: async (playlistId, track, index) => {
    try {
      const success = await removeTracksFromPlaylist(playlistId, [
        { trackhash: track.trackhash, index }
      ])
      if (success) {
        const state = get()
        if (state.currentPlaylist && state.currentPlaylist.info.id === playlistId) {
          const tracks = state.currentPlaylist.tracks.filter((_, i) => i !== index)
          const info = { ...state.currentPlaylist.info, count: state.currentPlaylist.info.count - 1 }
          set({ currentPlaylist: { ...state.currentPlaylist, tracks, info } })
        }
      }
      return success
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to remove track'
      set({ error: message })
      return false
    }
  },
  clearDetail: () => {
    set({ currentPlaylist: null, detailError: null })
  },
  refresh: async () => {
    await get().loadPlaylists()
  },
  updatePlaylistInList: (updated) => {
    const state = get()
    const playlists = state.playlists.map((p) => (p.id === updated.id ? updated : p))
    set({ playlists })
  }
}))
