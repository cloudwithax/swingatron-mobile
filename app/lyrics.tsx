import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { usePlayerStore, useNowPlayingTransitionStore } from "@/src/stores";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import {
  fetchLyrics,
  getThumbnailUrl,
  searchAndDownloadLyrics,
} from "../src/api/client";
import { Palette, Radii } from "@/constants/theme";

interface SyncedLine {
  time: number;
  text: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// individual lyric line component
interface LyricLineProps {
  line: SyncedLine;
  index: number;
  currentIndex: number;
  onPress: () => void;
}

const LyricLine = memo(
  function LyricLine({ line, index, currentIndex, onPress }: LyricLineProps) {
    const isActive = index === currentIndex;
    const isPast = index < currentIndex;

    return (
      <Pressable onPress={onPress}>
        <View style={styles.lineContainer}>
          <ThemedText
            style={[
              styles.lyricLine,
              isActive && styles.lyricLineActive,
              isPast && styles.lyricLinePast,
            ]}
          >
            {line.text || "\u266A"}
          </ThemedText>
        </View>
      </Pressable>
    );
  },
  (prevProps, nextProps) => {
    // only re-render if this line's active/past state changed
    const prevIsActive = prevProps.index === prevProps.currentIndex;
    const nextIsActive = nextProps.index === nextProps.currentIndex;
    const prevIsPast = prevProps.index < prevProps.currentIndex;
    const nextIsPast = nextProps.index < nextProps.currentIndex;

    return (
      prevProps.line.text === nextProps.line.text &&
      prevIsActive === nextIsActive &&
      prevIsPast === nextIsPast
    );
  }
);

// unsynced line component
function UnsyncedLine({ text }: { text: string }) {
  return (
    <View style={styles.lineContainer}>
      <ThemedText style={styles.lyricLineUnsynced}>{text || " "}</ThemedText>
    </View>
  );
}

export default function LyricsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<SyncedLine>>(null);
  const { position } = usePlaybackProgress();
  const { currentTrack, seekTo } = usePlayerStore();

  // transition state from store
  const lyricsCardLayout = useNowPlayingTransitionStore(
    (s) => s.lyricsCardLayout
  );
  const collapseLyrics = useNowPlayingTransitionStore((s) => s.collapseLyrics);
  const expand = useNowPlayingTransitionStore((s) => s.expand);
  const setLyricsCardLayout = useNowPlayingTransitionStore(
    (s) => s.setLyricsCardLayout
  );

