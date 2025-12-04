import TrackPlayer from "react-native-track-player";
import { registerRootComponent } from "expo";
import { ExpoRoot } from "expo-router";

// playback service handles remote control events (lock screen, notification, etc.)
import { PlaybackService } from "./src/services/playback-service";

export function App() {
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
TrackPlayer.registerPlaybackService(() => PlaybackService);
