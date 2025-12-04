import { useEffect, useState } from "react";
import { StyleSheet, ActivityIndicator, View } from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthStore, usePlayerStore } from "@/src/stores";
import { ToastProvider } from "@/components/toast";
import { Palette } from "@/constants/theme";

export const unstable_settings = {
  // default to auth flow so unauthenticated users land there first
  initialRouteName: "(auth)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const clearQueue = usePlayerStore((state) => state.clearQueue);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function initializeApp() {
      // clear any stale player state on app startup
      void clearQueue();
      await restoreSession();
      setIsReady(true);
    }

    void initializeApp();
  }, [clearQueue, restoreSession]);

  // handle navigation based on auth state once the app is ready
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (isAuthenticated && inAuthGroup) {
      // user is authenticated but on auth screens, redirect to main app
      router.replace("/");
    } else if (!isAuthenticated && !inAuthGroup) {
      // user is not authenticated and trying to access protected routes
      router.replace("/login");
    }
  }, [isReady, isAuthenticated, segments, router]);

  // show loading screen while determining auth state
  if (!isReady) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Palette.primary} />
            </View>
            <StatusBar style="auto" />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <ToastProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
              <Stack.Screen
                name="favorites"
                options={{ presentation: "card" }}
              />
              <Stack.Screen name="folders" options={{ presentation: "card" }} />
              <Stack.Screen name="stats" options={{ presentation: "card" }} />
              <Stack.Screen
                name="lyrics"
                options={{
                  presentation: "transparentModal",
                  animation: "fade",
                  contentStyle: { backgroundColor: "transparent" },
                }}
              />
              <Stack.Screen
                name="nowplaying"
                options={{
                  animation: "slide_from_bottom",
                  presentation: "card",
                }}
              />
              <Stack.Screen name="queue" options={{ presentation: "card" }} />
              <Stack.Screen
                name="modal"
                options={{
                  presentation: "modal",
                  title: "Modal",
                  headerShown: true,
                }}
              />
            </Stack>
            <StatusBar style="auto" />
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#151515",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#151515",
    justifyContent: "center",
    alignItems: "center",
  },
});
