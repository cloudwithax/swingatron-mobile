import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { TrackItem } from "@/components/track-item";
import { TrackActionSheet } from "@/components/track-action-sheet";
import { AlbumCard } from "@/components/album-card";
import { ArtistCard } from "@/components/artist-card";
import { useFavoritesStore, usePlayerStore } from "@/src/stores";
import type { Track } from "@/src/api/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 2;
const GRID_PADDING = 12;
const GRID_GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / NUM_COLUMNS;

type FavoritesTab = "tracks" | "albums" | "artists";

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    tracks,
    albums,
    artists,
    count,
    isLoading,
    error,
    loadFavorites,
    removeTrackFavorite,
  } = useFavoritesStore();

  const { setQueue } = usePlayerStore();

  const [activeTab, setActiveTab] = useState<FavoritesTab>("tracks");
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  useEffect(() => {
    if (!tracks.length && !albums.length && !artists.length) {
      void loadFavorites();
    }
  }, [tracks.length, albums.length, artists.length, loadFavorites]);

  const handlePlayTrack = useCallback(
    async (track: Track) => {
      const index = tracks.findIndex((t) => t.trackhash === track.trackhash);
      if (index >= 0) {
        await setQueue(tracks, index, false, "favorites:tracks", track.image);
      }
    },
    [tracks, setQueue]
  );

  const handlePlayAll = useCallback(
    async (shuffle = false) => {
      if (!tracks.length) return;
      const startIndex = shuffle
        ? Math.floor(Math.random() * tracks.length)
        : 0;
      await setQueue(
        tracks,
        startIndex,
        shuffle,
        "favorites:tracks",
        tracks[startIndex].image
      );
    },
    [tracks, setQueue]
  );

  function handleTrackMenu(track: Track) {
    setSelectedTrack(track);
    setShowActionSheet(true);
  }

  function handleCloseActionSheet() {
    setShowActionSheet(false);
    setSelectedTrack(null);
  }

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>

        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="heart" size={40} color="#ef5350" />
          </View>
          <ThemedText style={styles.headerTitle}>Favorites</ThemedText>
          <ThemedText style={styles.headerMeta}>
            {count.tracks} tracks \u2022 {count.albums} albums \u2022{" "}
            {count.artists} artists
          </ThemedText>

          {/* play buttons for tracks tab */}
          {activeTab === "tracks" && tracks.length > 0 && (
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => void handlePlayAll(false)}
                style={styles.playButton}
              >
                <Ionicons name="play" size={20} color="#111111" />
                <Text style={styles.playButtonLabel}>Play All</Text>
              </Pressable>
              <Pressable
                onPress={() => void handlePlayAll(true)}
                style={styles.shuffleButton}
              >
                <Ionicons name="shuffle" size={18} color="#ffffff" />
                <Text style={styles.shuffleButtonLabel}>Shuffle</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* tab row */}
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, activeTab === "tracks" && styles.tabActive]}
            onPress={() => setActiveTab("tracks")}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === "tracks" && styles.tabLabelActive,
              ]}
            >
              Tracks ({count.tracks})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "albums" && styles.tabActive]}
            onPress={() => setActiveTab("albums")}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === "albums" && styles.tabLabelActive,
              ]}
            >
              Albums ({count.albums})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "artists" && styles.tabActive]}
            onPress={() => setActiveTab("artists")}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === "artists" && styles.tabLabelActive,
              ]}
            >
              Artists ({count.artists})
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderTracksTab() {
    if (!tracks.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes" size={64} color="#424242" />
          <ThemedText style={styles.emptyText}>
            No favorite tracks yet
          </ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Tap the heart icon on any track to add it here
          </ThemedText>
        </View>
      );
    }

    return (
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.trackhash}
        renderItem={({ item, index }) => (
          <TrackItem
            track={{ ...item, is_favorite: true }}
            index={index}
            showArtwork
            showAlbum
            onPlay={handlePlayTrack}
            onMenu={handleTrackMenu}
            onFavorite={() => void removeTrackFavorite(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  function renderAlbumsTab() {
    if (!albums.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="disc" size={64} color="#424242" />
          <ThemedText style={styles.emptyText}>
            No favorite albums yet
          </ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Tap the heart icon on any album to add it here
          </ThemedText>
        </View>
      );
    }

    return (
      <FlatList
        key="albums-grid"
        data={albums}
        keyExtractor={(item) => item.albumhash}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => <AlbumCard album={item} width={CARD_WIDTH} />}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  function renderArtistsTab() {
    if (!artists.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="person" size={64} color="#424242" />
          <ThemedText style={styles.emptyText}>
            No favorite artists yet
          </ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Tap the heart icon on any artist to add it here
          </ThemedText>
        </View>
      );
    }

    return (
      <FlatList
        key="artists-grid"
        data={artists}
        keyExtractor={(item) => item.artisthash}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <ArtistCard artist={item} width={CARD_WIDTH} />
        )}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  if (isLoading && !tracks.length && !albums.length && !artists.length) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color="#ffffff"
        />
      </View>
    );
  }

  if (error && !tracks.length && !albums.length && !artists.length) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={64} color="#ef5350" />
          <Text style={styles.error}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader()}

      <View style={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
        {activeTab === "tracks" && renderTracksTab()}
        {activeTab === "albums" && renderAlbumsTab()}
        {activeTab === "artists" && renderArtistsTab()}
      </View>

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
    backgroundColor: "#0a0a0a",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headerContent: {
    alignItems: "center",
    marginBottom: 24,
  },
  headerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(239,83,80,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 8,
  },
  headerMeta: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  playButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },
  shuffleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  shuffleButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#2a2a2a",
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#757575",
  },
  tabLabelActive: {
    color: "#ffffff",
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 8,
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 8,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: GRID_GAP,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#757575",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#616161",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    fontSize: 14,
    color: "#ef5350",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
