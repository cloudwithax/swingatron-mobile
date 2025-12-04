import apiClient from './client'
import type {
  Playlist,
  PlaylistWithTracks,
  Track,
  CreatePlaylistRequest,
  AddToPlaylistRequest
} from './types'

export async function getAllPlaylists(noImages: boolean = false): Promise<Playlist[]> {
  const url = noImages ? '/playlists?no_images=true' : '/playlists'
  const response = await apiClient.get(url)

  if (response.data?.data) {
    return response.data.data as Playlist[]
  }

  return []
}

export async function getPlaylist(
  playlistId: number | string,
  noTracks: boolean = false,
  start: number = 0,
  limit: number = 50
): Promise<PlaylistWithTracks | null> {
  const url = `/playlists/${playlistId}?no_tracks=${noTracks}&start=${start}&limit=${limit}`
  const response = await apiClient.get(url)

  if (response.data) {
    return response.data as PlaylistWithTracks
  }

  return null
}

export async function createPlaylist(name: string): Promise<Playlist | null> {
  const response = await apiClient.post('/playlists/new', { name } as CreatePlaylistRequest)

  if (response.status === 201 && response.data?.playlist) {
    return response.data.playlist as Playlist
  }

  return null
}

export async function updatePlaylist(
  playlistId: number,
  formData: FormData
): Promise<Playlist | null> {
  const response = await apiClient.put(`/playlists/${playlistId}/update`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })

  if (response.data?.data) {
    return response.data.data as Playlist
  }

  return null
}

export async function deletePlaylist(playlistId: number): Promise<boolean> {
  const response = await apiClient.delete(`/playlists/${playlistId}/delete`)
  return response.status === 200
}

export async function addToPlaylist(
  playlistId: number,
  props: AddToPlaylistRequest
): Promise<boolean> {
  const response = await apiClient.post(`/playlists/${playlistId}/add`, props)

  if (response.status === 409) {
    return false
  }

  return response.status === 200 || response.status === 201
}

export async function addTracksToPlaylist(playlistId: number, tracks: Track[]): Promise<boolean> {
  const itemhash = tracks.map((t) => t.trackhash).join(',')
  return addToPlaylist(playlistId, { itemtype: 'tracks', itemhash })
}

export async function addAlbumToPlaylist(playlistId: number, albumhash: string): Promise<boolean> {
  return addToPlaylist(playlistId, { itemtype: 'album', itemhash: albumhash })
}

export async function addArtistToPlaylist(
  playlistId: number,
  artisthash: string
): Promise<boolean> {
  return addToPlaylist(playlistId, { itemtype: 'artist', itemhash: artisthash })
}

export async function removeTracksFromPlaylist(
  playlistId: number,
  tracks: { trackhash: string; index: number }[]
): Promise<boolean> {
  const response = await apiClient.post(`/playlists/${playlistId}/remove-tracks`, { tracks })
  return response.status === 200
}

export async function removeBannerImage(playlistId: number): Promise<Playlist | null> {
  const response = await apiClient.delete(`/playlists/${playlistId}/remove-img`)

  if (response.status === 200 && response.data?.playlist) {
    return response.data.playlist as Playlist
  }

  return null
}

export async function togglePinPlaylist(playlistId: number): Promise<boolean> {
  const response = await apiClient.get(`/playlists/${playlistId}/pin_unpin`)
  return response.status === 200
}

export async function saveAsPlaylist(
  itemtype: string,
  props: Record<string, unknown>
): Promise<Playlist | null> {
  const response = await apiClient.post('/playlists/save-item', { itemtype, ...props })

  if (response.status === 201 && response.data?.playlist) {
    return response.data.playlist as Playlist
  }

  return null
}

export async function saveTrackAsPlaylist(
  playlistName: string,
  trackhash: string
): Promise<Playlist | null> {
  return saveAsPlaylist('tracks', { itemhash: trackhash, playlist_name: playlistName })
}

export async function saveAlbumAsPlaylist(
  playlistName: string,
  albumhash: string
): Promise<Playlist | null> {
  return saveAsPlaylist('album', { itemhash: albumhash, playlist_name: playlistName })
}
