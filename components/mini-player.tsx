// note: this component is deprecated in favor of ExpandablePlayer
// kept for potential backward compatibility or reference

import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Palette, Radii } from "@/constants/theme";
import { usePlayerStore, useNowPlayingTransitionStore } from "@/src/stores";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { getThumbnailUrl } from "@/src/api/client";

export function MiniPlayer() {
  // get real-time playback progress directly from expo-av
  const { position, duration, isPlaying } = usePlaybackProgress();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const pendingTrack = usePlayerStore((s) => s.pendingTrack);
  const displayTrack = pendingTrack || currentTrack;
  const isLoading = usePlayerStore((s) => s.isLoading);
  const pendingTrackHash = usePlayerStore((s) => s.pendingTrackHash);
  const isControlsDisabled = isLoading || !!pendingTrackHash;
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);

  const expand = useNowPlayingTransitionStore((s) => s.expand);

  if (!displayTrack) {
    return null;
  }

  const progress = duration > 0 ? position / duration : 0;
  const thumbnailUrl = displayTrack.image
    ? getThumbnailUrl(displayTrack.image, "small")
    : null;

  const artistNames =
    displayTrack.artists && displayTrack.artists.length > 0
      ? displayTrack.artists.map((a) => a.name).join(", ")
      : "Unknown Artist";

  async function handlePlayPause() {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }

  return (
    <View style={styles.container}>
      {/* progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* main content */}
      <View style={styles.content}>
        {/* artwork */}
        <Pressable onPress={expand}>
          <View style={styles.artwork}>
            {thumbnailUrl ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={styles.artworkImage}
              />
            ) : (
              <View style={styles.artworkPlaceholder}>
                <Ionicons
                  name="musical-note"
                  size={18}
                  color={Palette.textMuted}
                />
              </View>
            )}
          </View>
        </Pressable>

        {/* track info */}
        <Pressable style={styles.trackInfo} onPress={expand}>
          <ThemedText style={styles.trackTitle} numberOfLines={1}>
            {displayTrack.title}
          </ThemedText>
          <ThemedText style={styles.trackArtist} numberOfLines={1}>
            {artistNames}
          </ThemedText>
        </Pressable>

        {/* controls */}
        <View style={styles.controls}>
          <Pressable
            onPress={() => void previous()}
            style={styles.controlButton}
            hitSlop={8}
            disabled={isControlsDisabled}
          >
            <Ionicons
              name="play-skip-back"
              size={22}
              color={
                isControlsDisabled ? Palette.textMuted : Palette.textPrimary
              }
            />
          </Pressable>

          <Pressable
            onPress={() => void handlePlayPause()}
            style={styles.playButton}
            disabled={isControlsDisabled}
          >
            {isControlsDisabled ? (
              <ActivityIndicator size="small" color={Palette.background} />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={24}
                color={Palette.background}
              />
            )}
          </Pressable>

          <Pressable
            onPress={() => void next()}
            style={styles.controlButton}
            hitSlop={8}
            disabled={isControlsDisabled}
          >
            <Ionicons
              name="play-skip-forward"
              size={22}
              color={
                isControlsDisabled ? Palette.textMuted : Palette.textPrimary
              }
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Palette.surface,
    borderTopWidth: 1,
    borderTopColor: Palette.borderVariant,
  },
  progressBar: {
    height: 3,
    backgroundColor: Palette.surfaceVariant,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Palette.primary,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: Radii.sm,
    overflow: "hidden",
    backgroundColor: Palette.surfaceVariant,
  },
  artworkImage: {
    width: 44,
    height: 44,
  },
  artworkPlaceholder: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: "center",
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.textPrimary,
  },
  trackArtist: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
  },
  controlButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
});
