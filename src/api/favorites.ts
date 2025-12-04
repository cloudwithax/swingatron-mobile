import apiClient from './client'
import type { FavoriteRequest, FavoritesResponse, FavoritesRequestParams } from './types'

export async function getFavorites(
  params: FavoritesRequestParams = {}
): Promise<FavoritesResponse> {
  const response = await apiClient.get<FavoritesResponse>('/favorites', {
    params: {
      track_limit: params.track_limit ?? 50,
      album_limit: params.album_limit ?? 50,
      artist_limit: params.artist_limit ?? 50
    }
  })
  return response.data
}

export async function addFavorite(request: FavoriteRequest): Promise<void> {
  await apiClient.post('/favorites/add', request)
}

export async function removeFavorite(request: FavoriteRequest): Promise<void> {
  await apiClient.post('/favorites/remove', request)
}

export async function toggleFavorite(
  hash: string,
  type: 'track' | 'album' | 'artist',
  addToFavorites: boolean
): Promise<boolean> {
  if (addToFavorites) {
    await addFavorite({ hash, type })
    return true
  }
  await removeFavorite({ hash, type })
  return false
}
