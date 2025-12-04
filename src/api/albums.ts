import apiClient from './client'
import type { Album, AlbumWithInfo, PaginatedRequest, Track } from './types'

interface AlbumsResponse {
  items: Album[]
  total: number
}

export async function getAlbums(
  params: PaginatedRequest
): Promise<{ albums: Album[]; total: number }> {
  const response = await apiClient.get<AlbumsResponse>('/getall/albums', {
    params: {
      start: params.start,
      limit: params.limit,
      sortby: params.sortBy || 'created_date',
      reverse: params.reverse ?? true
    }
  })
  return {
    albums: response.data.items || [],
    total: response.data.total
  }
}

export async function getAlbumWithInfo(albumHash: string): Promise<AlbumWithInfo> {
  const response = await apiClient.post<AlbumWithInfo>('/album', {
    albumhash: albumHash
  })
  return response.data
}

export async function getAlbumTracks(albumHash: string): Promise<Track[]> {
  const response = await apiClient.get<Track[]>(`/album/${albumHash}/tracks`)
  return response.data
}

export async function getAlbumsByArtist(artistHash: string): Promise<Album[]> {
  const response = await apiClient.get<{ albums: Album[] }>(`/artist/${artistHash}/albums`)
  return response.data.albums
}
