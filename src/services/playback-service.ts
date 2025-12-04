// playback service for react-native-track-player
// this runs in the background and handles remote control events
import TrackPlayer, { Event } from "react-native-track-player";
import { usePlayerStore } from "../stores/player";

export async function PlaybackService() {
  // handle remote play from lock screen / notification
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play();
  });

  // handle remote pause from lock screen / notification
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });

  // handle remote stop
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    await TrackPlayer.reset();
  });

  // handle remote next from lock screen / notification
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    const { next } = usePlayerStore.getState();
    void next();
  });

  // handle remote previous from lock screen / notification
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    const { previous } = usePlayerStore.getState();
    void previous();
  });

  // handle remote seek from lock screen / notification
  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    // event.position is in seconds
    await TrackPlayer.seekTo(event.position);
  });

  // handle playback queue ended - auto advance handled by our store logic
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    // check if we should loop or advance
    const state = usePlayerStore.getState();
    if (state.repeatMode === "all" && state.queue.length > 0) {
      // restart from beginning
      await state.skipTo(0);
    }
  });

  // handle playback state changes for UI updates
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    // state changes are handled through usePlaybackState hook
  });

  // handle track changes - sync with our store
  TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    async (event) => {
      // track changes are managed by our store
    }
  );
}
