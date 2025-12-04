import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { TrackItem } from "@/components/track-item";
import { TrackActionSheet } from "@/components/track-action-sheet";
import { Palette, Radii } from "@/constants/theme";
import { useAlbumStore, usePlayerStore } from "@/src/stores";
import { getThumbnailUrl } from "@/src/api/client";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { toggleFavorite } from "@/src/api/favorites";
import type { Track } from "@/src/api/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ARTWORK_SIZE = Math.min(SCREEN_WIDTH * 0.64, 300);
const bullet = "\u2022";

export default function AlbumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ hash: string }>();
  const albumHash = params.hash;

  const {
    currentAlbum,
    isLoadingDetail,
    detailError,
    loadAlbumDetail,
    clearDetail,
  } = useAlbumStore();
  const { setQueue, playbackSource, pause, shuffleMode, toggleShuffle } =
    usePlayerStore();
  const { isPlaying } = usePlaybackProgress();

  // check if this album is currently playing
  const isCurrentlyPlaying = isPlaying && playbackSource === `al:${albumHash}`;
  const isCurrentlyShuffling = isCurrentlyPlaying && shuffleMode;

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const scrollY = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (albumHash) {
      void loadAlbumDetail(albumHash);
    }
  }, [albumHash, loadAlbumDetail]);

  // clear album data immediately when leaving the screen to prevent stale data showing
  useEffect(() => {
    return () => {
      clearDetail();
    };
  }, [clearDetail]);

  useEffect(() => {
    if (currentAlbum?.info) {
      setIsFavorite(currentAlbum.info.is_favorite ?? false);
    }
  }, [currentAlbum?.info]);

  const handleToggleFavorite = useCallback(async () => {
    if (!currentAlbum || isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    try {
      const newValue = await toggleFavorite(
        currentAlbum.info.albumhash,
        "album",
        !isFavorite
      );
      setIsFavorite(newValue);
    } catch {
      // silent fail
    } finally {
      setIsTogglingFavorite(false);
    }
  }, [currentAlbum, isFavorite, isTogglingFavorite]);

  async function handlePlayTrack(track: Track) {
    if (!currentAlbum) return;
    const index = currentAlbum.tracks.findIndex(
      (t) => t.trackhash === track.trackhash
    );
    if (index >= 0) {
      await setQueue(
        currentAlbum.tracks,
        index,
        false,
        `al:${currentAlbum.info.albumhash}`,
        currentAlbum.info.image
      );
    }
  }

  async function handlePlayAll(shuffle: boolean) {
    if (!currentAlbum || !currentAlbum.tracks.length) return;
    // if already playing this album shuffled, unshuffle it
    if (shuffle && isCurrentlyShuffling) {
      toggleShuffle();
      return;
    }
    if (!shuffle && isCurrentlyPlaying) {
      await pause();
      return;
    }

    // if user wants shuffle, enable shuffle mode first so setQueue will shuffle the tracks
    if (shuffle && !shuffleMode) {
      toggleShuffle();
    }

    await setQueue(
      currentAlbum.tracks,
      0,
      shuffle,
      `al:${currentAlbum.info.albumhash}`,
      currentAlbum.info.image
    );
  }

  function handleGoToArtist() {
    if (
      currentAlbum?.info.albumartists &&
      currentAlbum.info.albumartists.length > 0
    ) {
      router.push(`/artist/${currentAlbum.info.albumartists[0].artisthash}`);
    }
  }

  function handleTrackMenu(track: Track) {
    setSelectedTrack(track);
    setShowActionSheet(true);
  }

  function handleCloseActionSheet() {
    setShowActionSheet(false);
    setSelectedTrack(null);
  }

  if (!albumHash) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.emptyState}>
          <Ionicons name="disc" size={64} color={Palette.textMuted} />
          <ThemedText style={styles.placeholder}>Missing album ID</ThemedText>
        </View>
      </View>
    );
  }

  if (isLoadingDetail && !currentAlbum) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color={Palette.textPrimary}
        />
      </View>
    );
  }

  if (detailError && !currentAlbum) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={64} color={Palette.caution} />
          <Text style={styles.error}>{detailError}</Text>
        </View>
      </View>
    );
  }

  if (!currentAlbum) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.emptyState}>
          <Ionicons name="disc" size={64} color={Palette.textMuted} />
          <ThemedText style={styles.placeholder}>Album not found</ThemedText>
        </View>
      </View>
    );
  }

  const thumbnailUrl = currentAlbum.info.image
    ? getThumbnailUrl(currentAlbum.info.image, "large")
    : null;
  const artistNames =
    currentAlbum.info.albumartists?.map((a) => a.name).join(", ") ||
    "Unknown Artist";
  const trackCount = currentAlbum.tracks.length;
  const totalDuration = currentAlbum.tracks.reduce(
    (acc, t) => acc + (t.duration || 0),
    0
  );
  const totalMins = Math.floor(totalDuration / 60);

  let releaseYear: number | null = null;
  if (currentAlbum.info.date) {
    const ms =
      currentAlbum.info.date < 1e11
        ? currentAlbum.info.date * 1000
        : currentAlbum.info.date;
    const year = new Date(ms).getFullYear();
    if (!Number.isNaN(year)) {
      releaseYear = year;
    }
  }

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 150, 250],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });

  const artworkScale = scrollY.interpolate({
    inputRange: [-100, 0, 120],
    outputRange: [1.15, 1, 0.9],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.headerBar,
          { paddingTop: insets.top, opacity: headerOpacity },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.headerBackButton}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={Palette.textPrimary} />
        </Pressable>
        <ThemedText style={styles.headerTitle} numberOfLines={1}>
          {currentAlbum.info.title}
        </ThemedText>
        <View style={{ width: 40 }} />
      </Animated.View>

      <Animated.FlatList
        data={currentAlbum.tracks}
        keyExtractor={(item) => item.trackhash}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + 56 }]}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.backButton, { top: insets.top + 8 }]}
              hitSlop={12}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={Palette.textPrimary}
              />
            </Pressable>

            <View style={styles.artworkContainer}>
              <Animated.View style={{ transform: [{ scale: artworkScale }] }}>
                {thumbnailUrl ? (
                  <Image
                    source={{ uri: thumbnailUrl }}
                    style={styles.artwork}
                  />
                ) : (
                  <View style={[styles.artwork, styles.artworkPlaceholder]}>
                    <Ionicons name="disc" size={90} color={Palette.textMuted} />
                  </View>
                )}
              </Animated.View>
            </View>

            <ThemedText style={styles.title} numberOfLines={2}>
              {currentAlbum.info.title}
            </ThemedText>
            <Pressable onPress={handleGoToArtist}>
              <ThemedText style={styles.artistName}>{artistNames}</ThemedText>
            </Pressable>
            <ThemedText style={styles.meta}>
              {releaseYear && `${releaseYear} ${bullet} `}
              {trackCount} tracks {bullet} {totalMins} min
            </ThemedText>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => {
                  void handlePlayAll(false);
                }}
                style={styles.playButton}
              >
                <Ionicons
                  name={isCurrentlyPlaying ? "pause" : "play"}
                  size={22}
                  color={Palette.onPrimary}
                />
                <Text style={styles.playButtonLabel}>
                  {isCurrentlyPlaying ? "Pause" : "Play"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void handlePlayAll(true);
                }}
                style={styles.shuffleButton}
              >
                <Ionicons
                  name="shuffle"
                  size={20}
                  color={Palette.textPrimary}
                />
                <Text style={styles.shuffleButtonLabel}>
                  {isCurrentlyShuffling ? "Unshuffle" : "Shuffle"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleToggleFavorite}
                style={styles.favoriteButton}
                disabled={isTogglingFavorite}
              >
                {isTogglingFavorite ? (
                  <ActivityIndicator size="small" color={Palette.caution} />
                ) : (
                  <Ionicons
                    name={isFavorite ? "heart" : "heart-outline"}
                    size={24}
                    color={isFavorite ? Palette.primary : Palette.textPrimary}
                  />
                )}
              </Pressable>
            </View>

            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Tracks</ThemedText>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <TrackItem
            track={item}
            index={index}
            showArtwork={false}
            showAlbum={false}
            onPlay={handlePlayTrack}
            onMenu={handleTrackMenu}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 110 },
        ]}
      />

      <TrackActionSheet
        track={selectedTrack}
        visible={showActionSheet}
        onClose={handleCloseActionSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: Palette.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: Palette.textPrimary,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: 8,
    left: 16,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    backgroundColor: Palette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  artworkContainer: {
    marginBottom: 20,
    position: "relative",
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: Radii.md,
    backgroundColor: Palette.surfaceVariant,
  },
  artworkPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surfaceVariant,
  },
  artworkGradient: {
    position: "absolute",
    bottom: -20,
    left: -60,
    right: -60,
    height: 90,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: Palette.textPrimary,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  artistName: {
    fontSize: 16,
    fontWeight: "600",
    color: Palette.textSecondary,
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: Palette.textMuted,
    marginBottom: 18,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 999,
  },
  playButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.onPrimary,
    letterSpacing: 0.2,
  },
  shuffleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: Palette.surface,
  },
  shuffleButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.textPrimary,
  },
  favoriteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surface,
  },
  sectionHeader: {
    width: "100%",
    marginTop: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.textPrimary,
    letterSpacing: 0.2,
  },
  listContent: {
    paddingHorizontal: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    fontSize: 14,
    color: Palette.caution,
    textAlign: "center",
  },
  placeholder: {
    fontSize: 16,
    color: Palette.textMuted,
  },
});
