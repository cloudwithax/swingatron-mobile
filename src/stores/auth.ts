import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { User } from '../api/types'
import * as authApi from '../api/auth'
import { getAccessToken, getBaseUrl, clearTokens, clearBaseUrl } from '../api/client'

type AuthState = {
  user: User | null
  users: User[]
  isLoading: boolean
  error: string | null
  serverUrl: string | null
  hasToken: boolean
  isAuthenticated: boolean
  isServerConfigured: boolean
  fetchUsers: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  loginWithQrCode: (code: string) => Promise<void>
  validateServer: (url: string) => Promise<boolean>
  logout: () => Promise<void>
  clearServer: () => Promise<void>
  restoreSession: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  users: [],
  isLoading: false,
  error: null,
  serverUrl: null,
  hasToken: false,
  isAuthenticated: false,
  isServerConfigured: false,
  fetchUsers: async () => {
    set({ isLoading: true, error: null })
    try {
      const users = await authApi.getUsers()
      set({ users })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to fetch users'
      set({ error: message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },
  login: async (username, password) => {
    set({ isLoading: true, error: null })
    try {
      const { user } = await authApi.login({ username, password })
      set({
        user,
        hasToken: true,
        isAuthenticated: true
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'login failed'
      set({ error: message, hasToken: false, isAuthenticated: false })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },
  loginWithQrCode: async (code) => {
    set({ isLoading: true, error: null })
    try {
      const { user } = await authApi.pairWithQrCode(code)
      set({
        user,
        hasToken: true,
        isAuthenticated: true
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'qr code login failed'
      set({ error: message, hasToken: false, isAuthenticated: false })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },
  validateServer: async (url) => {
    set({ isLoading: true, error: null })
    try {
      const isValid = await authApi.validateAndSetBaseUrl(url)
      if (!isValid) {
        set({ error: 'could not connect to server', serverUrl: null, isServerConfigured: false })
        return false
      }
      const baseUrl = await getBaseUrl()
      set({ serverUrl: baseUrl, isServerConfigured: !!baseUrl })
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'failed to connect to server'
      set({ error: message, isServerConfigured: false })
      return false
    } finally {
      set({ isLoading: false })
    }
  },
  logout: async () => {
    await clearTokens()
    await AsyncStorage.removeItem('swing_user')
    set({
      user: null,
      hasToken: false,
      isAuthenticated: false
    })
  },
  clearServer: async () => {
    await clearBaseUrl()
    const logout = get().logout
    await logout()
    set({ serverUrl: null, isServerConfigured: false })
  },
  restoreSession: async () => {
    const storedUser = await AsyncStorage.getItem('swing_user')
    const token = await getAccessToken()
    const baseUrl = await getBaseUrl()
    let parsedUser: User | null = null
    if (storedUser) {
      try {
        parsedUser = JSON.parse(storedUser) as User
      } catch {
        parsedUser = null
      }
    }
    const hasToken = !!token
    const isAuthenticated = hasToken && !!parsedUser
    set({
      user: parsedUser,
      hasToken,
      isAuthenticated,
      serverUrl: baseUrl,
      isServerConfigured: !!baseUrl
    })
    return isAuthenticated
  }
}))
