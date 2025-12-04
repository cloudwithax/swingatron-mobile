import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import { AlbumCard } from "@/components/album-card";
import { Palette, Radii } from "@/constants/theme";
import { useArtistStore, usePlayerStore } from "@/src/stores";
import { getArtistImageUrl } from "@/src/api/client";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { toggleFavorite } from "@/src/api/favorites";
import type { Track, Album } from "@/src/api/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ARTIST_IMAGE_SIZE = Math.min(SCREEN_WIDTH * 0.5, 200);
const bullet = "\u2022";

type ViewMode = "tracks" | "albums";
type TrackSortOption = "default" | "title" | "album" | "duration";
type SortOrder = "asc" | "desc";

export default function ArtistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ hash: string }>();
  const artistHash = params.hash;

  const {
    currentArtist,
    isLoadingDetail,
    detailError,
    loadArtistDetail,
    clearDetail,
  } = useArtistStore();
  const { setQueue, playbackSource, pause, shuffleMode, toggleShuffle } =
    usePlayerStore();
  const { isPlaying } = usePlaybackProgress();

  // check if this artist is currently playing
  const isCurrentlyPlaying = isPlaying && playbackSource === `ar:${artistHash}`;
  const isCurrentlyShuffling = isCurrentlyPlaying && shuffleMode;

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("tracks");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [trackSort, setTrackSort] = useState<TrackSortOption>("default");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const sortButtonRef = useRef<View>(null);
  const scrollY = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (artistHash) {
      void loadArtistDetail(artistHash);
    }
  }, [artistHash, loadArtistDetail]);

  // clear artist data immediately when leaving the screen to prevent stale data showing
  useEffect(() => {
    return () => {
      clearDetail();
    };
  }, [clearDetail]);

  useEffect(() => {
    if (currentArtist?.artist) {
      setIsFavorite(currentArtist.artist.is_favorite ?? false);
    }
  }, [currentArtist?.artist]);

  const handleToggleFavorite = useCallback(async () => {
    if (!currentArtist || isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    try {
      const newValue = await toggleFavorite(
        currentArtist.artist.artisthash,
        "artist",
        !isFavorite
      );
      setIsFavorite(newValue);
    } catch {
      // silent fail
    } finally {
      setIsTogglingFavorite(false);
    }
  }, [currentArtist, isFavorite, isTogglingFavorite]);

  const allAlbums = useCallback((): Album[] => {
    if (!currentArtist?.albums) return [];
    const albums: Album[] = [];
    if (currentArtist.albums.albums) {
      albums.push(...currentArtist.albums.albums);
    }
    if (currentArtist.albums.singles_and_eps) {
      albums.push(...currentArtist.albums.singles_and_eps);
    }
    if (currentArtist.albums.compilations) {
      albums.push(...currentArtist.albums.compilations);
    }
    if (currentArtist.albums.appearances) {
      albums.push(...currentArtist.albums.appearances);
    }
    return albums;
  }, [currentArtist?.albums]);

  const sortedTracks = useMemo(() => {
    const tracks = currentArtist?.tracks || [];
    if (trackSort === "default") {
      return sortOrder === "asc" ? tracks : [...tracks].reverse();
    }

    const sorted = [...tracks].sort((a, b) => {
      let comparison = 0;
      switch (trackSort) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "album":
          comparison = (a.album || "").localeCompare(b.album || "");
          break;
        case "duration":
          comparison = a.duration - b.duration;
          break;
        default:
          return 0;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [currentArtist?.tracks, trackSort, sortOrder]);

  function selectSortOption(option: TrackSortOption) {
    setTrackSort(option);
    setShowSortDropdown(false);
  }

  function handleSortButtonPress() {
    if (showSortDropdown) {
      setShowSortDropdown(false);
      return;
    }
    sortButtonRef.current?.measureInWindow((x, y, width, height) => {
      setDropdownPosition({ top: y + height + 4, left: x });
      setShowSortDropdown(true);
    });
  }

  function toggleSortOrder() {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  const sortOptions: { value: TrackSortOption; label: string }[] = [
    { value: "default", label: "Default" },
    { value: "title", label: "Title" },
    { value: "album", label: "Album" },
    { value: "duration", label: "Duration" },
  ];

  function getSortLabel(): string {
    switch (trackSort) {
      case "default":
        return "Default";
      case "title":
        return "Title";
      case "album":
        return "Album";
      case "duration":
        return "Duration";
      default:
        return "Default";
    }
  }

  async function handlePlayTracks(shuffle = false) {
    if (!sortedTracks.length) return;
    // if already playing this artist shuffled, unshuffle it
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

    const startIndex = 0;
    await setQueue(
      sortedTracks,
      startIndex,
      shuffle,
      `ar:${currentArtist?.artist.artisthash}`,
      sortedTracks[startIndex].image
    );
  }

  function handlePlayTrack(track: Track) {
    if (!sortedTracks.length) return;
    const index = sortedTracks.findIndex(
      (t) => t.trackhash === track.trackhash
    );
    if (index >= 0) {
      void setQueue(
        sortedTracks,
        index,
        false,
        `ar:${currentArtist?.artist.artisthash}`,
        track.image
      );
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

  if (!artistHash) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.emptyState}>
          <Ionicons name="person" size={64} color={Palette.textMuted} />
          <ThemedText style={styles.placeholder}>Missing artist ID</ThemedText>
        </View>
      </View>
    );
  }

  if (isLoadingDetail && !currentArtist) {
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

  if (detailError && !currentArtist) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={64} color={Palette.caution} />
          <Text style={styles.error}>{detailError}</Text>
        </View>
      </View>
    );
  }

  if (!currentArtist) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.emptyState}>
          <Ionicons name="person" size={64} color={Palette.textMuted} />
          <ThemedText style={styles.placeholder}>Artist not found</ThemedText>
        </View>
      </View>
    );
  }

  const imageUrl = currentArtist.artist.image
    ? getArtistImageUrl(currentArtist.artist.image)
    : null;
  const trackCount = currentArtist.tracks?.length || 0;
  const albums = allAlbums();
  const albumCount = albums.length;

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100, 180],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 56 }]}>
      <Pressable
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 8 }]}
        hitSlop={12}
      >
        <Ionicons name="arrow-back" size={24} color={Palette.textPrimary} />
      </Pressable>

      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.artistImage} />
        ) : (
          <View style={[styles.artistImage, styles.imagePlaceholder]}>
            <Ionicons name="person" size={60} color={Palette.textMuted} />
          </View>
        )}
      </View>

      <ThemedText style={styles.artistName} numberOfLines={2}>
        {currentArtist.artist.name}
      </ThemedText>
      <ThemedText style={styles.meta}>
        {trackCount} tracks {bullet} {albumCount} albums
      </ThemedText>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={() => {
            void handlePlayTracks(false);
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
            void handlePlayTracks(true);
          }}
          style={styles.shuffleButton}
        >
          <Ionicons name="shuffle" size={20} color={Palette.textPrimary} />
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
            <ActivityIndicator size="small" color={Palette.primary} />
          ) : (
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={24}
              color={isFavorite ? Palette.primary : Palette.textPrimary}
            />
          )}
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, viewMode === "tracks" && styles.tabActive]}
          onPress={() => setViewMode("tracks")}
        >
          <Text
            style={[
              styles.tabLabel,
              viewMode === "tracks" && styles.tabLabelActive,
            ]}
          >
            Tracks
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, viewMode === "albums" && styles.tabActive]}
          onPress={() => setViewMode("albums")}
        >
          <Text
            style={[
              styles.tabLabel,
              viewMode === "albums" && styles.tabLabelActive,
            ]}
          >
            Albums
          </Text>
        </Pressable>
      </View>

      {viewMode === "tracks" && (
        <View style={styles.sortRow}>
          <View ref={sortButtonRef} collapsable={false}>
            <Pressable
              style={styles.sortButton}
              onPress={handleSortButtonPress}
              hitSlop={8}
            >
              <Ionicons
                name="funnel-outline"
                size={16}
                color={Palette.textMuted}
              />
              <Text style={styles.sortButtonLabel}>{getSortLabel()}</Text>
              <Ionicons
                name={showSortDropdown ? "chevron-up" : "chevron-down"}
                size={14}
                color={Palette.textMuted}
              />
            </Pressable>
          </View>
          <Pressable
            style={styles.sortOrderButton}
            onPress={toggleSortOrder}
            hitSlop={8}
          >
            <Ionicons
              name={sortOrder === "asc" ? "arrow-up" : "arrow-down"}
              size={16}
              color={Palette.textMuted}
            />
          </Pressable>
        </View>
      )}
    </View>
  );

  const renderAlbumsSection = () => {
    if (!albums.length) {
      return (
        <View style={styles.emptySection}>
          <Ionicons name="disc" size={48} color={Palette.textMuted} />
          <ThemedText style={styles.emptySectionText}>
            No albums found
          </ThemedText>
        </View>
      );
    }

    const studioAlbums = currentArtist?.albums?.albums || [];
    const singlesEps = currentArtist?.albums?.singles_and_eps || [];
    const compilations = currentArtist?.albums?.compilations || [];
    const appearances = currentArtist?.albums?.appearances || [];

    return (
      <View
        style={[styles.albumsContainer, { paddingBottom: insets.bottom + 110 }]}
      >
        {studioAlbums.length > 0 && (
          <View style={styles.albumSection}>
            <ThemedText style={styles.albumSectionTitle}>Albums</ThemedText>
            <View style={styles.albumGrid}>
              {studioAlbums.map((album) => (
                <AlbumCard key={album.albumhash} album={album} size="small" />
              ))}
            </View>
          </View>
        )}

        {singlesEps.length > 0 && (
          <View style={styles.albumSection}>
            <ThemedText style={styles.albumSectionTitle}>
              Singles & EPs
            </ThemedText>
            <View style={styles.albumGrid}>
              {singlesEps.map((album) => (
                <AlbumCard key={album.albumhash} album={album} size="small" />
              ))}
            </View>
          </View>
        )}

        {compilations.length > 0 && (
          <View style={styles.albumSection}>
            <ThemedText style={styles.albumSectionTitle}>
              Compilations
            </ThemedText>
            <View style={styles.albumGrid}>
              {compilations.map((album) => (
                <AlbumCard key={album.albumhash} album={album} size="small" />
              ))}
            </View>
          </View>
        )}

        {appearances.length > 0 && (
          <View style={styles.albumSection}>
            <ThemedText style={styles.albumSectionTitle}>
              Appearances
            </ThemedText>
            <View style={styles.albumGrid}>
              {appearances.map((album) => (
                <AlbumCard key={album.albumhash} album={album} size="small" />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

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
          {currentArtist.artist.name}
        </ThemedText>
        <View style={{ width: 40 }} />
      </Animated.View>

      {viewMode === "tracks" ? (
        <Animated.FlatList
          data={sortedTracks}
          keyExtractor={(item) => item.trackhash}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          ListHeaderComponent={renderHeader}
          renderItem={({ item, index }) => (
            <TrackItem
              track={item}
              index={index}
              showArtwork
              showAlbum
              onPlay={handlePlayTrack}
              onMenu={handleTrackMenu}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 110 },
          ]}
          ListEmptyComponent={
            <View style={styles.emptySection}>
              <Ionicons
                name="musical-notes"
                size={48}
                color={Palette.textMuted}
              />
              <ThemedText style={styles.emptySectionText}>
                No tracks found
              </ThemedText>
            </View>
          }
        />
      ) : (
        <Animated.ScrollView
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {renderHeader()}
          {renderAlbumsSection()}
        </Animated.ScrollView>
      )}

      {showSortDropdown && (
        <>
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={() => setShowSortDropdown(false)}
          />
          <View
            style={[
              styles.dropdownMenu,
              { top: dropdownPosition.top, left: dropdownPosition.left },
            ]}
          >
            {sortOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.dropdownItem,
                  trackSort === option.value && styles.dropdownItemActive,
                ]}
                onPress={() => selectSortOption(option.value)}
              >
                <Text
                  style={[
                    styles.dropdownItemLabel,
                    trackSort === option.value &&
                      styles.dropdownItemLabelActive,
                  ]}
                >
                  {option.label}
                </Text>
                {trackSort === option.value && (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={Palette.primary}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </>
      )}

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
  imageContainer: {
    marginBottom: 20,
    position: "relative",
  },
  artistImage: {
    width: ARTIST_IMAGE_SIZE,
    height: ARTIST_IMAGE_SIZE,
    borderRadius: ARTIST_IMAGE_SIZE / 2,
    backgroundColor: "#0f1524",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f1524",
  },
  imageGradient: {
    position: "absolute",
    bottom: -20,
    left: -60,
    right: -60,
    height: 80,
  },
  artistName: {
    fontSize: 24,
    fontWeight: "800",
    color: Palette.textPrimary,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.3,
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
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surface,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderRadius: Radii.md,
    padding: 4,
    gap: 4,
    width: "100%",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radii.sm,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: Palette.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabLabelActive: {
    color: Palette.onPrimary,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 16,
    gap: 8,
    width: "100%",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radii.sm,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  sortButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  sortOrderButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.sm,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  dropdownMenu: {
    position: "absolute",
    backgroundColor: Palette.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.border,
    minWidth: 140,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownItemActive: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  dropdownItemLabel: {
    fontSize: 14,
    color: Palette.textMuted,
  },
  dropdownItemLabelActive: {
    color: Palette.primary,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 8,
  },
  albumsContainer: {
    paddingHorizontal: 8,
  },
  albumSection: {
    marginBottom: 24,
  },
  albumSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.textPrimary,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  albumGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  emptySection: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptySectionText: {
    fontSize: 14,
    color: Palette.textMuted,
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
