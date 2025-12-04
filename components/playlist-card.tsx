import { Image, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Palette, Radii } from "@/constants/theme";
import { getPlaylistImageUrl } from "@/src/api/client";
import type { Playlist } from "@/src/api/types";

interface PlaylistCardProps {
  playlist: Playlist;
  size?: "small" | "medium" | "large";
  width?: number;
  onPress?: (playlist: Playlist) => void;
}

export function PlaylistCard({
  playlist,
  size = "medium",
  width,
  onPress,
}: PlaylistCardProps) {
  const router = useRouter();

  const imageUrl = playlist.image ? getPlaylistImageUrl(playlist.image) : null;

  function handlePress() {
    if (onPress) {
      onPress(playlist);
    } else {
      router.push(`/playlist/${playlist.id}`);
    }
  }

  const defaultSize = size === "small" ? 120 : size === "large" ? 180 : 150;
  const cardWidth = width ?? defaultSize;
  const imageSize = cardWidth - 20;

  return (
    <Pressable
      style={[styles.container, { width: cardWidth }]}
      onPress={handlePress}
    >
      <View
        style={[styles.imageContainer, { width: imageSize, height: imageSize }]}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons
              name="musical-notes"
              size={cardWidth * 0.3}
              color={Palette.textMuted}
            />
          </View>
        )}

        {/* pinned indicator */}
        {playlist.pinned && (
          <View style={styles.pinnedBadge}>
            <Ionicons name="pin" size={12} color={Palette.background} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {playlist.name}
        </ThemedText>
        <ThemedText style={styles.trackCount}>
          {playlist.count} {playlist.count === 1 ? "track" : "tracks"}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    borderRadius: Radii.md,
    backgroundColor: Palette.surface,
    gap: 8,
  },
  imageContainer: {
    borderRadius: Radii.sm,
    overflow: "hidden",
    backgroundColor: Palette.surfaceVariant,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surfaceVariant,
  },
  pinnedBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    gap: 2,
    overflow: "hidden",
  },
  name: {
    fontSize: 13,
    fontWeight: "500",
    color: Palette.textPrimary,
    letterSpacing: 0.2,
  },
  trackCount: {
    fontSize: 12,
    color: Palette.textMuted,
  },
});
