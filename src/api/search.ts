import apiClient from './client'
import type { Album, Artist, SearchResults, Track } from './types'

export async function search(query: string, limit: number = 5): Promise<SearchResults> {
  const response = await apiClient.get<SearchResults>('/search/top', {
    params: { q: query, limit }
  })
  return response.data
}

export async function searchTracks(query: string, limit: number = -1): Promise<Track[]> {
  const response = await apiClient.get<{ tracks: Track[] }>('/search', {
    params: { q: query, limit, itemtype: 'tracks' }
  })
  return response.data.tracks
}

export async function searchAlbums(query: string, limit: number = -1): Promise<Album[]> {
  const response = await apiClient.get<{ albums: Album[] }>('/search', {
    params: { q: query, limit, itemtype: 'albums' }
  })
  return response.data.albums
}

export async function searchArtists(query: string, limit: number = -1): Promise<Artist[]> {
  const response = await apiClient.get<{ artists: Artist[] }>('/search', {
    params: { q: query, limit, itemtype: 'artists' }
  })
  return response.data.artists
}
