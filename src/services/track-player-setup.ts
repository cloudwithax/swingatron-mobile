// track player setup and initialization
import TrackPlayer, {
  Capability,
  AppKilledPlaybackBehavior,
  RepeatMode,
} from "react-native-track-player";

let isSetup = false;

export async function setupPlayer(): Promise<boolean> {
  if (isSetup) {
    return true;
  }

  try {
    await TrackPlayer.setupPlayer({
      // buffer settings
      minBuffer: 15,
      maxBuffer: 50,
      playBuffer: 2.5,
      backBuffer: 0,
      // auto update metadata in notification / lock screen
      autoUpdateMetadata: true,
    });

    // configure capabilities for lock screen and notification controls
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      // progress update interval for the notification
      progressUpdateEventInterval: 1,
    });

    isSetup = true;
    return true;
  } catch (error) {
    console.error("[PLAYER] setup failed:", error);
    return false;
  }
}

// map our repeat mode type to track player's repeat mode
export function mapRepeatMode(mode: "off" | "all" | "one"): RepeatMode {
  switch (mode) {
    case "off":
      return RepeatMode.Off;
    case "all":
      return RepeatMode.Queue;
    case "one":
      return RepeatMode.Track;
    default:
      return RepeatMode.Off;
  }
}
