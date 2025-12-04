import apiClient from './client'
import type { HomeResponse } from './types'

export async function getHome(limit: number = 7): Promise<HomeResponse[]> {
  const response = await apiClient.get<HomeResponse[]>('/nothome/', {
    params: { limit }
  })
  return response.data
}
