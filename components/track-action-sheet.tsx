import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Palette } from "@/constants/theme";
import { usePlayerStore, usePlaylistStore } from "@/src/stores";
import { getThumbnailUrl } from "@/src/api/client";
import { toggleFavorite } from "@/src/api/favorites";
import { addTracksToPlaylist, createPlaylist } from "@/src/api/playlists";
import type { Track, Playlist } from "@/src/api/types";

interface TrackActionSheetProps {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
  onFavoriteToggled?: (track: Track, isFavorite: boolean) => void;
}

type SheetView = "actions" | "playlists" | "new-playlist";

export function TrackActionSheet({
  track,
  visible,
  onClose,
  onFavoriteToggled,
}: TrackActionSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addToQueue, playNext } = usePlayerStore();
  const {
    playlists,
    loadPlaylists,
    isLoading: playlistsLoading,
  } = usePlaylistStore();

  const [view, setView] = useState<SheetView>("actions");
  const [isFavorite, setIsFavorite] = useState(track?.is_favorite ?? false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isAddingToPlaylist, setIsAddingToPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // reset state when track changes or sheet opens
  useEffect(() => {
    if (visible && track) {
      setView("actions");
      setIsFavorite(track.is_favorite ?? false);
      setSuccessMessage(null);
      setNewPlaylistName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, track?.trackhash]);

  // load playlists when switching to playlist view
  useEffect(() => {
    if (view === "playlists" && playlists.length === 0) {
      void loadPlaylists();
    }
  }, [view, playlists.length, loadPlaylists]);

  if (!track) return null;

  const thumbnailUrl = track.image
    ? getThumbnailUrl(track.image, "small")
    : null;
  const artistNames =
    track.artists && track.artists.length > 0
      ? track.artists.map((a) => a.name).join(", ")
      : "Unknown Artist";

  function handleClose() {
    setView("actions");
    setSuccessMessage(null);
    onClose();
  }

  function showSuccess(message: string) {
    setSuccessMessage(message);
    setTimeout(() => {
      handleClose();
    }, 1200);
  }

  async function handleToggleFavorite() {
    if (!track || isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    try {
      const newValue = await toggleFavorite(
        track.trackhash,
        "track",
        !isFavorite
      );
      setIsFavorite(newValue);
      onFavoriteToggled?.(track, newValue);
      showSuccess(newValue ? "Added to favorites" : "Removed from favorites");
    } catch {
      // silent fail
    } finally {
      setIsTogglingFavorite(false);
    }
  }

  function handlePlayNext() {
    if (!track) return;
    playNext(track);
    showSuccess("Playing next");
  }

  function handleAddToQueue() {
    if (!track) return;
    addToQueue(track);
    showSuccess("Added to queue");
  }

  function handleGoToAlbum() {
    if (track?.albumhash) {
      handleClose();
      router.push(`/album/${track.albumhash}`);
    }
  }

  function handleGoToArtist() {
    if (track?.artists && track.artists.length > 0) {
      handleClose();
      router.push(`/artist/${track.artists[0].artisthash}`);
    }
  }

  async function handleAddToPlaylist(playlist: Playlist) {
    if (!track || isAddingToPlaylist) return;
    setIsAddingToPlaylist(true);
    try {
      const success = await addTracksToPlaylist(playlist.id, [track]);
      if (success) {
        showSuccess(`Added to ${playlist.name}`);
      }
    } catch {
      // silent fail
    } finally {
      setIsAddingToPlaylist(false);
    }
  }

  async function handleCreatePlaylist() {
    if (!track || !newPlaylistName.trim() || isCreatingPlaylist) return;
    setIsCreatingPlaylist(true);
    try {
      const playlist = await createPlaylist(newPlaylistName.trim());
      if (playlist) {
        const success = await addTracksToPlaylist(playlist.id, [track]);
        if (success) {
          void loadPlaylists();
          showSuccess(`Added to ${playlist.name}`);
        }
      }
    } catch {
      // silent fail
    } finally {
      setIsCreatingPlaylist(false);
    }
  }

  function renderActionsView() {
    if (!track) return null;
    return (
      <>
        {/* track info header */}
        <View style={styles.trackHeader}>
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={styles.trackArtwork} />
          ) : (
            <View style={[styles.trackArtwork, styles.trackArtworkPlaceholder]}>
              <Ionicons
                name="musical-note"
                size={24}
                color={Palette.textMuted}
              />
            </View>
          )}
          <View style={styles.trackInfo}>
            <ThemedText style={styles.trackTitle} numberOfLines={1}>
              {track.title}
            </ThemedText>
            <ThemedText style={styles.trackArtist} numberOfLines={1}>
              {artistNames}
            </ThemedText>
          </View>
        </View>

        {/* action buttons */}
        <View style={styles.actionsContainer}>
          <Pressable style={styles.actionRow} onPress={handlePlayNext}>
            <View style={styles.actionIcon}>
              <Ionicons
                name="play-skip-forward"
                size={22}
                color={Palette.textSecondary}
              />
            </View>
            <ThemedText style={styles.actionLabel}>Play next</ThemedText>
          </Pressable>

          <Pressable style={styles.actionRow} onPress={handleAddToQueue}>
            <View style={styles.actionIcon}>
              <Ionicons name="list" size={22} color={Palette.textSecondary} />
            </View>
            <ThemedText style={styles.actionLabel}>Add to queue</ThemedText>
          </Pressable>

          <Pressable
            style={styles.actionRow}
            onPress={() => setView("playlists")}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="add" size={22} color={Palette.textSecondary} />
            </View>
            <ThemedText style={styles.actionLabel}>Add to playlist</ThemedText>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Palette.textMuted}
              style={styles.chevron}
            />
          </Pressable>

          <Pressable
            style={styles.actionRow}
            onPress={handleToggleFavorite}
            disabled={isTogglingFavorite}
          >
            <View style={styles.actionIcon}>
              {isTogglingFavorite ? (
                <ActivityIndicator size="small" color={Palette.textSecondary} />
              ) : (
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={22}
                  color={isFavorite ? Palette.primary : Palette.textSecondary}
                />
              )}
            </View>
            <ThemedText style={styles.actionLabel}>
              {isFavorite ? "Remove from favorites" : "Add to favorites"}
            </ThemedText>
          </Pressable>

          <View style={styles.separator} />

          {track?.albumhash && (
            <Pressable style={styles.actionRow} onPress={handleGoToAlbum}>
              <View style={styles.actionIcon}>
                <Ionicons name="disc" size={22} color={Palette.textSecondary} />
              </View>
              <ThemedText style={styles.actionLabel}>Go to album</ThemedText>
            </Pressable>
          )}

          {track?.artists && track.artists.length > 0 && (
            <Pressable style={styles.actionRow} onPress={handleGoToArtist}>
              <View style={styles.actionIcon}>
                <Ionicons
                  name="person"
                  size={22}
                  color={Palette.textSecondary}
                />
              </View>
              <ThemedText style={styles.actionLabel}>Go to artist</ThemedText>
            </Pressable>
          )}
        </View>
      </>
    );
  }

  function renderPlaylistsView() {
    return (
      <>
        {/* header */}
        <View style={styles.playlistHeader}>
          <Pressable
            onPress={() => setView("actions")}
            style={styles.backButton}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color={Palette.textPrimary} />
          </Pressable>
          <ThemedText style={styles.playlistHeaderTitle}>
            Add to playlist
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* create new playlist button */}
        <Pressable
          style={styles.createPlaylistRow}
          onPress={() => setView("new-playlist")}
        >
          <View style={styles.createPlaylistIcon}>
            <Ionicons name="add" size={24} color={Palette.textPrimary} />
          </View>
          <ThemedText style={styles.createPlaylistLabel}>
            Create new playlist
          </ThemedText>
        </Pressable>

        {/* playlists list */}
        {playlistsLoading ? (
          <ActivityIndicator
            style={styles.playlistLoading}
            color={Palette.textPrimary}
          />
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                style={styles.playlistRow}
                onPress={() => handleAddToPlaylist(item)}
                disabled={isAddingToPlaylist}
              >
                <View style={styles.playlistIcon}>
                  <Ionicons
                    name="musical-notes"
                    size={20}
                    color={Palette.textMuted}
                  />
                </View>
                <View style={styles.playlistInfo}>
                  <ThemedText style={styles.playlistName} numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText style={styles.playlistCount}>
                    {item.count} tracks
                  </ThemedText>
                </View>
                {isAddingToPlaylist && (
                  <ActivityIndicator size="small" color={Palette.textMuted} />
                )}
              </Pressable>
            )}
            contentContainerStyle={styles.playlistList}
            ListEmptyComponent={
              <ThemedText style={styles.emptyText}>No playlists yet</ThemedText>
            }
          />
        )}
      </>
    );
  }

  function renderNewPlaylistView() {
    return (
      <>
        {/* header */}
        <View style={styles.playlistHeader}>
          <Pressable
            onPress={() => setView("playlists")}
            style={styles.backButton}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color={Palette.textPrimary} />
          </Pressable>
          <ThemedText style={styles.playlistHeaderTitle}>
            New playlist
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* input */}
        <View style={styles.newPlaylistContainer}>
          <TextInput
            style={styles.newPlaylistInput}
            placeholder="Playlist name"
            placeholderTextColor={Palette.textMuted}
            value={newPlaylistName}
            onChangeText={setNewPlaylistName}
            autoFocus
          />
          <Pressable
            style={[
              styles.createButton,
              (!newPlaylistName.trim() || isCreatingPlaylist) &&
                styles.createButtonDisabled,
            ]}
            onPress={handleCreatePlaylist}
            disabled={!newPlaylistName.trim() || isCreatingPlaylist}
          >
            {isCreatingPlaylist ? (
              <ActivityIndicator size="small" color={Palette.onPrimary} />
            ) : (
              <ThemedText style={styles.createButtonLabel}>Create</ThemedText>
            )}
          </Pressable>
        </View>
      </>
    );
  }

  function renderSuccessView() {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={48} color={Palette.success} />
        <ThemedText style={styles.successText}>{successMessage}</ThemedText>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* drag handle */}
          <View style={styles.dragHandle} />

          {successMessage
            ? renderSuccessView()
            : view === "actions"
            ? renderActionsView()
            : view === "playlists"
            ? renderPlaylistsView()
            : renderNewPlaylistView()}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: "80%",
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  trackHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    gap: 14,
  },
  trackArtwork: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: Palette.surfaceVariant,
  },
  trackArtworkPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  trackInfo: {
    flex: 1,
    gap: 4,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Palette.textPrimary,
  },
  trackArtist: {
    fontSize: 14,
    color: Palette.textMuted,
  },
  actionsContainer: {
    paddingVertical: 8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    color: Palette.textSecondary,
    marginLeft: 12,
  },
  chevron: {
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: 8,
    marginHorizontal: 20,
  },
  playlistHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: Palette.textPrimary,
    textAlign: "center",
  },
  createPlaylistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  createPlaylistIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: Palette.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  createPlaylistLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: Palette.textPrimary,
    marginLeft: 14,
  },
  playlistLoading: {
    marginTop: 32,
  },
  playlistList: {
    paddingVertical: 8,
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 14,
  },
  playlistIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: Palette.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistInfo: {
    flex: 1,
    gap: 2,
  },
  playlistName: {
    fontSize: 15,
    fontWeight: "500",
    color: Palette.textPrimary,
  },
  playlistCount: {
    fontSize: 13,
    color: Palette.textMuted,
  },
  emptyText: {
    fontSize: 14,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 32,
  },
  newPlaylistContainer: {
    padding: 20,
    gap: 16,
  },
  newPlaylistInput: {
    fontSize: 16,
    color: Palette.textPrimary,
    backgroundColor: Palette.surfaceVariant,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  createButton: {
    backgroundColor: Palette.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Palette.onPrimary,
  },
  successContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 16,
  },
  successText: {
    fontSize: 16,
    color: Palette.textPrimary,
  },
});
