import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_TOKEN_KEY = "swing_access_token";
const REFRESH_TOKEN_KEY = "swing_refresh_token";
const BASE_URL_KEY = "swing_base_url";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let baseUrl: string | null = null;

const apiClient: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

async function loadBaseUrl(): Promise<string | null> {
  if (baseUrl) return baseUrl;
  const stored = await AsyncStorage.getItem(BASE_URL_KEY);
  if (!stored) {
    baseUrl = null;
    return null;
  }
  baseUrl = stored.endsWith("/") ? stored : stored + "/";
  apiClient.defaults.baseURL = baseUrl;
  return baseUrl;
}

export async function getBaseUrl(): Promise<string | null> {
  return loadBaseUrl();
}

export async function setBaseUrl(url: string): Promise<void> {
  let normalized = url.trim();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `http://${normalized}`;
  }
  if (!normalized.endsWith("/")) {
    normalized = `${normalized}/`;
  }
  baseUrl = normalized;
  apiClient.defaults.baseURL = normalized;
  await AsyncStorage.setItem(BASE_URL_KEY, normalized);
}

export async function clearBaseUrl(): Promise<void> {
  baseUrl = null;
  apiClient.defaults.baseURL = undefined;
  await AsyncStorage.removeItem(BASE_URL_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  if (accessToken !== null) return accessToken;
  const stored = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  accessToken = stored || null;
  return accessToken;
}

export async function getRefreshToken(): Promise<string | null> {
  if (refreshToken !== null) return refreshToken;
  const stored = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  refreshToken = stored || null;
  return refreshToken;
}

export async function setTokens(
  access: string,
  refresh: string
): Promise<void> {
  accessToken = access;
  refreshToken = refresh;
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

let isRefreshing = false;
let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}[] = [];

function processQueue(
  error: AxiosError | null,
  token: string | null = null
): void {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const url = await loadBaseUrl();
    if (url && !config.baseURL) {
      config.baseURL = url;
    }
    const token = await getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers && typeof token === "string") {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const currentRefreshToken = await getRefreshToken();
      if (!currentRefreshToken) {
        await clearTokens();
        processQueue(error, null);
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const url = await loadBaseUrl();
        const refreshUrl = `${url || ""}auth/refresh`;
        const response = await axios.post(
          refreshUrl,
          {},
          {
            headers: {
              Authorization: `Bearer ${currentRefreshToken}`,
            },
          }
        );

        const { accesstoken, refreshtoken: newRefreshToken } =
          response.data as {
            accesstoken: string;
            refreshtoken: string;
          };
        await setTokens(accesstoken, newRefreshToken);

        processQueue(null, accesstoken);
        isRefreshing = false;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accesstoken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        isRefreshing = false;
        await clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export function getTrackStreamUrl(trackHash: string, filepath: string): string {
  const url = baseUrl || "";
  const encodedPath = encodeURIComponent(filepath);
  return `${url}file/${trackHash}/legacy?filepath=${encodedPath}`;
}

export function getThumbnailUrl(
  image: string,
  size: "xsmall" | "small" | "medium" | "large" = "medium"
): string {
  const url = baseUrl || "";
  if (!image) return "";

  // server endpoints:
  // /img/thumbnail/<img> = large (512px)
  // /img/thumbnail/medium/<img> = medium (256px)
  // /img/thumbnail/small/<img> = small (96px)
  // /img/thumbnail/xsmall/<img> = xsmall (64px)
  if (size === "large") {
    return `${url}img/thumbnail/${image}`;
  }
  return `${url}img/thumbnail/${size}/${image}`;
}

export function getArtistImageUrl(image: string): string {
  const url = baseUrl || "";
  if (!image) return "";
  return `${url}img/artist/${image}`;
}

export function getPlaylistImageUrl(image: string | null | undefined): string {
  const url = baseUrl || "";
  if (!image || image === "None") return "";
  return `${url}img/playlist/${image}`;
}

export async function fetchLyrics(
  trackhash: string,
  filepath: string
): Promise<{
  lyrics: { time: number; text: string }[] | string[];
  synced: boolean;
  copyright?: string;
} | null> {
  try {
    const response = await apiClient.post("/lyrics", { trackhash, filepath });
    return response.data;
  } catch {
    return null;
  }
}

export async function searchAndDownloadLyrics(
  trackhash: string,
  title: string,
  artist: string,
  album: string,
  filepath: string
): Promise<{
  trackhash: string;
  lyrics: { time: number; text: string }[] | string | null;
} | null> {
  try {
    const response = await apiClient.post("/plugins/lyrics/search", {
      trackhash,
      title,
      artist,
      album,
      filepath,
    });
    return response.data;
  } catch {
    return null;
  }
}

export async function triggerLibraryScan(): Promise<void> {
  await apiClient.get("/notsettings/trigger-scan");
}

export default apiClient;
