import { useMemo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";

import { ThemedText } from "@/components/themed-text";
import { AlbumCard } from "@/components/album-card";
import { ArtistCard } from "@/components/artist-card";
import { TrackActionSheet } from "@/components/track-action-sheet";
import { Palette, Radii } from "@/constants/theme";
import {
  useAuthStore,
  useHomeStore,
  usePlayerStore,
  useNowPlayingTransitionStore,
} from "@/src/stores";
import { getThumbnailUrl } from "@/src/api/client";
import type { HomeItem, Track, Album, Artist } from "@/src/api/types";

// consistent card size for all home items
const HOME_CARD_WIDTH = 140;

const browseItems = [
  {
    key: "albums",
    label: "Albums",
    icon: "disc" as const,
    route: "/library?tab=albums",
  },
  {
    key: "artists",
    label: "Artists",
    icon: "person" as const,
    route: "/library?tab=artists",
  },
  {
    key: "playlists",
    label: "Playlists",
    icon: "list" as const,
    route: "/library?tab=playlists",
  },
  {
    key: "folders",
    label: "Folders",
    icon: "folder" as const,
    route: "/library?tab=folders",
  },
  {
    key: "favorites",
    label: "Favorites",
    icon: "heart" as const,
    route: "/library?tab=favorites",
  },
  {
    key: "stats",
    label: "Stats",
    icon: "stats-chart" as const,
    route: "/stats",
  },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userName = useAuthStore((state) => state.user?.username ?? "");
  const setQueue = usePlayerStore((state) => state.setQueue);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const {
    recentlyPlayedItems,
    recentlyAddedItems,
    hasRecentlyPlayed,
    hasRecentlyAdded,
    isLoading,
    error,
    fetchHome,
  } = useHomeStore(
    useShallow((state) => ({
      recentlyPlayedItems: state.recentlyPlayedItems,
      recentlyAddedItems: state.recentlyAddedItems,
      hasRecentlyPlayed: state.hasRecentlyPlayed,
      hasRecentlyAdded: state.hasRecentlyAdded,
      isLoading: state.isLoading,
      error: state.error,
      fetchHome: state.fetchHome,
    }))
  );

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  useEffect(() => {
    void fetchHome();
  }, [fetchHome]);

  function handleTrackPlay(track: Track) {
    void setQueue([track], 0, false, "home:recent", track.image);
  }

  function handleTrackMenu(track: Track) {
    setSelectedTrack(track);
    setShowActionSheet(true);
  }

  function handleCloseActionSheet() {
    setShowActionSheet(false);
    setSelectedTrack(null);
  }

  function renderHomeItem(entry: HomeItem, index: number) {
    if (entry.type === "track") {
      const track = entry.item as Track;
      return (
        <HomeTrackCard
          key={`track-${track.trackhash}-${index}`}
          track={track}
          onPlay={() => handleTrackPlay(track)}
          onLongPress={() => handleTrackMenu(track)}
        />
      );
    }
    if (entry.type === "album") {
      const album = entry.item as Album;
      return (
        <AlbumCard
          key={`album-${album.albumhash}-${index}`}
          album={album}
          width={HOME_CARD_WIDTH}
        />
      );
    }
    if (entry.type === "artist") {
      const artist = entry.item as Artist;
      return (
        <ArtistCard
          key={`artist-${artist.artisthash}-${index}`}
          artist={artist}
          width={HOME_CARD_WIDTH}
        />
      );
    }
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={styles.greeting}>
            {greeting}
            {userName ? `, ${userName}` : ""}
          </ThemedText>
        </View>

        {currentTrack && (
          <Pressable
            style={styles.nowPlayingCard}
            onPress={() => useNowPlayingTransitionStore.getState().expand()}
          >
            <View style={styles.nowPlayingDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nowPlayingLabel}>Now Playing</Text>
              <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                {currentTrack.title}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Palette.textMuted}
            />
          </Pressable>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Browse</ThemedText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.browseRow}
          >
            {browseItems.map((item) => (
              <Pressable
                key={item.key}
                style={styles.browseTile}
                onPress={() => router.push(item.route as never)}
              >
                <View style={styles.browseIcon}>
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={Palette.textSecondary}
                  />
                </View>
                <Text style={styles.browseLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Recently Played</ThemedText>
            {hasRecentlyPlayed && (
              <Text style={styles.sectionMeta}>
                {recentlyPlayedItems.length} items
              </Text>
            )}
          </View>
          {isLoading && !hasRecentlyPlayed ? (
            <ActivityIndicator
              style={styles.loading}
              color={Palette.textPrimary}
            />
          ) : error && !hasRecentlyPlayed ? (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          ) : !recentlyPlayedItems.length ? (
            <View style={styles.emptySection}>
              <Ionicons name="time" size={28} color={Palette.textMuted} />
              <ThemedText style={styles.emptyText}>
                No recent plays yet
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {recentlyPlayedItems.map((entry, index) =>
                renderHomeItem(entry as HomeItem, index)
              )}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Recently Added</ThemedText>
            {hasRecentlyAdded && (
              <Text style={styles.sectionMeta}>
                {recentlyAddedItems.length} items
              </Text>
            )}
          </View>
          {isLoading && !hasRecentlyAdded ? (
            <ActivityIndicator
              style={styles.loading}
              color={Palette.textPrimary}
            />
          ) : error && !hasRecentlyAdded ? (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          ) : !recentlyAddedItems.length ? (
            <View style={styles.emptySection}>
              <Ionicons name="add-circle" size={28} color={Palette.textMuted} />
              <ThemedText style={styles.emptyText}>Nothing new yet</ThemedText>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {recentlyAddedItems.map((entry, index) =>
                renderHomeItem(entry as HomeItem, index)
              )}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      <TrackActionSheet
        track={selectedTrack}
        visible={showActionSheet}
        onClose={handleCloseActionSheet}
      />
    </View>
  );
}

function HomeTrackCard({
  track,
  onPlay,
  onLongPress,
}: {
  track: Track;
  onPlay: () => void;
  onLongPress: () => void;
}) {
  const thumbnailUrl = track.image
    ? getThumbnailUrl(track.image, "medium")
    : null;
  const artistNames =
    track.artists && track.artists.length > 0
      ? track.artists.map((a) => a.name).join(", ")
      : "Unknown Artist";

  return (
    <Pressable
      style={styles.trackCard}
      onPress={onPlay}
      onLongPress={onLongPress}
    >
      <View style={styles.trackCardArtwork}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.trackCardImage} />
        ) : (
          <View style={[styles.trackCardImage, styles.trackCardPlaceholder]}>
            <Ionicons name="musical-note" size={24} color={Palette.textMuted} />
          </View>
        )}
        <View style={styles.trackCardPlayOverlay}>
          <Ionicons name="play" size={16} color={Palette.background} />
        </View>
      </View>
      <ThemedText style={styles.trackCardTitle} numberOfLines={1}>
        {track.title}
      </ThemedText>
      <ThemedText style={styles.trackCardArtist} numberOfLines={1}>
        {artistNames}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
    color: Palette.textPrimary,
  },
  nowPlayingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radii.sm,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  nowPlayingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
  },
  nowPlayingLabel: {
    fontSize: 11,
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nowPlayingTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: Palette.textPrimary,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Palette.textPrimary,
  },
  sectionMeta: {
    fontSize: 13,
    color: Palette.textMuted,
  },
  browseRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  browseTile: {
    alignItems: "center",
    gap: 6,
    width: 80,
    paddingVertical: 12,
    backgroundColor: Palette.surface,
    borderRadius: Radii.sm,
  },
  browseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surfaceVariant,
  },
  browseLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: Palette.textSecondary,
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  loading: {
    marginVertical: 16,
  },
  errorText: {
    fontSize: 14,
    color: Palette.caution,
    paddingHorizontal: 16,
  },
  emptySection: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Palette.textMuted,
  },
  trackCard: {
    width: HOME_CARD_WIDTH,
    padding: 8,
    borderRadius: Radii.sm,
    backgroundColor: Palette.surface,
  },
  trackCardArtwork: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: Radii.xs,
    overflow: "hidden",
    backgroundColor: Palette.surfaceVariant,
    position: "relative",
  },
  trackCardImage: {
    width: "100%",
    height: "100%",
  },
  trackCardPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  trackCardPlayOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  trackCardTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: Palette.textPrimary,
    marginTop: 8,
  },
  trackCardArtist: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
});
