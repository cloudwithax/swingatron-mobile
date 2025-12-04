import axios from 'axios'
import md5 from 'crypto-js/md5'
import apiClient from './client'

const LASTFM_ENDPOINT = 'https://ws.audioscrobbler.com/2.0/?format=json'

interface LastfmTokenResponse {
  token: string
}

interface LastfmSessionResponse {
  status: string
  session_key: string | null
}

function getApiSignature(params: Record<string, string>, secret: string): string {
  const sortedKeys = Object.keys(params).sort()
  const concatenated = sortedKeys.reduce((acc, key) => acc + key + encodeURIComponent(params[key]), '')
  return md5(concatenated + secret).toString()
}

export async function fetchLastfmToken(apiKey: string, apiSecret: string): Promise<string> {
  const api_sig = getApiSignature({ api_key: apiKey, method: 'auth.getToken' }, apiSecret)
  const url =
    LASTFM_ENDPOINT +
    `&method=auth.getToken&api_key=${encodeURIComponent(apiKey)}&api_sig=${api_sig}`

  const response = await axios.post<LastfmTokenResponse>(url)

  if (!response.data?.token) {
    throw new Error('missing token in response')
  }

  return response.data.token
}

export async function createLastfmSession(token: string): Promise<string | null> {
  const response = await apiClient.post<LastfmSessionResponse>('/plugins/lastfm/session/create', {
    token
  })
  return response.data.session_key
}

export async function deleteLastfmSession(): Promise<void> {
  await apiClient.post('/plugins/lastfm/session/delete')
}
