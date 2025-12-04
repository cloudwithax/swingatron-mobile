import apiClient, { setTokens, setBaseUrl } from "./client";
import type {
  User,
  UsersResponse,
  LoginRequest,
  LoginResponse,
  PairResponse,
  RefreshTokenResponse,
} from "./types";
import AsyncStorage from "@react-native-async-storage/async-storage";

// decode jwt payload to extract user info (matches desktop implementation)
function decodeJwtPayload(token: string): User | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub as User;
  } catch {
    return null;
  }
}

export async function getUsers(): Promise<User[]> {
  const response = await apiClient.get<UsersResponse>("/auth/users");
  return response.data.users;
}

export async function login(
  credentials: LoginRequest
): Promise<{ response: LoginResponse; user: User | null }> {
  const response = await apiClient.post<LoginResponse>(
    "/auth/login",
    credentials
  );
  const { accesstoken, refreshtoken } = response.data;
  await setTokens(accesstoken, refreshtoken);

  // extract user from jwt token (same approach as desktop client)
  const user = decodeJwtPayload(accesstoken);

  if (user) {
    await AsyncStorage.setItem("swing_user", JSON.stringify(user));
  }

  return { response: response.data, user };
}

export async function pairWithQrCode(
  code: string
): Promise<{ response: PairResponse; user: User | null }> {
  const response = await apiClient.get<PairResponse>(
    `/auth/pair?code=${encodeURIComponent(code)}`
  );
  const { accesstoken, refreshtoken } = response.data;
  await setTokens(accesstoken, refreshtoken);

  // extract user from jwt token (same approach as desktop client)
  const user = decodeJwtPayload(accesstoken);

  if (user) {
    await AsyncStorage.setItem("swing_user", JSON.stringify(user));
  }

  return { response: response.data, user };
}

export async function refreshToken(
  refreshTokenValue: string
): Promise<RefreshTokenResponse> {
  const response = await apiClient.post<RefreshTokenResponse>(
    "/auth/refresh",
    {},
    {
      headers: {
        Authorization: `Bearer ${refreshTokenValue}`,
      },
    }
  );
  const { accesstoken, refreshtoken } = response.data;
  await setTokens(accesstoken, refreshtoken);
  return response.data;
}

export async function validateAndSetBaseUrl(url: string): Promise<boolean> {
  let normalizedUrl = url.trim();
  if (
    !normalizedUrl.startsWith("http://") &&
    !normalizedUrl.startsWith("https://")
  ) {
    normalizedUrl = `http://${normalizedUrl}`;
  }
  if (!normalizedUrl.endsWith("/")) {
    normalizedUrl = `${normalizedUrl}/`;
  }

  const response = await apiClient.get<UsersResponse>(
    `${normalizedUrl}auth/users`
  );
  if (response.status === 200) {
    await setBaseUrl(normalizedUrl);
    return true;
  }
  return false;
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem("swing_user");
}
