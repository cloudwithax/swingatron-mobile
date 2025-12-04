import { create } from 'zustand'
import type {
  ChartDuration,
  ChartOrderBy,
  ChartTrack,
  ChartArtist,
  ChartAlbum,
  ChartScrobbleSummary,
  StatItem
} from '../api/types'
import { getTopTracks, getTopArtists, getTopAlbums, getStats } from '../api/stats'

type StatsState = {
  topTracks: ChartTrack[]
  topArtists: ChartArtist[]
  topAlbums: ChartAlbum[]
  weeklyStats: StatItem[]
  tracksScrobbles: ChartScrobbleSummary | null
  artistsScrobbles: ChartScrobbleSummary | null
  albumsScrobbles: ChartScrobbleSummary | null
  statsDates: string
  isLoadingTracks: boolean
  isLoadingArtists: boolean
  isLoadingAlbums: boolean
  isLoadingStats: boolean
  error: string | null
  duration: ChartDuration
  orderBy: ChartOrderBy
  limit: number
  loadTopTracks: () => Promise<void>
  loadTopArtists: () => Promise<void>
  loadTopAlbums: () => Promise<void>
  loadWeeklyStats: () => Promise<void>
  loadAllCharts: () => Promise<void>
  loadAll: () => Promise<void>
  setDuration: (duration: ChartDuration) => Promise<void>
  setOrderBy: (orderBy: ChartOrderBy) => Promise<void>
  setLimit: (limit: number) => Promise<void>
  reset: () => void
}

export const useStatsStore = create<StatsState>((set, get) => ({
  topTracks: [],
  topArtists: [],
  topAlbums: [],
  weeklyStats: [],
  tracksScrobbles: null,
  artistsScrobbles: null,
  albumsScrobbles: null,
  statsDates: '',
  isLoadingTracks: false,
  isLoadingArtists: false,
  isLoadingAlbums: false,
  isLoadingStats: false,
  error: null,
  duration: 'year',
  orderBy: 'playduration',
  limit: 20,
  loadTopTracks: async () => {
    const state = get()
    set({ isLoadingTracks: true, error: null })
    try {
      const response = await getTopTracks({
        duration: state.duration,
        limit: state.limit,
        orderBy: state.orderBy
      })
      set({ topTracks: response.tracks, tracksScrobbles: response.scrobbles })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to load top tracks'
      set({ error: message })
      throw e
    } finally {
      set({ isLoadingTracks: false })
    }
  },
  loadTopArtists: async () => {
    const state = get()
    set({ isLoadingArtists: true, error: null })
    try {
      const response = await getTopArtists({
        duration: state.duration,
        limit: state.limit,
        orderBy: state.orderBy
      })
      set({ topArtists: response.artists, artistsScrobbles: response.scrobbles })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to load top artists'
      set({ error: message })
      throw e
    } finally {
      set({ isLoadingArtists: false })
    }
  },
  loadTopAlbums: async () => {
    const state = get()
    set({ isLoadingAlbums: true, error: null })
    try {
      const response = await getTopAlbums({
        duration: state.duration,
        limit: state.limit,
        orderBy: state.orderBy
      })
      set({ topAlbums: response.albums, albumsScrobbles: response.scrobbles })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to load top albums'
      set({ error: message })
      throw e
    } finally {
      set({ isLoadingAlbums: false })
    }
  },
  loadWeeklyStats: async () => {
    set({ isLoadingStats: true, error: null })
    try {
      const response = await getStats()
      set({ weeklyStats: response.stats, statsDates: response.dates })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to load stats'
      set({ error: message })
      throw e
    } finally {
      set({ isLoadingStats: false })
    }
  },
  loadAllCharts: async () => {
    await Promise.all([get().loadTopTracks(), get().loadTopArtists(), get().loadTopAlbums()])
  },
  loadAll: async () => {
    await Promise.all([
      get().loadTopTracks(),
      get().loadTopArtists(),
      get().loadTopAlbums(),
      get().loadWeeklyStats()
    ])
  },
  setDuration: async (duration) => {
    const state = get()
    if (state.duration === duration) return
    set({ duration })
    await get().loadAllCharts()
  },
  setOrderBy: async (orderBy) => {
    const state = get()
    if (state.orderBy === orderBy) return
    set({ orderBy })
    await get().loadAllCharts()
  },
  setLimit: async (limit) => {
    const state = get()
    if (state.limit === limit) return
    set({ limit })
    await get().loadAllCharts()
  },
  reset: () => {
    set({
      topTracks: [],
      topArtists: [],
      topAlbums: [],
      weeklyStats: [],
      tracksScrobbles: null,
      artistsScrobbles: null,
      albumsScrobbles: null,
      statsDates: '',
      error: null
    })
  }
}))