  // animation progress (0 = card size, 1 = full screen)
  const animationProgress = useSharedValue(lyricsCardLayout ? 0 : 1);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const [syncedLines, setSyncedLines] = useState<SyncedLine[]>([]);
  const [unsyncedLines, setUnsyncedLines] = useState<string[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const initialScrollRef = useRef(false);

  // animate in on mount
  useEffect(() => {
    if (lyricsCardLayout) {
      // animate to full screen
      animationProgress.value = withTiming(1, {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // finish back navigation after animation
  const finishBack = useCallback(() => {
    collapseLyrics();
    setLyricsCardLayout(null);
    expand();
    router.back();
  }, [collapseLyrics, setLyricsCardLayout, expand, router]);

  // handle back navigation with animation
  const handleBack = useCallback(() => {
    if (lyricsCardLayout && !isAnimatingOut) {
      setIsAnimatingOut(true);
      // animate back to card position
      animationProgress.value = withTiming(
        0,
        {
          duration: 300,
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(finishBack)();
          }
        }
      );
    } else {
      finishBack();
    }
  }, [lyricsCardLayout, isAnimatingOut, animationProgress, finishBack]);

  // animated container style - morphs from card position to full screen using transforms
  const containerAnimatedStyle = useAnimatedStyle(() => {
    if (!lyricsCardLayout) {
      return {
        position: "absolute",
        left: 0,
        top: 0,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        borderRadius: 0,
        transform: [
          { translateX: 0 },
          { translateY: 0 },
          { scaleX: 1 },
          { scaleY: 1 },
        ],
      };
    }

    // Calculate target scales (when progress is 0)
    const targetScaleX = lyricsCardLayout.width / SCREEN_WIDTH;
    const targetScaleY = lyricsCardLayout.height / SCREEN_HEIGHT;

    // Calculate target translations (when progress is 0)
    // The view is centered at SCREEN_WIDTH/2, SCREEN_HEIGHT/2 by default (if top/left are 0)
    // We want it centered at lyricsCardLayout center
    const targetCenterX = lyricsCardLayout.x + lyricsCardLayout.width / 2;
    const targetCenterY = lyricsCardLayout.y + lyricsCardLayout.height / 2;

    const startTranslateX = targetCenterX - SCREEN_WIDTH / 2;
    const startTranslateY = targetCenterY - SCREEN_HEIGHT / 2;

    const scaleX = interpolate(
      animationProgress.value,
      [0, 1],
      [targetScaleX, 1]
    );
    const scaleY = interpolate(
      animationProgress.value,
      [0, 1],
      [targetScaleY, 1]
    );

    const translateX = interpolate(
      animationProgress.value,
      [0, 1],
      [startTranslateX, 0]
    );
    const translateY = interpolate(
      animationProgress.value,
      [0, 1],
      [startTranslateY, 0]
    );

    // Compensate border radius scaling
    const borderRadius = interpolate(
      animationProgress.value,
      [0, 1],
      [Radii.lg / targetScaleX, 0]
    );

    return {
      position: "absolute",
      left: 0,
      top: 0,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      borderRadius,
      transform: [{ translateX }, { translateY }, { scaleX }, { scaleY }],
    };
  });

  // inverse scale for inner content to prevent squash effect
  const innerContentStyle = useAnimatedStyle(() => {
    if (!lyricsCardLayout) return { transform: [{ scaleX: 1 }, { scaleY: 1 }] };

    const targetScaleX = lyricsCardLayout.width / SCREEN_WIDTH;
    const targetScaleY = lyricsCardLayout.height / SCREEN_HEIGHT;

    // Inverse scale to keep content visually constant size (masked effect)
    const scaleX = interpolate(
      animationProgress.value,
      [0, 1],
      [1 / targetScaleX, 1]
    );
    const scaleY = interpolate(
      animationProgress.value,
      [0, 1],
      [1 / targetScaleY, 1]
    );

    return {
      flex: 1,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      transform: [{ scaleX }, { scaleY }],
    };
  });

  // animated content opacity - fade in header and controls as we expand
  const contentOpacityStyle = useAnimatedStyle(() => {
    const opacity = interpolate(animationProgress.value, [0.3, 0.8], [0, 1]);
    return { opacity };
  });

  // animated background opacity
  const backgroundOpacityStyle = useAnimatedStyle(() => {
    const opacity = interpolate(animationProgress.value, [0, 0.5], [0, 0.6]);
    return { opacity };
  });

  // load lyrics when track changes
  useEffect(() => {
    if (!currentTrack) return;
    void loadLyrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.trackhash]);

  // update current line index based on playback position
  useEffect(() => {
    if (!isSynced || syncedLines.length === 0) return;

    let newIndex = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].time <= position) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex !== currentLineIndex) {
      setCurrentLineIndex(newIndex);
    }
  }, [position, syncedLines, isSynced, currentLineIndex]);

  // auto-scroll to center current line
  useEffect(() => {
    if (!isSynced || currentLineIndex < 0) return;

    const scrollToLine = (index: number) => {
      if (index < 3) {
        listRef.current?.scrollToIndex({
          index: 0,
          animated: true,
        });
      } else {
        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.3,
        });
      }
    };

    // If coming from transition, delay the first scroll to allow animation to finish
    // But don't block subsequent updates
    if (lyricsCardLayout && !initialScrollRef.current) {
      initialScrollRef.current = true;
      setTimeout(() => {
        scrollToLine(currentLineIndex);
      }, 400);
      return;
    }

    scrollToLine(currentLineIndex);
  }, [currentLineIndex, isSynced, lyricsCardLayout]);

