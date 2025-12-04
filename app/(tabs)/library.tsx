import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ScrollView as ScrollViewType } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { AlbumCard } from "@/components/album-card";
import { ArtistCard } from "@/components/artist-card";
import { PlaylistCard } from "@/components/playlist-card";
import { FolderItem } from "@/components/folder-item";
import { TrackItem } from "@/components/track-item";
import { TrackActionSheet } from "@/components/track-action-sheet";
import { Palette, Radii } from "@/constants/theme";
import {
  useAlbumStore,
  useArtistStore,
  useFolderStore,
  useFavoritesStore,
  usePlaylistStore,
  usePlayerStore,
} from "@/src/stores";
import type { Track, Folder } from "@/src/api/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 2;
const GRID_PADDING = 12;
const GRID_GAP = 10;
// card width accounts for padding on both sides and gap between columns
const CARD_WIDTH =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;

const segments = [
  { key: "folders", label: "Folders", icon: "folder" as const },
  { key: "albums", label: "Albums", icon: "disc" as const },
  { key: "artists", label: "Artists", icon: "person" as const },
  { key: "playlists", label: "Playlists", icon: "list" as const },
  { key: "favorites", label: "Favorites", icon: "heart" as const },
] as const;

type SegmentKey = (typeof segments)[number]["key"];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const segmentScrollRef = useRef<ScrollViewType>(null);

  // determine initial segment from url param, default to albums
  const initialSegment = (
    tab && segments.some((s) => s.key === tab) ? tab : "albums"
  ) as SegmentKey;

  const [segment, setSegment] = useState<SegmentKey>(initialSegment);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const folderStore = useFolderStore();
  const albumStore = useAlbumStore();
  const artistStore = useArtistStore();
  const playlistStore = usePlaylistStore();
  const favoritesStore = useFavoritesStore();
  const { setQueue } = usePlayerStore();

  // sync segment with url param when it changes and scroll to make it visible
  useEffect(() => {
    if (tab && segments.some((s) => s.key === tab)) {
      setSegment(tab as SegmentKey);

      // scroll to make the selected segment visible
      const segmentIndex = segments.findIndex((s) => s.key === tab);
      if (segmentIndex >= 0 && segmentScrollRef.current) {
        // estimate chip width based on approximate measurements
        // each chip is roughly 90-100px wide with padding and gap
        const estimatedChipWidth = 95;
        const scrollX = Math.max(0, segmentIndex * estimatedChipWidth - 16);
        segmentScrollRef.current.scrollTo({ x: scrollX, animated: true });
      }
    }
  }, [tab]);

  useEffect(() => {
    if (segment === "folders") {
      if (!folderStore.rootFolders.length && !folderStore.folders.length) {
        void folderStore.loadRootFolders();
      }
    } else if (segment === "albums") {
      if (!albumStore.albums.length) {
        void albumStore.loadAlbums(true);
      }
    } else if (segment === "artists") {
      if (!artistStore.artists.length) {
        void artistStore.loadArtists(true);
      }
    } else if (segment === "playlists") {
      if (!playlistStore.playlists.length) {
        void playlistStore.loadPlaylists();
      }
    } else if (segment === "favorites") {
      if (!favoritesStore.tracks.length && !favoritesStore.albums.length) {
        void favoritesStore.loadFavorites();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment]);

  function handleRootFolderPress(path: string) {
    void folderStore.navigateToRootFolder(path);
  }

  function handleFolderPress(folder: Folder) {
    void folderStore.navigateToFolder(folder);
  }

  function handleFolderBack() {
    void folderStore.navigateBack();
  }

  function handlePlayFolderTracks() {
    if (folderStore.tracks.length > 0) {
      void setQueue(
        folderStore.tracks,
        0,
        false,
        `folder:${folderStore.currentPath}`,
        folderStore.tracks[0].image
      );
    }
  }

  function handleTrackPlay(track: Track) {
    const tracks =
      segment === "favorites" ? favoritesStore.tracks : folderStore.tracks;
    const index = tracks.findIndex((t) => t.trackhash === track.trackhash);
    if (index >= 0) {
      void setQueue(
        tracks,
        index,
        false,
        segment === "favorites"
          ? "favorites"
          : `folder:${folderStore.currentPath}`,
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

  // breadcrumbs for folder navigation
  function renderBreadcrumbs() {
    if (!folderStore.currentPath) return null;
    const parts = folderStore.currentPath.split("/").filter(Boolean);
    if (parts.length === 0) return null;

    return (
      <View style={styles.breadcrumbsContainer}>
        <Pressable
          onPress={handleFolderBack}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={Palette.textPrimary} />
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.breadcrumbsScroll}
        >
          <Pressable onPress={() => folderStore.loadRootFolders()}>
            <ThemedText style={styles.breadcrumbText}>Root</ThemedText>
          </Pressable>
          {parts.map((part, index) => (
            <View key={index} style={styles.breadcrumbItem}>
              <ThemedText style={styles.breadcrumbSeparator}>/</ThemedText>
              <ThemedText
                style={[
                  styles.breadcrumbText,
                  index === parts.length - 1 && styles.breadcrumbActive,
                ]}
                numberOfLines={1}
              >
                {part}
              </ThemedText>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  function renderFolders() {
    if (
      folderStore.isLoading &&
      !folderStore.folders.length &&
      !folderStore.tracks.length &&
      !folderStore.rootFolders.length
    ) {
      return (
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color={Palette.textPrimary}
        />
      );
    }
    if (folderStore.error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={40} color={Palette.caution} />
          <Text style={styles.errorText}>{folderStore.error}</Text>
        </View>
      );
    }
    if (
      !folderStore.rootFolders.length &&
      !folderStore.folders.length &&
      !folderStore.tracks.length
    ) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open" size={40} color={Palette.textMuted} />
          <ThemedText style={styles.emptyText}>No folders found</ThemedText>
        </View>
      );
    }

    // if we're at root level, show root folders
    if (!folderStore.currentPath && folderStore.rootFolders.length > 0) {
      return (
        <FlatList
          key="root-folders-list"
          data={folderStore.rootFolders}
          keyExtractor={(item) => item}
          ListHeaderComponent={
            <View style={styles.rootFoldersHeader}>
              <ThemedText style={styles.rootFoldersTitle}>
                Music Folders
              </ThemedText>
              <ThemedText style={styles.rootFoldersSubtitle}>
                {folderStore.rootFolders.length} root{" "}
                {folderStore.rootFolders.length === 1 ? "folder" : "folders"}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => {
            // extract folder name from path
            const parts = item.split(/[/\\]/).filter(Boolean);
            const name = parts[parts.length - 1] || item;
            return (
              <Pressable
                style={styles.rootFolderItem}
                onPress={() => handleRootFolderPress(item)}
              >
                <View style={styles.rootFolderIcon}>
                  <Ionicons name="folder" size={24} color={Palette.primary} />
                </View>
                <View style={styles.rootFolderInfo}>
                  <ThemedText style={styles.rootFolderName} numberOfLines={1}>
                    {name}
                  </ThemedText>
                  <ThemedText style={styles.rootFolderPath} numberOfLines={1}>
                    {item}
                  </ThemedText>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Palette.textMuted}
                />
              </Pressable>
            );
          }}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 120, flexGrow: 1 },
          ]}
        />
      );
    }

    const hasTracks = folderStore.tracks.length > 0;

    return (
      <FlatList
        key="folders-list"
        data={[...folderStore.folders, ...folderStore.tracks]}
        keyExtractor={(item) => ("path" in item ? item.path : item.trackhash)}
        ListHeaderComponent={
          <>
            {renderBreadcrumbs()}
            {hasTracks && (
              <View style={styles.folderActions}>
                <Pressable
                  style={styles.playAllButton}
                  onPress={handlePlayFolderTracks}
                >
                  <Ionicons name="play" size={16} color={Palette.background} />
                  <Text style={styles.playAllLabel}>Play All</Text>
                </Pressable>
                <ThemedText style={styles.trackCountLabel}>
                  {folderStore.tracks.length} tracks
                </ThemedText>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => {
          if ("path" in item) {
            return <FolderItem folder={item} onPress={handleFolderPress} />;
          }
          return (
            <TrackItem
              track={item}
              showArtwork
              showAlbum
              onPlay={handleTrackPlay}
              onMenu={handleTrackMenu}
            />
          );
        }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 120, flexGrow: 1 },
        ]}
      />
    );
  }

  function renderAlbums() {
    if (albumStore.isLoading && !albumStore.albums.length) {
      return (
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color={Palette.textPrimary}
        />
      );
    }
    if (albumStore.error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={40} color={Palette.caution} />
          <Text style={styles.errorText}>{albumStore.error}</Text>
        </View>
      );
    }
    if (!albumStore.albums.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="disc" size={40} color={Palette.textMuted} />
          <ThemedText style={styles.emptyText}>No albums found</ThemedText>
        </View>
      );
    }
    return (
      <FlatList
        key="albums-grid"
        data={albumStore.albums}
        keyExtractor={(item) => item.albumhash}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => <AlbumCard album={item} width={CARD_WIDTH} />}
        contentContainerStyle={[
          styles.gridContent,
          { paddingBottom: insets.bottom + 120, flexGrow: 1 },
        ]}
      />
    );
  }

  function renderArtists() {
    if (artistStore.isLoading && !artistStore.artists.length) {
      return (
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color={Palette.textPrimary}
        />
      );
    }
    if (artistStore.error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={40} color={Palette.caution} />
          <Text style={styles.errorText}>{artistStore.error}</Text>
        </View>
      );
    }
    if (!artistStore.artists.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="person" size={40} color={Palette.textMuted} />
          <ThemedText style={styles.emptyText}>No artists found</ThemedText>
        </View>
      );
    }
    return (
      <FlatList
        key="artists-grid"
        data={artistStore.artists}
        keyExtractor={(item) => item.artisthash}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <ArtistCard artist={item} width={CARD_WIDTH} />
        )}
        contentContainerStyle={[
          styles.gridContent,
          { paddingBottom: insets.bottom + 120, flexGrow: 1 },
        ]}
      />
    );
  }

  function renderPlaylists() {
    if (playlistStore.isLoading && !playlistStore.playlists.length) {
      return (
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color={Palette.textPrimary}
        />
      );
    }
    if (playlistStore.error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={40} color={Palette.caution} />
          <Text style={styles.errorText}>{playlistStore.error}</Text>
        </View>
      );
    }
    if (!playlistStore.playlists.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="list" size={40} color={Palette.textMuted} />
          <ThemedText style={styles.emptyText}>No playlists yet</ThemedText>
        </View>
      );
    }
    return (
      <FlatList
        key="playlists-grid"
        data={playlistStore.playlists}
        keyExtractor={(item) => String(item.id)}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <PlaylistCard playlist={item} width={CARD_WIDTH} />
        )}
        contentContainerStyle={[
          styles.gridContent,
          { paddingBottom: insets.bottom + 120, flexGrow: 1 },
        ]}
      />
    );
  }

  function renderFavorites() {
    if (favoritesStore.isLoading && !favoritesStore.tracks.length) {
      return (
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color={Palette.textPrimary}
        />
      );
    }
    if (favoritesStore.error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={40} color={Palette.caution} />
          <Text style={styles.errorText}>{favoritesStore.error}</Text>
        </View>
      );
    }
    if (
      !favoritesStore.tracks.length &&
      !favoritesStore.albums.length &&
      !favoritesStore.artists.length
    ) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="heart" size={40} color={Palette.textMuted} />
          <ThemedText style={styles.emptyText}>No favorites yet</ThemedText>
        </View>
      );
    }
    return (
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 120,
          flexGrow: 1,
        }}
      >
        {/* favorite tracks */}
        {favoritesStore.tracks.length > 0 && (
          <View style={styles.favoritesSection}>
            <ThemedText style={styles.sectionTitle}>Tracks</ThemedText>
            {favoritesStore.tracks.map((track) => (
              <TrackItem
                key={track.trackhash}
                track={track}
                showArtwork
                showAlbum
                onPlay={handleTrackPlay}
                onMenu={handleTrackMenu}
              />
            ))}
          </View>
        )}

        {/* favorite albums */}
        {favoritesStore.albums.length > 0 && (
          <View style={styles.favoritesSection}>
            <ThemedText style={styles.sectionTitle}>Albums</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {favoritesStore.albums.map((album) => (
                <AlbumCard key={album.albumhash} album={album} size="medium" />
              ))}
            </ScrollView>
          </View>
        )}

        {/* favorite artists */}
        {favoritesStore.artists.length > 0 && (
          <View style={styles.favoritesSection}>
            <ThemedText style={styles.sectionTitle}>Artists</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {favoritesStore.artists.map((artist) => (
                <ArtistCard
                  key={artist.artisthash}
                  artist={artist}
                  size="medium"
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderSegment() {
    if (segment === "folders") return renderFolders();
    if (segment === "albums") return renderAlbums();
    if (segment === "artists") return renderArtists();
    if (segment === "playlists") return renderPlaylists();
    if (segment === "favorites") return renderFavorites();
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Library</ThemedText>
      </View>

      {/* segment tabs */}
      <ScrollView
        ref={segmentScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.segmentScroll}
        contentContainerStyle={styles.segmentRow}
      >
        {segments.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSegment(s.key)}
            style={[
              styles.segmentButton,
              segment === s.key && styles.segmentButtonActive,
            ]}
          >
            <Ionicons
              name={s.icon}
              size={16}
              color={segment === s.key ? Palette.onPrimary : Palette.textMuted}
            />
            <Text
              style={[
                styles.segmentLabel,
                segment === s.key && styles.segmentLabelActive,
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* content */}
      <View style={styles.content}>{renderSegment()}</View>

      {/* track action sheet */}
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Palette.textPrimary,
    lineHeight: 34,
  },
  segmentScroll: {
    maxHeight: 44,
  },
  segmentRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  segmentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radii.sm,
    backgroundColor: Palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  segmentButtonActive: {
    backgroundColor: Palette.primary,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Palette.textMuted,
  },
  segmentLabelActive: {
    color: Palette.onPrimary,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 12,
    gap: GRID_GAP,
  },
  gridRow: {
    gap: GRID_GAP,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: Palette.textMuted,
  },
  errorText: {
    fontSize: 14,
    color: Palette.caution,
    textAlign: "center",
  },
  breadcrumbsContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  breadcrumbsScroll: {
    flex: 1,
  },
  breadcrumbItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  breadcrumbText: {
    fontSize: 14,
    color: Palette.textMuted,
  },
  breadcrumbSeparator: {
    fontSize: 14,
    color: Palette.textMuted,
    marginHorizontal: 6,
  },
  breadcrumbActive: {
    color: Palette.textPrimary,
    fontWeight: "500",
  },
  folderActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 12,
  },
  playAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radii.sm,
  },
  playAllLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Palette.onPrimary,
  },
  trackCountLabel: {
    fontSize: 13,
    color: Palette.textMuted,
  },
  rootFoldersHeader: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 16,
  },
  rootFoldersTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Palette.textPrimary,
    marginBottom: 4,
  },
  rootFoldersSubtitle: {
    fontSize: 13,
    color: Palette.textMuted,
  },
  rootFolderItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 8,
    marginBottom: 8,
    backgroundColor: Palette.surface,
    borderRadius: Radii.md,
    gap: 12,
  },
  rootFolderIcon: {
    width: 44,
    height: 44,
    borderRadius: Radii.sm,
    backgroundColor: Palette.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  rootFolderInfo: {
    flex: 1,
    gap: 2,
  },
  rootFolderName: {
    fontSize: 15,
    fontWeight: "500",
    color: Palette.textPrimary,
  },
  rootFolderPath: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  favoritesSection: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Palette.textPrimary,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  horizontalScrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
});
