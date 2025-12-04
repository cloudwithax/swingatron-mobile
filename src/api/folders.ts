import apiClient from './client'
import type { FolderContentRequest, FolderContentResponse, Track } from './types'

interface RootDirsResponse {
  root_dirs?: string[]
  dirs?: string[]
}

export async function getRootFolders(): Promise<string[]> {
  const response = await apiClient.get<RootDirsResponse>('/notsettings/get-root-dirs')
  if (response.data.root_dirs && response.data.root_dirs.length > 0) {
    return response.data.root_dirs
  }
  if (response.data.dirs && response.data.dirs.length > 0) {
    return response.data.dirs
  }
  return []
}

export async function getFolderContent(
  request: FolderContentRequest
): Promise<FolderContentResponse> {
  const response = await apiClient.post<FolderContentResponse>('/folder', {
    folder: request.folder,
    start: request.start,
    limit: request.limit,
    tracks_only: false
  })
  return response.data
}

export async function getAllTracksInFolder(folderPath: string): Promise<Track[]> {
  const response = await apiClient.post<{ tracks: Track[] }>('/folder/tracks', {
    folder: folderPath
  })
  return response.data.tracks
}

export function buildFolderPath(fullPath: string): string[] {
  const parts = fullPath.split(/[/\\]/).filter(Boolean)
  const paths: string[] = []

  let currentPath = ''
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    paths.push(currentPath)
  }

  return paths
}

export function getParentFolder(folderPath: string): string | null {
  const normalized = folderPath.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')

  if (lastSlash <= 0) return null
  return normalized.substring(0, lastSlash)
}
