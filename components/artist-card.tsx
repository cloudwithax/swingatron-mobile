import { Image, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Palette, Radii } from "@/constants/theme";
import { getArtistImageUrl } from "@/src/api/client";
import type { Artist } from "@/src/api/types";

interface ArtistCardProps {
  artist: Artist;
  size?: "small" | "medium" | "large";
  width?: number;
  onPress?: (artist: Artist) => void;
}

export function ArtistCard({
  artist,
  size = "medium",
  width,
  onPress,
}: ArtistCardProps) {
  const router = useRouter();

  const imageUrl = artist.image ? getArtistImageUrl(artist.image) : null;

  function handlePress() {
    if (onPress) {
      onPress(artist);
    } else {
      router.push(`/artist/${artist.artisthash}`);
    }
  }

  const defaultSize = size === "small" ? 100 : size === "large" ? 160 : 130;
  const cardWidth = width ?? defaultSize;
  const imageSize = cardWidth - 16;

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
              name="person"
              size={imageSize * 0.4}
              color={Palette.textMuted}
            />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <ThemedText style={styles.name} numberOfLines={2}>
          {artist.name}
        </ThemedText>
        {artist.trackcount !== undefined && artist.trackcount > 0 && (
          <ThemedText style={styles.trackCount}>
            {artist.trackcount} {artist.trackcount === 1 ? "track" : "tracks"}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    alignItems: "center",
    borderRadius: Radii.sm,
    backgroundColor: Palette.surface,
    gap: 8,
  },
  imageContainer: {
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: Palette.surfaceVariant,
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
  info: {
    alignItems: "center",
    gap: 2,
    width: "100%",
    overflow: "hidden",
  },
  name: {
    fontSize: 13,
    fontWeight: "500",
    color: Palette.textPrimary,
    textAlign: "center",
  },
  trackCount: {
    fontSize: 12,
    color: Palette.textMuted,
  },
});
