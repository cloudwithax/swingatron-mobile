import apiClient from './client'
import type {
  ChartItemsParams,
  TopTracksResponse,
  TopArtistsResponse,
  TopAlbumsResponse,
  StatsResponse
} from './types'

export async function getTopTracks(params?: ChartItemsParams): Promise<TopTracksResponse> {
  const response = await apiClient.get<TopTracksResponse>('/logger/top-tracks', {
    params: {
      duration: params?.duration ?? 'year',
      limit: params?.limit ?? 10,
      order_by: params?.orderBy ?? 'playduration'
    }
  })
  return response.data
}

export async function getTopArtists(params?: ChartItemsParams): Promise<TopArtistsResponse> {
  const response = await apiClient.get<TopArtistsResponse>('/logger/top-artists', {
    params: {
      duration: params?.duration ?? 'year',
      limit: params?.limit ?? 10,
      order_by: params?.orderBy ?? 'playduration'
    }
  })
  return response.data
}

export async function getTopAlbums(params?: ChartItemsParams): Promise<TopAlbumsResponse> {
  const response = await apiClient.get<TopAlbumsResponse>('/logger/top-albums', {
    params: {
      duration: params?.duration ?? 'year',
      limit: params?.limit ?? 10,
      order_by: params?.orderBy ?? 'playduration'
    }
  })
  return response.data
}

export async function getStats(): Promise<StatsResponse> {
  const response = await apiClient.get<StatsResponse>('/logger/stats')
  return response.data
}
