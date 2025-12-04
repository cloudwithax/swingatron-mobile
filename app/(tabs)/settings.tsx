import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Palette, Radii } from "@/constants/theme";
import { useAuthStore } from "@/src/stores";
import { fetchSettings } from "../../src/api/settings";
import {
  fetchLastfmToken,
  createLastfmSession,
  deleteLastfmSession,
} from "../../src/api/lastfm";
import { triggerLibraryScan } from "../../src/api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, serverUrl, isLoading, error, logout, clearServer } =
    useAuthStore();
  const [lastfmStatus, setLastfmStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  async function handleChangeServer() {
    await clearServer();
    router.replace("/login");
  }

  async function handleLastfmConnect() {
    setBusy(true);
    setLastfmStatus(null);
    try {
      const settings = await fetchSettings();
      if (!settings.lastfmApiKey || !settings.lastfmApiSecret) {
        setLastfmStatus("Last.fm is not configured on this server");
        return;
      }
      const token = await fetchLastfmToken(
        settings.lastfmApiKey,
        settings.lastfmApiSecret
      );
      const authUrl = `https://www.last.fm/api/auth?api_key=${encodeURIComponent(
        settings.lastfmApiKey
      )}&token=${encodeURIComponent(token)}`;
      await WebBrowser.openBrowserAsync(authUrl);
      const sessionKey = await createLastfmSession(token);
      if (sessionKey) {
        setLastfmStatus("Last.fm connected");
      } else {
        setLastfmStatus("Could not create Last.fm session");
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to connect to Last.fm";
      setLastfmStatus(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLastfmDisconnect() {
    setBusy(true);
    setLastfmStatus(null);
    try {
      await deleteLastfmSession();
      setLastfmStatus("Last.fm disconnected");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to disconnect Last.fm";
      setLastfmStatus(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTriggerScan() {
    setBusy(true);
    try {
      await triggerLibraryScan();
    } finally {
      setBusy(false);
    }
  }

  async function handleClearCache() {
    setBusy(true);
    try {
      // Keys to preserve (auth state and server config)
      const preserveKeys = ["swing_user", "swing_base_url"];
      
      // Get all keys and filter out the ones to preserve
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter((key) => !preserveKeys.includes(key));
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Settings</ThemedText>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Server</ThemedText>
          <View style={styles.sectionContent}>
            <ThemedText style={styles.sectionValue}>
              {serverUrl ?? "No server configured"}
            </ThemedText>
            <Pressable onPress={handleChangeServer} style={styles.button}>
              <Text style={styles.buttonLabel}>Change Server</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>
          <View style={styles.sectionContent}>
            <ThemedText style={styles.sectionValue}>
              {user ? user.username : "Not signed in"}
            </ThemedText>
            <Pressable onPress={handleLogout} style={styles.button}>
              <Text style={styles.buttonLabel}>Log Out</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Last.fm</ThemedText>
          <View style={styles.sectionContent}>
            <ThemedText style={styles.sectionDescription}>
              Connect your Last.fm account for scrobbling
            </ThemedText>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={handleLastfmConnect}
                style={styles.buttonSmall}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={Palette.background} size="small" />
                ) : (
                  <Text style={styles.buttonLabelSmall}>Connect</Text>
                )}
              </Pressable>
              <Pressable
                onPress={handleLastfmDisconnect}
                style={styles.buttonOutline}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={Palette.textPrimary} size="small" />
                ) : (
                  <Text style={styles.buttonLabelOutline}>Disconnect</Text>
                )}
              </Pressable>
            </View>
            {lastfmStatus ? (
              <Text style={styles.statusText}>{lastfmStatus}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Library</ThemedText>
          <View style={styles.sectionContent}>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={handleTriggerScan}
                style={styles.buttonSmall}
                disabled={busy}
              >
                <Text style={styles.buttonLabelSmall}>Trigger Scan</Text>
              </Pressable>
              <Pressable
                onPress={handleClearCache}
                style={styles.buttonOutline}
                disabled={busy}
              >
                <Text style={styles.buttonLabelOutline}>Clear Cache</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {(isLoading || busy) && (
          <ActivityIndicator
            style={styles.spinner}
            color={Palette.textPrimary}
          />
        )}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Palette.textPrimary,
    lineHeight: 34,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: Palette.surface,
    borderRadius: Radii.sm,
    padding: 12,
    gap: 10,
  },
  sectionValue: {
    fontSize: 14,
    color: Palette.textSecondary,
  },
  sectionDescription: {
    fontSize: 13,
    color: Palette.textMuted,
  },
  button: {
    borderRadius: Radii.xs,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    backgroundColor: Palette.primary,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Palette.onPrimary,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  buttonSmall: {
    borderRadius: Radii.xs,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Palette.primary,
    minWidth: 80,
    alignItems: "center",
  },
  buttonLabelSmall: {
    fontSize: 13,
    fontWeight: "500",
    color: Palette.onPrimary,
  },
  buttonOutline: {
    borderRadius: Radii.xs,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Palette.border,
    minWidth: 80,
    alignItems: "center",
  },
  buttonLabelOutline: {
    fontSize: 13,
    fontWeight: "500",
    color: Palette.textSecondary,
  },
  statusText: {
    fontSize: 13,
    color: Palette.textSecondary,
  },
  spinner: {
    marginTop: 16,
  },
  errorText: {
    marginTop: 8,
    paddingHorizontal: 16,
    color: Palette.caution,
    fontSize: 13,
  },
});