  async function loadLyrics() {
    if (!currentTrack) return;
    setIsLoading(true);
    setError(null);
    setSyncedLines([]);
    setUnsyncedLines([]);
    setIsSynced(false);
    setCurrentLineIndex(-1);

    try {
      const local = await fetchLyrics(
        currentTrack.trackhash,
        currentTrack.filepath
      );
      if (
        local &&
        local.lyrics &&
        Array.isArray(local.lyrics) &&
        local.lyrics.length > 0
      ) {
        if (typeof local.lyrics[0] === "string") {
          setUnsyncedLines(local.lyrics as string[]);
          setIsSynced(false);
        } else {
          setSyncedLines(local.lyrics as SyncedLine[]);
          setIsSynced(true);
        }
        setIsLoading(false);
        return;
      }

      // try online search
      setIsLoading(false);
      await fetchOnlineLyrics();
    } catch {
      setIsLoading(false);
      await fetchOnlineLyrics();
    }
  }

  async function fetchOnlineLyrics() {
    if (!currentTrack) return;

    setIsFetching(true);
    setError(null);

    try {
      const primaryArtist =
        (currentTrack.artists && currentTrack.artists.length
          ? currentTrack.artists[0].name
          : currentTrack.albumartists && currentTrack.albumartists.length
          ? currentTrack.albumartists[0].name
          : "") || "";

      const online = await searchAndDownloadLyrics(
        currentTrack.trackhash,
        currentTrack.title,
        primaryArtist,
        currentTrack.album,
        currentTrack.filepath
      );

      if (online && online.lyrics) {
        if (Array.isArray(online.lyrics)) {
          const first = online.lyrics[0];
          if (typeof first === "string") {
            setUnsyncedLines(online.lyrics as unknown as string[]);
            setIsSynced(false);
          } else {
            setSyncedLines(online.lyrics as unknown as SyncedLine[]);
            setIsSynced(true);
          }
        } else if (typeof online.lyrics === "string") {
          setUnsyncedLines(online.lyrics.split(/\r?\n/));
          setIsSynced(false);
        }
        return;
      }

      setError("No lyrics found");
    } catch {
      setError("Failed to fetch lyrics online");
    } finally {
      setIsFetching(false);
    }
  }

  const handleLinePress = useCallback(
    (index: number) => {
      if (!isSynced || !syncedLines[index]) return;
      void seekTo(syncedLines[index].time);
    },
    [isSynced, syncedLines, seekTo]
  );

  // render item for synced lyrics flatlist
  const renderSyncedLine = useCallback(
    ({ item, index }: ListRenderItemInfo<SyncedLine>) => (
      <LyricLine
        line={item}
        index={index}
        currentIndex={currentLineIndex}
        onPress={() => handleLinePress(index)}
      />
    ),
    [currentLineIndex, handleLinePress]
  );

  // render item for unsynced lyrics
  const renderUnsyncedLine = useCallback(
    ({ item }: ListRenderItemInfo<string>) => <UnsyncedLine text={item} />,
    []
  );

  // key extractors
  const syncedKeyExtractor = useCallback(
    (item: SyncedLine, index: number) => `${index}-${item.time}`,
    []
  );
  const unsyncedKeyExtractor = useCallback(
    (item: string, index: number) => `${index}-${item}`,
    []
  );

