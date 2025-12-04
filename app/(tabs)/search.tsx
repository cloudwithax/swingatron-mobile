import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Palette, Radii } from "@/constants/theme";
import { useSearchStore, usePlayerStore } from "@/src/stores";
import { getThumbnailUrl, getArtistImageUrl } from "@/src/api/client";
import type { Track, Album, Artist } from "@/src/api/types";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function TrackResultItem({
  track,
  onPlay,
}: {
  track: Track;
  onPlay: () => void;
}) {
  const imageUrl = getThumbnailUrl(track.image, "small");
  const artistNames = track.artists?.map((a) => a.name).join(", ") || "";

  return (
    <Pressable style={styles.resultRow} onPress={onPlay}>
      <View style={styles.resultImageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.resultImage} />
        ) : (
          <View style={[styles.resultImage, styles.placeholderImage]}>
            <Ionicons name="musical-note" size={20} color={Palette.textMuted} />
          </View>
        )}
      </View>
      <View style={styles.resultInfo}>
        <ThemedText numberOfLines={1} style={styles.resultTitle}>
          {track.title}
        </ThemedText>
        <ThemedText numberOfLines={1} style={styles.resultSubtitle}>
          {artistNames || track.album}
        </ThemedText>
      </View>
      <ThemedText style={styles.resultMeta}>
        {formatDuration(track.duration)}
      </ThemedText>
    </Pressable>
  );
}

function AlbumResultItem({
  album,
  onPress,
}: {
  album: Album;
  onPress: () => void;
}) {
  const imageUrl = getThumbnailUrl(album.image, "small");
  const artistNames = album.albumartists?.map((a) => a.name).join(", ") || "";

  return (
    <Pressable style={styles.resultRow} onPress={onPress}>
      <View style={styles.resultImageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.resultImage} />
        ) : (
          <View style={[styles.resultImage, styles.placeholderImage]}>
            <Ionicons name="disc" size={24} color={Palette.textMuted} />
          </View>
        )}
      </View>
      <View style={styles.resultInfo}>
        <ThemedText numberOfLines={1} style={styles.resultTitle}>
          {album.title}
        </ThemedText>
        {artistNames && (
          <ThemedText numberOfLines={1} style={styles.resultSubtitle}>
            {artistNames}
          </ThemedText>
        )}
        {album.trackcount && (
          <ThemedText style={styles.resultMeta}>
            {album.trackcount} {album.trackcount === 1 ? "track" : "tracks"}
          </ThemedText>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
    </Pressable>
  );
}

