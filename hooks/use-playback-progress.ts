import { useProgress, usePlaybackState } from "react-native-track-player";
import { State } from "react-native-track-player";

export type PlaybackProgress = {
  position: number;
  duration: number;
  isPlaying: boolean;
};

// provides real-time playback progress using react-native-track-player hooks
export function usePlaybackProgress(): PlaybackProgress {
  const { position, duration } = useProgress(250);
  const playbackState = usePlaybackState();

  const isPlaying = playbackState.state === State.Playing;

  // react-native-track-player uses seconds, convert to milliseconds
  // for backward compatibility with the rest of the app
  return {
    position: position * 1000,
    duration: duration * 1000,
    isPlaying,
  };
}