  // handle scroll to index failures gracefully
  const onScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      const wait = new Promise((resolve) => setTimeout(resolve, 100));
      void wait.then(() => {
        listRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0.3,
        });
      });
    },
    []
  );

  if (!currentTrack) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.emptyState}>
          <Ionicons name="text" size={64} color="#424242" />
          <ThemedText style={styles.placeholder}>Nothing is playing</ThemedText>
        </View>
      </View>
    );
  }

  const thumbnailUrl = currentTrack.image
    ? getThumbnailUrl(currentTrack.image, "large")
    : null;
  const hasLyrics = syncedLines.length > 0 || unsyncedLines.length > 0;
  const artistNames =
    currentTrack.artists?.map((a) => a.name).join(", ") || "Unknown Artist";

  // calculate padding for centering
  const centerPadding = (SCREEN_HEIGHT - insets.top - insets.bottom) / 2 - 32;

  return (
    <View style={styles.outerContainer}>
      <Animated.View style={[styles.container, containerAnimatedStyle]}>
        {/* Inner wrapper with inverse scale for masking effect */}
        <Animated.View style={innerContentStyle}>
          {/* blurred background */}
          {thumbnailUrl && (
            <Animated.View
              style={[StyleSheet.absoluteFill, backgroundOpacityStyle]}
            >
              <ImageBackground
                source={{ uri: thumbnailUrl }}
                style={styles.backgroundImage}
                blurRadius={80}
              >
                <View style={styles.backgroundOverlay} />
              </ImageBackground>
            </Animated.View>
          )}

          {/* header - fades in as we expand */}
          <Animated.View
            style={[
              styles.header,
              { paddingTop: insets.top },
              contentOpacityStyle,
            ]}
          >
            <Pressable
              onPress={handleBack}
              style={styles.closeButton}
              hitSlop={12}
            >
              <Ionicons name="chevron-down" size={28} color="#ffffff" />
            </Pressable>
            <View style={styles.headerInfo}>
              <ThemedText style={styles.headerTitle} numberOfLines={1}>
                {currentTrack.title}
              </ThemedText>
              <ThemedText style={styles.headerArtist} numberOfLines={1}>
                {artistNames}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => void loadLyrics()}
              style={styles.reloadButton}
              hitSlop={12}
            >
              <Ionicons
                name="refresh"
                size={22}
                color="rgba(255,255,255,0.7)"
              />
            </Pressable>
          </Animated.View>

          {/* loading states */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
              <ThemedText style={styles.loadingText}>
                Loading lyrics...
              </ThemedText>
            </View>
          )}

          {isFetching && !isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
              <ThemedText style={styles.loadingText}>
                Searching for lyrics online...
              </ThemedText>
            </View>
          )}

          {/* error state */}
          {error && !isLoading && !isFetching && (
            <View style={styles.emptyState}>
              <Ionicons
                name="musical-note"
                size={64}
                color="rgba(255,255,255,0.3)"
              />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          {/* synced lyrics */}
          {!isLoading &&
            !isFetching &&
            !error &&
            isSynced &&
            syncedLines.length > 0 && (
              <FlatList
                ref={listRef}
                data={syncedLines}
                renderItem={renderSyncedLine}
                keyExtractor={syncedKeyExtractor}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingTop: 16,
                  paddingBottom: centerPadding + insets.bottom,
                  paddingHorizontal: 32,
                }}
                onScrollToIndexFailed={onScrollToIndexFailed}
                removeClippedSubviews={true}
                windowSize={5}
                initialNumToRender={15}
                maxToRenderPerBatch={10}
              />
            )}

          {/* unsynced lyrics */}
          {!isLoading &&
            !isFetching &&
            !error &&
            !isSynced &&
            unsyncedLines.length > 0 && (
              <FlatList
                data={unsyncedLines}
                renderItem={renderUnsyncedLine}
                keyExtractor={unsyncedKeyExtractor}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingTop: 24,
                  paddingBottom: insets.bottom + 24,
                  paddingHorizontal: 32,
                }}
                removeClippedSubviews={true}
                windowSize={5}
              />
            )}

          {/* no lyrics */}
          {!isLoading && !isFetching && !error && !hasLyrics && (
            <View style={styles.emptyState}>
              <Ionicons
                name="musical-note"
                size={64}
                color="rgba(255,255,255,0.3)"
              />
              <ThemedText style={styles.placeholder}>
                No lyrics available
              </ThemedText>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  container: {
    flex: 1,
    backgroundColor: Palette.background,
    overflow: "hidden",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },

  // header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  headerArtist: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  reloadButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  // loading and empty states
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  placeholder: {
    fontSize: 16,
    color: "rgba(255,255,255,0.4)",
  },
  errorText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },

  // line styles
  lineContainer: {
    justifyContent: "flex-start",
    paddingVertical: 8,
  },
  lyricLine: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 30,
    textAlign: "left",
    width: "100%",
    color: "rgba(255,255,255,0.3)",
  },
  lyricLineActive: {
    color: "#ffffff",
  },
  lyricLinePast: {
    color: "rgba(255,255,255,0.4)",
  },
  lyricLineUnsynced: {
    fontSize: 20,
    fontWeight: "500",
    lineHeight: 30,
    color: "rgba(255,255,255,0.8)",
    textAlign: "left",
  },
});
