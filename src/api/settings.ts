import apiClient from './client'

export interface SettingsResponse {
  lastfmApiKey?: string
  lastfmApiSecret?: string
  lastfmSessionKey?: string
}

export async function fetchSettings(): Promise<SettingsResponse> {
  const response = await apiClient.get<SettingsResponse>('/notsettings')
  return response.data
}
