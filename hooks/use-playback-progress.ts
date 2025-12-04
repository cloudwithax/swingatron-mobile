import { useSyncExternalStore } from "react";
import { subscribeToPlayback, getPlaybackSnapshot } from "@/src/stores/player";

export type PlaybackProgress = {
  position: number;
  duration: number;
  isPlaying: boolean;
};

// provides real-time playback progress using useSyncExternalStore
// this ensures proper integration with react's concurrent features
export function usePlaybackProgress(): PlaybackProgress {
  const status = useSyncExternalStore(
    subscribeToPlayback,
    getPlaybackSnapshot,
    getPlaybackSnapshot
  );

  // derive progress from status - this is fine to create new objects here
  // since useSyncExternalStore handles the subscription correctly
  if (!status || !status.isLoaded) {
    return {
      position: 0,
      duration: 0,
      isPlaying: false,
    };
  }

  // expo-av uses milliseconds for positionMillis and durationMillis
  return {
    position: status.positionMillis,
    duration: status.durationMillis ?? 0,
    isPlaying: status.isPlaying,
  };
}
