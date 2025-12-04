import apiClient from './client'

export interface LogTrackRequest {
  trackhash: string
  duration: number
  source: string
  timestamp: number
}

export async function logTrackPlayback(
  trackHash: string,
  duration: number,
  source: string = 'mobile'
): Promise<void> {
  const request: LogTrackRequest = {
    trackhash: trackHash,
    duration: Math.floor(duration),
    source,
    timestamp: Math.floor(Date.now() / 1000)
  }

  await apiClient.post('/logger/track/log', request)
}
