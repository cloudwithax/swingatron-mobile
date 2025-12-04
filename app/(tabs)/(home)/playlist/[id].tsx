import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
  Dimensions,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/themed-text";
import { TrackItem } from "@/components/track-item";
import { TrackActionSheet } from "@/components/track-action-sheet";
import { usePlaylistStore, usePlayerStore } from "@/src/stores";
import { getPlaylistImageUrl, getThumbnailUrl } from "@/src/api/client";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import type { Track } from "@/src/api/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ARTWORK_SIZE = Math.min(SCREEN_WIDTH * 0.5, 200);

export default function PlaylistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const playlistIdParam = params.id;
  const numericId = playlistIdParam ? Number(playlistIdParam) : NaN;

  const {
    currentPlaylist,
    isLoadingDetail,
    detailError,
    loadPlaylistDetail,
    togglePin,
    deletePlaylist,
    removeTrack,
    clearDetail,
  } = usePlaylistStore();

  const { setQueue, playbackSource, pause, shuffleMode, toggleShuffle } =
    usePlayerStore();
  const { isPlaying } = usePlaybackProgress();

  // check if this playlist is currently playing
  const isCurrentlyPlaying = isPlaying && playbackSource === `pl:${numericId}`;
  const isCurrentlyShuffling = isCurrentlyPlaying && shuffleMode;

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isTogglingPin, setIsTogglingPin] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const scrollY = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (!Number.isNaN(numericId)) {
      void loadPlaylistDetail(numericId);
    }
  }, [numericId, loadPlaylistDetail]);

  // clear playlist data immediately when leaving the screen to prevent stale data showing
  useEffect(() => {
    return () => {
      clearDetail();
    };
  }, [clearDetail]);

  const handleTogglePin = useCallback(async () => {
    if (!currentPlaylist || isTogglingPin) return;
    setIsTogglingPin(true);
    try {
      await togglePin(currentPlaylist.info.id);
    } catch {
      // silent fail
    } finally {
      setIsTogglingPin(false);
      setShowEditModal(false);
    }
  }, [currentPlaylist, isTogglingPin, togglePin]);

  const handleDeletePlaylist = useCallback(() => {
    if (!currentPlaylist) return;
    Alert.alert(
      "Delete Playlist",
      `Are you sure you want to delete "${currentPlaylist.info.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              const success = await deletePlaylist(currentPlaylist.info.id);
              if (success) {
                router.back();
              }
            } catch {
              // silent fail
            } finally {
              setIsDeleting(false);
              setShowEditModal(false);
            }
          },
        },
      ]
    );
  }, [currentPlaylist, deletePlaylist, router]);

  const handleRemoveTrack = useCallback(
    async (track: Track, index: number) => {
      if (!currentPlaylist) return;
      try {
        await removeTrack(currentPlaylist.info.id, track, index);
      } catch {
        // silent fail
      }
    },
    [currentPlaylist, removeTrack]
  );

  function handlePlayTrack(track: Track) {
    if (!currentPlaylist) return;
    const index = currentPlaylist.tracks.findIndex(
      (t) => t.trackhash === track.trackhash
    );
    if (index >= 0) {
      void setQueue(
        currentPlaylist.tracks,
        index,
        false,
        `pl:${currentPlaylist.info.id}`,
        track.image
      );
    }
  }

  async function handlePlayAll(shuffle = false) {
    if (!currentPlaylist || !currentPlaylist.tracks.length) return;
    // if already playing this playlist shuffled, unshuffle it
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
      currentPlaylist.tracks,
      startIndex,
      shuffle,
      `pl:${currentPlaylist.info.id}`,
      currentPlaylist.tracks[startIndex].image
    );
  }

  function handleTrackMenu(track: Track) {
    setSelectedTrack(track);
    setShowActionSheet(true);
  }

  function handleCloseActionSheet() {
    setShowActionSheet(false);
    setSelectedTrack(null);
  }

  if (Number.isNaN(numericId)) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.emptyState}>
          <Ionicons name="list" size={64} color="#424242" />
          <ThemedText style={styles.placeholder}>
            Invalid playlist ID
          </ThemedText>
        </View>
      </View>
    );
  }

  if (isLoadingDetail && !currentPlaylist) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color="#ffffff"
        />
      </View>
    );
  }

  if (detailError && !currentPlaylist) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={64} color="#ef5350" />
          <Text style={styles.error}>{detailError}</Text>
        </View>
      </View>
    );
  }

  if (!currentPlaylist) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.emptyState}>
          <Ionicons name="list" size={64} color="#424242" />
          <ThemedText style={styles.placeholder}>Playlist not found</ThemedText>
        </View>
      </View>
    );
  }

  const trackCount = currentPlaylist.tracks.length;
  const totalDuration = currentPlaylist.tracks.reduce(
    (acc, t) => acc + (t.duration || 0),
    0
  );
  const totalMins = Math.floor(totalDuration / 60);

  // get playlist image or first track image
  const playlistImageUrl = currentPlaylist.info.image
    ? getPlaylistImageUrl(currentPlaylist.info.image)
    : null;
  const firstTrackImageUrl =
    currentPlaylist.tracks.length > 0 && currentPlaylist.tracks[0].image
      ? getThumbnailUrl(currentPlaylist.tracks[0].image, "large")
      : null;
  const displayImageUrl = playlistImageUrl || firstTrackImageUrl;

  // animated header opacity
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100, 180],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });

  function renderEditModal() {
    return (
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowEditModal(false)}
        >
          <Pressable
            style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalDragHandle} />
            <ThemedText style={styles.modalTitle}>Playlist Options</ThemedText>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalAction}
                onPress={() => setIsEditMode(!isEditMode)}
              >
                <View style={styles.modalActionIcon}>
                  <Ionicons
                    name={isEditMode ? "checkmark" : "pencil"}
                    size={22}
                    color="#e0e0e0"
                  />
                </View>
                <ThemedText style={styles.modalActionLabel}>
                  {isEditMode ? "Done Editing" : "Edit Tracks"}
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.modalAction}
                onPress={handleTogglePin}
                disabled={isTogglingPin}
              >
                <View style={styles.modalActionIcon}>
                  {isTogglingPin ? (
                    <ActivityIndicator size="small" color="#e0e0e0" />
                  ) : (
                    <Ionicons
                      name={
                        currentPlaylist?.info.pinned ? "pin" : "pin-outline"
                      }
                      size={22}
                      color="#e0e0e0"
                    />
                  )}
                </View>
                <ThemedText style={styles.modalActionLabel}>
                  {currentPlaylist?.info.pinned
                    ? "Unpin Playlist"
                    : "Pin Playlist"}
                </ThemedText>
              </Pressable>

              <View style={styles.modalSeparator} />

              <Pressable
                style={styles.modalAction}
                onPress={handleDeletePlaylist}
                disabled={isDeleting}
              >
                <View style={styles.modalActionIcon}>
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#ef5350" />
                  ) : (
                    <Ionicons name="trash" size={22} color="#ef5350" />
                  )}
                </View>
                <ThemedText
                  style={[
                    styles.modalActionLabel,
                    styles.modalActionLabelDanger,
                  ]}
                >
                  Delete Playlist
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      {/* animated header bar */}
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
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <ThemedText style={styles.headerTitle} numberOfLines={1}>
          {currentPlaylist.info.name}
        </ThemedText>
        <Pressable
          onPress={() => setShowEditModal(true)}
          style={styles.headerEditButton}
          hitSlop={12}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#ffffff" />
        </Pressable>
      </Animated.View>

      <Animated.FlatList
        data={currentPlaylist.tracks}
        keyExtractor={(item, index) => `${item.trackhash}:${index}`}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + 56 }]}>
            {/* back button */}
            <Pressable
              onPress={() => router.back()}
              style={[styles.backButton, { top: insets.top + 8 }]}
              hitSlop={12}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </Pressable>

            {/* edit button */}
            <Pressable
              onPress={() => setShowEditModal(true)}
              style={[styles.editButton, { top: insets.top + 8 }]}
              hitSlop={12}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color="#ffffff" />
            </Pressable>

            {/* playlist artwork */}
            <View style={styles.iconContainer}>
              {displayImageUrl ? (
                <Image
                  source={{ uri: displayImageUrl }}
                  style={styles.playlistImage}
                />
              ) : (
                <View style={styles.playlistIcon}>
                  <Ionicons name="musical-notes" size={50} color="#9e9e9e" />
                </View>
              )}
              {currentPlaylist.info.pinned && (
                <View style={styles.pinnedBadge}>
                  <Ionicons name="pin" size={14} color="#ffffff" />
                </View>
              )}
              <LinearGradient
                colors={["transparent", "rgba(10,10,10,0.8)", "#0a0a0a"]}
                style={styles.imageGradient}
              />
            </View>

            {/* info */}
            <ThemedText style={styles.title} numberOfLines={2}>
              {currentPlaylist.info.name}
            </ThemedText>
            <ThemedText style={styles.meta}>
              {trackCount} tracks \u2022 {totalMins} min
            </ThemedText>

            {/* actions */}
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
                  color="#111111"
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
                <Ionicons name="shuffle" size={20} color="#ffffff" />
                <Text style={styles.shuffleButtonLabel}>
                  {isCurrentlyShuffling ? "Unshuffle" : "Shuffle"}
                </Text>
              </Pressable>
            </View>

            {/* edit mode indicator */}
            {isEditMode && (
              <View style={styles.editModeIndicator}>
                <Ionicons name="information-circle" size={18} color="#ffc107" />
                <ThemedText style={styles.editModeText}>
                  Tap the remove button to delete tracks
                </ThemedText>
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.trackItemContainer}>
            <TrackItem
              track={item}
              index={index}
              showArtwork
              showAlbum
              onPlay={handlePlayTrack}
              onMenu={isEditMode ? undefined : handleTrackMenu}
            />
            {isEditMode && (
              <Pressable
                style={styles.removeTrackButton}
                onPress={() => handleRemoveTrack(item, index)}
              >
                <Ionicons name="remove-circle" size={24} color="#ef5350" />
              </Pressable>
            )}
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes" size={48} color="#424242" />
            <ThemedText style={styles.emptyText}>
              This playlist is empty
            </ThemedText>
          </View>
        }
      />

      {/* edit modal */}
      {renderEditModal()}

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
    backgroundColor: "#0a0a0a",
  },
  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: "#0a0a0a",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
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
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
  },
  headerEditButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  editButton: {
    position: "absolute",
    top: 8,
    right: 16,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  iconContainer: {
    marginBottom: 20,
    position: "relative",
  },
  playlistImage: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 12,
    backgroundColor: "#1e1e1e",
  },
  playlistIcon: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 12,
    backgroundColor: "#1e1e1e",
    alignItems: "center",
    justifyContent: "center",
  },
  pinnedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageGradient: {
    position: "absolute",
    bottom: -20,
    left: -40,
    right: -40,
    height: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 6,
  },
  meta: {
    fontSize: 13,
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
    gap: 8,
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  playButtonLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },
  shuffleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  shuffleButtonLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  editModeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,193,7,0.15)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  editModeText: {
    fontSize: 13,
    color: "#ffc107",
  },
  trackItemContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  removeTrackButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#757575",
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
  },
  placeholder: {
    fontSize: 16,
    color: "#757575",
  },
  // modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#424242",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 16,
  },
  modalActions: {
    paddingVertical: 8,
  },
  modalAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  modalActionIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalActionLabel: {
    flex: 1,
    fontSize: 16,
    color: "#e0e0e0",
    marginLeft: 12,
  },
  modalActionLabelDanger: {
    color: "#ef5350",
  },
  modalSeparator: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginVertical: 8,
    marginHorizontal: 20,
  },
});