function ArtistResultItem({
  artist,
  onPress,
}: {
  artist: Artist;
  onPress: () => void;
}) {
  const imageUrl = getArtistImageUrl(artist.image);

  return (
    <Pressable style={styles.resultRow} onPress={onPress}>
      <View style={[styles.resultImageContainer, styles.artistImageContainer]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.resultImage} />
        ) : (
          <View style={[styles.resultImage, styles.placeholderImage]}>
            <Ionicons name="person" size={24} color={Palette.textMuted} />
          </View>
        )}
      </View>
      <View style={styles.resultInfo}>
        <ThemedText numberOfLines={1} style={styles.resultTitle}>
          {artist.name}
        </ThemedText>
        <ThemedText style={styles.resultMeta}>
          {artist.albumcount ? `${artist.albumcount} albums` : "artist"}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
    </Pressable>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setQueue = usePlayerStore((state) => state.setQueue);
  const { query, isLoading, error, topResults, search } = useSearchStore();

  function handleChange(text: string) {
    void search(text);
  }

  function handlePlayTrack(trackList: Track[], index: number) {
    void setQueue(trackList, index, false, "search", trackList[index].image);
  }

  function handleAlbumPress(albumhash: string) {
    router.push(`/album/${albumhash}`);
  }

  function handleArtistPress(artisthash: string) {
    router.push(`/artist/${artisthash}`);
  }

  function renderContent() {
    // defensive check for potentially undefined query
    const searchQuery = query ?? "";

    if (!searchQuery.trim() && !isLoading) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={48} color={Palette.textMuted} />
          <ThemedText style={styles.placeholder}>
            Start typing to search your library
          </ThemedText>
        </View>
      );
    }
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Palette.textPrimary} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={32} color={Palette.caution} />
          <Text style={styles.error}>{error}</Text>
        </View>
      );
    }

    if (topResults) {
      // defensive checks for potentially undefined arrays
      const resultTracks = topResults.tracks ?? [];
      const resultAlbums = topResults.albums ?? [];
      const resultArtists = topResults.artists ?? [];

      const hasResults =
        resultTracks.length > 0 ||
        resultAlbums.length > 0 ||
        resultArtists.length > 0;

      if (!hasResults) {
        return (
          <View style={styles.emptyState}>
            <Ionicons
              name="search-outline"
              size={48}
              color={Palette.textMuted}
            />
            <ThemedText style={styles.placeholder}>No results found</ThemedText>
          </View>
        );
      }

      return (
        <ScrollView
          style={styles.resultsScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {resultTracks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  Tracks
                </ThemedText>
                <ThemedText style={styles.sectionCount}>
                  {resultTracks.length}
                </ThemedText>
              </View>
              {resultTracks.slice(0, 5).map((track, index) => (
                <TrackResultItem
                  key={track.trackhash}
                  track={track}
                  onPlay={() => handlePlayTrack(resultTracks, index)}
                />
              ))}
            </View>
          )}

          {resultAlbums.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  Albums
                </ThemedText>
                <ThemedText style={styles.sectionCount}>
                  {resultAlbums.length}
                </ThemedText>
              </View>
              {resultAlbums.slice(0, 4).map((album) => (
                <AlbumResultItem
                  key={album.albumhash}
                  album={album}
                  onPress={() => handleAlbumPress(album.albumhash)}
                />
              ))}
            </View>
          )}

          {resultArtists.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  Artists
                </ThemedText>
                <ThemedText style={styles.sectionCount}>
                  {resultArtists.length}
                </ThemedText>
              </View>
              {resultArtists.slice(0, 4).map((artist) => (
                <ArtistResultItem
                  key={artist.artisthash}
                  artist={artist}
                  onPress={() => handleArtistPress(artist.artisthash)}
                />
              ))}
            </View>
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={48} color={Palette.textMuted} />
        <ThemedText style={styles.placeholder}>No results</ThemedText>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Search
          </ThemedText>
        </View>
        <View style={styles.searchBar}>
          <View style={styles.inputContainer}>
            <Ionicons
              name="search"
              size={18}
              color={Palette.textMuted}
              style={styles.searchIcon}
            />
            <TextInput
              value={query ?? ""}
              onChangeText={handleChange}
              placeholder="Search tracks, albums, artists"
              placeholderTextColor={Palette.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            {(query ?? "").length > 0 && (
              <Pressable
                onPress={() => handleChange("")}
                style={styles.clearButton}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={Palette.textMuted}
                />
              </Pressable>
            )}
          </View>
        </View>
        <View style={styles.content}>{renderContent()}</View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  title: {
    letterSpacing: 0.2,
  },
  subhead: {
    color: Palette.textSecondary,
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radii.md,
    backgroundColor: Palette.surface,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: Palette.textPrimary,
    fontSize: 16,
  },
  clearButton: {
    padding: 6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  error: {
    color: Palette.caution,
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  placeholder: {
    color: Palette.textMuted,
    textAlign: "center",
  },
  resultsScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionCount: {
    fontSize: 14,
    color: Palette.textMuted,
  },
  bottomSpacer: {
    height: 16,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Radii.md,
    backgroundColor: Palette.surfaceVariant,
    marginBottom: 8,
  },
  resultImageContainer: {
    width: 56,
    height: 56,
    borderRadius: Radii.sm,
    overflow: "hidden",
    backgroundColor: Palette.surfaceVariant,
  },
  artistImageContainer: {
    borderRadius: 28,
  },
  resultImage: {
    width: "100%",
    height: "100%",
  },
  resultInfo: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.textPrimary,
    letterSpacing: 0.2,
  },
  resultSubtitle: {
    fontSize: 13,
    color: Palette.textSecondary,
  },
  resultMeta: {
    fontSize: 12,
    color: Palette.textMuted,
    fontVariant: ["tabular-nums"],
  },
  placeholderImage: {
    backgroundColor: Palette.surfaceVariant,
    justifyContent: "center",
    alignItems: "center",
  },
});
