import { useEffect } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Palette, Radii } from "@/constants/theme";
import { usePlayerStore } from "@/src/stores";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { getThumbnailUrl } from "@/src/api/client";
import type { Track } from "@/src/api/types";

interface TrackItemProps {
  track: Track;
  index?: number;
  showArtwork?: boolean;
  showAlbum?: boolean;
  onPlay?: (track: Track) => void;
  onMenu?: (track: Track) => void;
  onFavorite?: (track: Track) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// animated equalizer bar that bounces between random heights
function AnimatedBar({
  color,
  width,
  minHeight,
  maxHeight,
  delay,
}: {
  color: string;
  width: number;
  minHeight: number;
  maxHeight: number;
  delay: number;
}) {
  const height = useSharedValue(minHeight);

  useEffect(() => {
    // create a looping animation with random-ish heights using sequence
    const mid1 = minHeight + (maxHeight - minHeight) * 0.7;
    const mid2 = minHeight + (maxHeight - minHeight) * 0.4;
    const mid3 = minHeight + (maxHeight - minHeight) * 0.9;

    height.value = withRepeat(
      withSequence(
        withTiming(maxHeight, {
          duration: 180 + delay,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(mid2, { duration: 150, easing: Easing.inOut(Easing.ease) }),
        withTiming(mid1, { duration: 200, easing: Easing.inOut(Easing.ease) }),
        withTiming(minHeight, {
          duration: 170,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(mid3, { duration: 190, easing: Easing.inOut(Easing.ease) }),
        withTiming(mid1, { duration: 160, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [height, minHeight, maxHeight, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          backgroundColor: color,
          borderRadius: width / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

// animated equalizer bars container
function AnimatedEqualizer({
  color,
  isOverlay,
}: {
  color: string;
  isOverlay?: boolean;
}) {
  const barWidth = isOverlay ? 4 : 3;
  const minH = isOverlay ? 4 : 3;
  const maxH = isOverlay ? 18 : 16;
  const gap = isOverlay ? 3 : 2;

  return (
    <View style={[styles.equalizerBars, { gap, height: maxH }]}>
      <AnimatedBar
        color={color}
        width={barWidth}
        minHeight={minH}
        maxHeight={maxH * 0.6}
        delay={0}
      />
      <AnimatedBar
        color={color}
        width={barWidth}
        minHeight={minH}
        maxHeight={maxH}
        delay={80}
      />
      <AnimatedBar
        color={color}
        width={barWidth}
        minHeight={minH}
        maxHeight={maxH * 0.75}
        delay={40}
      />
    </View>
  );
}

// renders the playing state indicator overlay on album art
function PlayingIndicatorOverlay({
  isCurrentTrack,
  isLoading,
  isPlaying,
}: {
  isCurrentTrack: boolean;
  isLoading: boolean;
  isPlaying: boolean;
}) {
  if (!isCurrentTrack) return null;

  if (isLoading) {
    return <Ionicons name="sync" size={18} color="#ffffff" />;
  }
  if (isPlaying) {
    return <AnimatedEqualizer color="#ffffff" isOverlay />;
  }
  return <Ionicons name="pause" size={18} color="#ffffff" />;
}

export function TrackItem({
  track,
  index,
  showArtwork = false,
  showAlbum = false,
  onPlay,
  onMenu,
  onFavorite,
}: TrackItemProps) {
  const { isPlaying } = usePlaybackProgress();
  const { currentTrack, isLoading } = usePlayerStore();
  const isCurrentTrack = currentTrack?.trackhash === track.trackhash;
  const thumbnailUrl = track.image
    ? getThumbnailUrl(track.image, "small")
    : null;

  const artistNames =
    track.artists && track.artists.length > 0
      ? track.artists.map((a) => a.name).join(", ")
      : "Unknown Artist";
  const separator = "\u2022";

  function handlePress() {
    onPlay?.(track);
  }

  function handleMenuPress() {
    onMenu?.(track);
  }

  function handleFavoritePress() {
    onFavorite?.(track);
  }

  return (
    <Pressable
      style={[styles.container, isCurrentTrack && styles.containerActive]}
      onPress={handlePress}
      onLongPress={handleMenuPress}
    >
      <View style={styles.leadingContainer}>
        {showArtwork && thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.artwork} />
        ) : showArtwork ? (
          <View style={[styles.artwork, styles.artworkPlaceholder]}>
            <Ionicons name="musical-note" size={18} color={Palette.textMuted} />
          </View>
        ) : thumbnailUrl ? (
          // show album art with playing indicator overlay when current track
          <ImageBackground
            source={{ uri: thumbnailUrl }}
            style={styles.artworkWithOverlay}
            imageStyle={styles.artworkImage}
          >
            {isCurrentTrack && <View style={styles.artworkDarkOverlay} />}
            <PlayingIndicatorOverlay
              isCurrentTrack={isCurrentTrack}
              isLoading={isLoading}
              isPlaying={isPlaying}
            />
          </ImageBackground>
        ) : isCurrentTrack ? (
          <View style={styles.playingIndicator}>
            {isLoading ? (
              <Ionicons name="sync" size={16} color={Palette.textPrimary} />
            ) : isPlaying ? (
              <AnimatedEqualizer color={Palette.primary} />
            ) : (
              <Ionicons name="pause" size={16} color={Palette.textPrimary} />
            )}
          </View>
        ) : index !== undefined ? (
          <ThemedText style={styles.indexText}>{index + 1}</ThemedText>
        ) : (
          <View style={styles.indexPlaceholder} />
        )}
      </View>

      <View style={styles.infoContainer}>
        <ThemedText
          style={[styles.title, isCurrentTrack && styles.titleActive]}
          numberOfLines={1}
        >
          {track.title}
        </ThemedText>
        <View style={styles.metaRow}>
          <ThemedText style={styles.artist} numberOfLines={1}>
            {artistNames}
          </ThemedText>
          {showAlbum && track.album && (
            <>
              <ThemedText style={styles.separator}>{separator}</ThemedText>
              <ThemedText style={styles.album} numberOfLines={1}>
                {track.album}
              </ThemedText>
            </>
          )}
        </View>
      </View>

      <View style={styles.actionsContainer}>
        {onFavorite && (
          <Pressable
            onPress={handleFavoritePress}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Ionicons
              name={track.is_favorite ? "heart" : "heart-outline"}
              size={20}
              color={track.is_favorite ? Palette.primary : Palette.textMuted}
            />
          </Pressable>
        )}

        <ThemedText style={styles.duration}>
          {formatDuration(track.duration)}
        </ThemedText>

        {onMenu && (
          <Pressable
            onPress={handleMenuPress}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={18}
              color={Palette.textMuted}
            />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radii.sm,
    gap: 12,
    backgroundColor: "transparent",
  },
  containerActive: {
    backgroundColor: Palette.primaryContainer,
  },
  leadingContainer: {
    width: 44,
    height: 44,
    borderRadius: Radii.xs,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surfaceVariant,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: Radii.xs,
    backgroundColor: Palette.surfaceVariant,
  },
  artworkPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  artworkWithOverlay: {
    width: 44,
    height: 44,
    borderRadius: Radii.xs,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  artworkImage: {
    borderRadius: Radii.xs,
  },
  artworkDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  indexText: {
    fontSize: 14,
    color: Palette.textMuted,
    fontVariant: ["tabular-nums"],
  },
  indexPlaceholder: {
    width: 24,
  },
  playingIndicator: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  equalizerBars: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  infoContainer: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: Palette.textPrimary,
  },
  titleActive: {
    color: Palette.primary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  artist: {
    fontSize: 12,
    color: Palette.textMuted,
    flexShrink: 1,
    minWidth: 0,
  },
  separator: {
    fontSize: 12,
    color: Palette.textMuted,
    flexShrink: 0,
  },
  album: {
    fontSize: 12,
    color: Palette.textSecondary,
    flexShrink: 1,
    minWidth: 0,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  duration: {
    fontSize: 12,
    color: Palette.textMuted,
    fontVariant: ["tabular-nums"],
    minWidth: 40,
    textAlign: "right",
  },
});
