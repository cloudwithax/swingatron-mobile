import { useEffect, useState } from "react";
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

import { ThemedText } from "@/components/themed-text";
import { useStatsStore, usePlayerStore } from "@/src/stores";
import { getThumbnailUrl, getArtistImageUrl } from "@/src/api/client";
import type { ChartTrack, ChartDuration } from "@/src/api/types";

const durations: { key: ChartDuration; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "alltime", label: "All" },
];

type StatsTab = "tracks" | "artists" | "albums" | "overview";

export default function StatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setQueue } = usePlayerStore();
  const {
    topTracks,
    topArtists,
    topAlbums,
    weeklyStats,
    tracksScrobbles,
    artistsScrobbles,
    albumsScrobbles,
    statsDates,
    isLoadingTracks,
    isLoadingArtists,
    isLoadingAlbums,
    isLoadingStats,
    error,
    duration,
    loadAll,
    setDuration,
  } = useStatsStore();

  const [activeTab, setActiveTab] = useState<StatsTab>("tracks");

  useEffect(() => {
    if (!topTracks.length && !topArtists.length && !topAlbums.length) {
      void loadAll();
    }
  }, [topTracks.length, topArtists.length, topAlbums.length, loadAll]);

  function handlePlayTrack(track: ChartTrack, index: number) {
    // play from the top tracks list
    const tracks = topTracks.map((t) => ({
      ...t,
      trackhash: t.trackhash,
      title: t.title,
      album: t.album,
      albumhash: t.albumhash,
      duration: t.duration,
      image: t.image,
      filepath: t.filepath,
      artists: t.artists,
      bitrate: t.bitrate,
      folder: t.folder,
    }));
    void setQueue(
      tracks,
      index,
      false,
      `stats:top-tracks:${duration}`,
      tracks[index].image
    );
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
            <Ionicons name="stats-chart" size={36} color="#4caf50" />
          </View>
          <ThemedText style={styles.headerTitle}>Listening Stats</ThemedText>
          {statsDates && (
            <ThemedText style={styles.headerMeta}>{statsDates}</ThemedText>
          )}
        </View>

        {/* duration controls */}
        <View style={styles.durationRow}>
          {durations.map((d) => (
            <Pressable
              key={d.key}
              onPress={() => void setDuration(d.key)}
              style={[
                styles.durationButton,
                duration === d.key && styles.durationButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.durationLabel,
                  duration === d.key && styles.durationLabelActive,
                ]}
              >
                {d.label}
              </Text>
            </Pressable>
          ))}
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
              Tracks
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
              Artists
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
              Albums
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "overview" && styles.tabActive]}
            onPress={() => setActiveTab("overview")}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === "overview" && styles.tabLabelActive,
              ]}
            >
              Overview
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderTracksTab() {
    if (isLoadingTracks && !topTracks.length) {
      return (
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color="#ffffff"
        />
      );
    }

    if (!topTracks.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes" size={48} color="#424242" />
          <ThemedText style={styles.emptyText}>
            No listening data yet
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.listContent}>
        {tracksScrobbles && (
          <View style={styles.scrobblesCard}>
            <View style={styles.scrobblesInfo}>
              <ThemedText style={styles.scrobblesText}>
                {tracksScrobbles.text}
              </ThemedText>
              <View style={styles.trendBadge}>
                <Ionicons
                  name={
                    tracksScrobbles.trend === "rising"
                      ? "trending-up"
                      : tracksScrobbles.trend === "falling"
                      ? "trending-down"
                      : "remove"
                  }
                  size={14}
                  color={
                    tracksScrobbles.trend === "rising"
                      ? "#4caf50"
                      : tracksScrobbles.trend === "falling"
                      ? "#ef5350"
                      : "#757575"
                  }
                />
              </View>
            </View>
          </View>
        )}

        {topTracks.map((track, index) => (
          <Pressable
            key={`${track.trackhash}-${index}`}
            style={styles.chartItem}
            onPress={() => handlePlayTrack(track, index)}
          >
            <View style={styles.chartRank}>
              <ThemedText style={styles.rankText}>{index + 1}</ThemedText>
              <TrendIndicator trend={track.trend} />
            </View>
            <View style={styles.chartArtwork}>
              {track.image ? (
                <Image
                  source={{ uri: getThumbnailUrl(track.image, "small") }}
                  style={styles.chartImage}
                />
              ) : (
                <View style={[styles.chartImage, styles.chartImagePlaceholder]}>
                  <Ionicons name="musical-note" size={18} color="#616161" />
                </View>
              )}
            </View>
            <View style={styles.chartInfo}>
              <ThemedText style={styles.chartTitle} numberOfLines={1}>
                {track.title}
              </ThemedText>
              <ThemedText style={styles.chartSubtitle} numberOfLines={1}>
                {track.artists?.[0]?.name || "Unknown Artist"}
              </ThemedText>
            </View>
            <ThemedText style={styles.chartMeta}>{track.help_text}</ThemedText>
          </Pressable>
        ))}
      </View>
    );
  }

  function renderArtistsTab() {
    if (isLoadingArtists && !topArtists.length) {
      return (
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color="#ffffff"
        />
      );
    }

    if (!topArtists.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="person" size={48} color="#424242" />
          <ThemedText style={styles.emptyText}>
            No listening data yet
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.listContent}>
        {artistsScrobbles && (
          <View style={styles.scrobblesCard}>
            <View style={styles.scrobblesInfo}>
              <ThemedText style={styles.scrobblesText}>
                {artistsScrobbles.text}
              </ThemedText>
              <View style={styles.trendBadge}>
                <Ionicons
                  name={
                    artistsScrobbles.trend === "rising"
                      ? "trending-up"
                      : artistsScrobbles.trend === "falling"
                      ? "trending-down"
                      : "remove"
                  }
                  size={14}
                  color={
                    artistsScrobbles.trend === "rising"
                      ? "#4caf50"
                      : artistsScrobbles.trend === "falling"
                      ? "#ef5350"
                      : "#757575"
                  }
                />
              </View>
            </View>
          </View>
        )}

        {topArtists.map((artist, index) => (
          <Pressable
            key={`${artist.artisthash}-${index}`}
            style={styles.chartItem}
            onPress={() => router.push(`/artist/${artist.artisthash}`)}
          >
            <View style={styles.chartRank}>
              <ThemedText style={styles.rankText}>{index + 1}</ThemedText>
              <TrendIndicator trend={artist.trend} />
            </View>
            <View style={styles.chartArtwork}>
              {artist.image ? (
                <Image
                  source={{ uri: getArtistImageUrl(artist.image) }}
                  style={[styles.chartImage, styles.artistImage]}
                />
              ) : (
                <View
                  style={[
                    styles.chartImage,
                    styles.artistImage,
                    styles.chartImagePlaceholder,
                  ]}
                >
                  <Ionicons name="person" size={18} color="#616161" />
                </View>
              )}
            </View>
            <View style={styles.chartInfo}>
              <ThemedText style={styles.chartTitle} numberOfLines={1}>
                {artist.name}
              </ThemedText>
              <ThemedText style={styles.chartSubtitle} numberOfLines={1}>
                {artist.extra?.playcount
                  ? `${artist.extra.playcount} plays`
                  : ""}
              </ThemedText>
            </View>
            <ThemedText style={styles.chartMeta}>{artist.help_text}</ThemedText>
          </Pressable>
        ))}
      </View>
    );
  }

  function renderAlbumsTab() {
    if (isLoadingAlbums && !topAlbums.length) {
      return (
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color="#ffffff"
        />
      );
    }

    if (!topAlbums.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="disc" size={48} color="#424242" />
          <ThemedText style={styles.emptyText}>
            No listening data yet
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.listContent}>
        {albumsScrobbles && (
          <View style={styles.scrobblesCard}>
            <View style={styles.scrobblesInfo}>
              <ThemedText style={styles.scrobblesText}>
                {albumsScrobbles.text}
              </ThemedText>
              <View style={styles.trendBadge}>
                <Ionicons
                  name={
                    albumsScrobbles.trend === "rising"
                      ? "trending-up"
                      : albumsScrobbles.trend === "falling"
                      ? "trending-down"
                      : "remove"
                  }
                  size={14}
                  color={
                    albumsScrobbles.trend === "rising"
                      ? "#4caf50"
                      : albumsScrobbles.trend === "falling"
                      ? "#ef5350"
                      : "#757575"
                  }
                />
              </View>
            </View>
          </View>
        )}

        {topAlbums.map((album, index) => (
          <Pressable
            key={`${album.albumhash}-${index}`}
            style={styles.chartItem}
            onPress={() => router.push(`/album/${album.albumhash}`)}
          >
            <View style={styles.chartRank}>
              <ThemedText style={styles.rankText}>{index + 1}</ThemedText>
              <TrendIndicator trend={album.trend} />
            </View>
            <View style={styles.chartArtwork}>
              {album.image ? (
                <Image
                  source={{ uri: getThumbnailUrl(album.image, "small") }}
                  style={styles.chartImage}
                />
              ) : (
                <View style={[styles.chartImage, styles.chartImagePlaceholder]}>
                  <Ionicons name="disc" size={18} color="#616161" />
                </View>
              )}
            </View>
            <View style={styles.chartInfo}>
              <ThemedText style={styles.chartTitle} numberOfLines={1}>
                {album.title}
              </ThemedText>
              <ThemedText style={styles.chartSubtitle} numberOfLines={1}>
                {album.albumartists?.[0]?.name || "Unknown Artist"}
              </ThemedText>
            </View>
            <ThemedText style={styles.chartMeta}>{album.help_text}</ThemedText>
          </Pressable>
        ))}
      </View>
    );
  }

  function renderOverviewTab() {
    if (isLoadingStats && !weeklyStats.length) {
      return (
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color="#ffffff"
        />
      );
    }

    if (!weeklyStats.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="analytics" size={48} color="#424242" />
          <ThemedText style={styles.emptyText}>No stats available</ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.overviewContent}>
        {weeklyStats.map((stat, index) => (
          <View key={`${stat.type}-${index}`} style={styles.statCard}>
            <View style={styles.statIconContainer}>
              {stat.image ? (
                <Image
                  source={{
                    uri:
                      stat.type === "artist"
                        ? getArtistImageUrl(stat.image)
                        : getThumbnailUrl(stat.image, "small"),
                  }}
                  style={styles.statImage}
                />
              ) : (
                <View style={[styles.statImage, styles.statImagePlaceholder]}>
                  <Ionicons
                    name={
                      stat.type === "track"
                        ? "musical-note"
                        : stat.type === "album"
                        ? "disc"
                        : stat.type === "artist"
                        ? "person"
                        : "analytics"
                    }
                    size={24}
                    color="#616161"
                  />
                </View>
              )}
            </View>
            <View style={styles.statInfo}>
              <ThemedText style={styles.statTitle}>{stat.title}</ThemedText>
              <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}

        {error && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        {activeTab === "tracks" && renderTracksTab()}
        {activeTab === "artists" && renderArtistsTab()}
        {activeTab === "albums" && renderAlbumsTab()}
        {activeTab === "overview" && renderOverviewTab()}
      </ScrollView>
    </View>
  );
}

function TrendIndicator({ trend }: { trend: "rising" | "falling" | "stable" }) {
  if (trend === "stable") return null;

  return (
    <Ionicons
      name={trend === "rising" ? "caret-up" : "caret-down"}
      size={10}
      color={trend === "rising" ? "#4caf50" : "#ef5350"}
      style={styles.trendIcon}
    />
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(76,175,80,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  durationRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  durationButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#424242",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  durationButtonActive: {
    backgroundColor: "#f5f5f5",
    borderColor: "#f5f5f5",
  },
  durationLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#e0e0e0",
  },
  durationLabelActive: {
    color: "#111111",
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
  listContent: {
    paddingHorizontal: 16,
  },
  scrobblesCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  scrobblesInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scrobblesText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#ffffff",
    flex: 1,
  },
  trendBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  chartItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
    gap: 12,
  },
  chartRank: {
    width: 28,
    alignItems: "center",
  },
  rankText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9e9e9e",
  },
  trendIcon: {
    marginTop: 2,
  },
  chartArtwork: {
    width: 48,
    height: 48,
  },
  chartImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#1e1e1e",
  },
  artistImage: {
    borderRadius: 24,
  },
  chartImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  chartInfo: {
    flex: 1,
    gap: 2,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#f5f5f5",
  },
  chartSubtitle: {
    fontSize: 13,
    color: "#9e9e9e",
  },
  chartMeta: {
    fontSize: 12,
    color: "#757575",
  },
  overviewContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  statIconContainer: {
    width: 56,
    height: 56,
  },
  statImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },
  statImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  statInfo: {
    flex: 1,
    gap: 4,
  },
  statTitle: {
    fontSize: 13,
    color: "#9e9e9e",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#757575",
  },
  loading: {
    marginTop: 48,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: "#ef5350",
  },
});
