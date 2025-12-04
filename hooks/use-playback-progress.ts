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
  if (!status) {
    return {
      position: 0,
      duration: 0,
      isPlaying: false,
    };
  }

  // expo-audio uses seconds for currentTime and duration
  // convert to milliseconds for backward compatibility with the rest of the app
  return {
    position: status.currentTime * 1000,
    duration: status.duration * 1000,
    isPlaying: status.playing,
  };
}
