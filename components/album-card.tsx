import { Image, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Palette, Radii } from "@/constants/theme";
import { usePlayerStore } from "@/src/stores";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { getThumbnailUrl } from "@/src/api/client";
import type { Album } from "@/src/api/types";

interface AlbumCardProps {
  album: Album;
  size?: "small" | "medium" | "large";
  width?: number;
  onPress?: (album: Album) => void;
  onPlay?: (album: Album) => void;
}

export function AlbumCard({
  album,
  size = "medium",
  width,
  onPress,
  onPlay,
}: AlbumCardProps) {
  const router = useRouter();
  const { isPlaying } = usePlaybackProgress();
  const { playbackSource } = usePlayerStore();

  const thumbnailUrl = album.image ? getThumbnailUrl(album.image) : null;
  const isCurrentSource = playbackSource === `al:${album.albumhash}`;
  const isCurrentlyPlaying = isCurrentSource && isPlaying;

  const artistNames =
    album.albumartists && album.albumartists.length > 0
      ? album.albumartists.map((a) => a.name).join(", ")
      : "Unknown Artist";

  // calculate release year from date timestamp
  let releaseYear: number | null = null;
  if (album.date) {
    const ms = album.date < 1e11 ? album.date * 1000 : album.date;
    const year = new Date(ms).getFullYear();
    if (!Number.isNaN(year)) {
      releaseYear = year;
    }
  }

  function handlePress() {
    if (onPress) {
      onPress(album);
    } else {
      router.push(`/album/${album.albumhash}`);
    }
  }

  function handlePlayPress() {
    if (onPlay) {
      onPlay(album);
    }
  }

  const defaultSize = size === "small" ? 120 : size === "large" ? 180 : 150;
  const cardWidth = width ?? defaultSize;
  const artworkSize = cardWidth - 16;

  return (
    <Pressable
      style={[styles.container, { width: cardWidth }]}
      onPress={handlePress}
    >
      <View
        style={[
          styles.artworkContainer,
          { width: artworkSize, height: artworkSize },
        ]}
      >
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]}>
            <Ionicons
              name="disc"
              size={artworkSize * 0.4}
              color={Palette.textMuted}
            />
          </View>
        )}

        {onPlay && (
          <Pressable
            style={[
              styles.playButton,
              (isCurrentSource || isCurrentlyPlaying) &&
                styles.playButtonVisible,
            ]}
            onPress={handlePlayPress}
          >
            <Ionicons
              name={isCurrentlyPlaying ? "pause" : "play"}
              size={20}
              color={Palette.background}
            />
          </Pressable>
        )}

        {isCurrentlyPlaying && (
          <View style={styles.playingIndicator}>
            <View style={styles.equalizerBars}>
              <View style={[styles.bar, styles.bar1]} />
              <View style={[styles.bar, styles.bar2]} />
              <View style={[styles.bar, styles.bar3]} />
            </View>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {album.title}
        </ThemedText>
        <ThemedText style={styles.artist} numberOfLines={1}>
          {artistNames}
        </ThemedText>
        {releaseYear && (
          <ThemedText style={styles.year}>{releaseYear}</ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    borderRadius: Radii.sm,
    backgroundColor: Palette.surface,
    gap: 8,
  },
  artworkContainer: {
    borderRadius: Radii.sm,
    overflow: "hidden",
    position: "relative",
    backgroundColor: Palette.surfaceVariant,
  },
  artwork: {
    width: "100%",
    height: "100%",
  },
  artworkPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surfaceVariant,
  },
  playButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
    transform: [{ translateY: 8 }],
  },
  playButtonVisible: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
  playingIndicator: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  equalizerBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 12,
  },
  bar: {
    width: 3,
    backgroundColor: Palette.primary,
    borderRadius: 1.5,
  },
  bar1: {
    height: 6,
  },
  bar2: {
    height: 10,
  },
  bar3: {
    height: 8,
  },
  info: {
    gap: 2,
    overflow: "hidden",
  },
  title: {
    fontSize: 13,
    fontWeight: "500",
    color: Palette.textPrimary,
  },
  artist: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  year: {
    fontSize: 11,
    color: Palette.textMuted,
  },
});
