import { create } from 'zustand'
import type { HomeSection, HomeItem, HomeResponse } from '../api/types'
import { getHome } from '../api/home'

type HomeState = {
  recentlyPlayed: HomeSection | null
  recentlyAdded: HomeSection | null
  isLoading: boolean
  error: string | null
  recentlyPlayedItems: HomeItem[]
  recentlyAddedItems: HomeItem[]
  hasRecentlyPlayed: boolean
  hasRecentlyAdded: boolean
  fetchHome: (limit?: number) => Promise<void>
  clear: () => void
}

export const useHomeStore = create<HomeState>((set) => ({
  recentlyPlayed: null,
  recentlyAdded: null,
  isLoading: false,
  error: null,
  recentlyPlayedItems: [],
  recentlyAddedItems: [],
  hasRecentlyPlayed: false,
  hasRecentlyAdded: false,
  fetchHome: async (limit = 7) => {
    set({ isLoading: true, error: null })
    try {
      const response = await getHome(limit)
      let recentlyPlayed: HomeSection | null = null
      let recentlyAdded: HomeSection | null = null
      for (const section of response as HomeResponse[]) {
        if (section.recently_played) {
          recentlyPlayed = section.recently_played
        }
        if (section.recently_added) {
          recentlyAdded = section.recently_added
        }
      }
      const recentlyPlayedItems = recentlyPlayed ? recentlyPlayed.items : []
      const recentlyAddedItems = recentlyAdded ? recentlyAdded.items : []
      set({
        recentlyPlayed,
        recentlyAdded,
        recentlyPlayedItems,
        recentlyAddedItems,
        hasRecentlyPlayed: recentlyPlayedItems.length > 0,
        hasRecentlyAdded: recentlyAddedItems.length > 0
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to fetch home data'
      set({ error: message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },
  clear: () => {
    set({
      recentlyPlayed: null,
      recentlyAdded: null,
      recentlyPlayedItems: [],
      recentlyAddedItems: [],
      hasRecentlyPlayed: false,
      hasRecentlyAdded: false,
      error: null
    })
  }
}))
