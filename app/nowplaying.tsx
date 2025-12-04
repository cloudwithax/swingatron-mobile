import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  LayoutChangeEvent,
  LayoutRectangle,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  Swipeable,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/themed-text";
import { usePlayerStore } from "@/src/stores";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import {
  fetchLyrics,
  getThumbnailUrl,
  searchAndDownloadLyrics,
} from "@/src/api/client";
import { Palette, Radii, Shadows } from "@/constants/theme";
import type { Track } from "@/src/api/types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ARTWORK_SIZE = SCREEN_WIDTH - 64;

// swipe to dismiss thresholds
const DISMISS_THRESHOLD = 120;
const DISMISS_VELOCITY = 500;

// lyrics card dimensions
const LYRICS_CARD_HEIGHT = 300;

interface SyncedLine {
  time: number;
  text: string;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// lyric line component for the embedded card
interface LyricLineProps {
  line: SyncedLine;
  index: number;
  currentIndex: number;
  onPress: () => void;
  onLayout?: (index: number, layout: LayoutRectangle) => void;
}

const LyricLine = memo(
  function LyricLine({
    line,
    index,
    currentIndex,
    onPress,
    onLayout,
  }: LyricLineProps) {
    const isActive = index === currentIndex;
    const isPast = index < currentIndex;
    const handleLayout = useCallback(
      (event: LayoutChangeEvent) => {
        onLayout?.(index, event.nativeEvent.layout);
      },
      [index, onLayout]
    );

    return (
      <Pressable onPress={onPress} onLayout={handleLayout}>
        <View style={lyricsStyles.lineContainer}>
          <ThemedText
            style={[
              lyricsStyles.lyricLine,
              isActive && lyricsStyles.lyricLineActive,
              isPast && lyricsStyles.lyricLinePast,
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

// queue item component for inline queue view
interface QueueItemProps {
  track: Track;
  index: number;
  isCurrent: boolean;
  onPress: () => void;
  onRemove: () => void;
}

function QueueItem({
  track,
  index,
  isCurrent,
  onPress,
  onRemove,
}: QueueItemProps) {
  const thumbnailUrl = track.image
    ? getThumbnailUrl(track.image, "small")
    : null;
  const artistNames =
    track.artists?.map((a) => a.name).join(", ") || "Unknown Artist";

  const rightActions = () => (
    <View style={queueStyles.swipeActions}>
      <View style={queueStyles.swipeRemove}>
        <Ionicons name="trash" size={18} color="#ffffff" />
      </View>
    </View>
  );

  const content = (
    <View style={[queueStyles.item, isCurrent && queueStyles.itemCurrent]}>
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={queueStyles.itemArt} />
      ) : (
        <View style={[queueStyles.itemArt, queueStyles.itemArtPlaceholder]}>
          <Ionicons
            name="musical-note"
            size={16}
            color="rgba(255,255,255,0.4)"
          />
        </View>
      )}
      <View style={queueStyles.itemInfo}>
        <ThemedText
          style={[
            queueStyles.itemTitle,
            isCurrent && queueStyles.itemTitleCurrent,
          ]}
          numberOfLines={1}
        >
          {track.title}
        </ThemedText>
        <ThemedText style={queueStyles.itemArtist} numberOfLines={1}>
          {artistNames}
        </ThemedText>
      </View>
      <ThemedText style={queueStyles.itemDuration}>
        {formatDuration(track.duration)}
      </ThemedText>
    </View>
  );

  if (isCurrent) {
    return content;
  }

  return (
    <Swipeable
      renderRightActions={rightActions}
      onSwipeableOpen={onRemove}
      overshootRight={false}
    >
      <Pressable onPress={onPress}>{content}</Pressable>
    </Swipeable>
  );
}

export default function NowPlayingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // queue view toggle state with transition animation
  const [showQueue, setShowQueue] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // transition animation value (0 = artwork view, 1 = queue view)
  const viewTransition = useSharedValue(0);

  // animated styles for crossfade transition
  const artworkViewStyle = useAnimatedStyle(() => ({
    opacity: 1 - viewTransition.value,
    transform: [{ translateY: viewTransition.value * -15 }],
  }));

  const queueViewStyle = useAnimatedStyle(() => ({
    opacity: viewTransition.value,
    transform: [{ translateY: (1 - viewTransition.value) * 15 }],
  }));

  // get real-time playback progress directly from expo-av
  const { position, duration, isPlaying } = usePlaybackProgress();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const albumImage = usePlayerStore((s) => s.albumImage);
  const imageCacheBuster = usePlayerStore((s) => s.imageCacheBuster);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const shuffleMode = usePlayerStore((s) => s.shuffleMode);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const skipTo = usePlayerStore((s) => s.skipTo);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);

  // lyrics state
  const [syncedLines, setSyncedLines] = useState<SyncedLine[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const lyricsCardScrollRef = useRef<ScrollView>(null);
  const lyricLinePositions = useRef<number[]>([]);

  // lyrics card transition animation
  const lyricsOpacity = useSharedValue(1);
  const lyricsTranslateY = useSharedValue(0);
  const previousTrackHash = useRef<string | null>(null);

  const lyricsCardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: lyricsOpacity.value,
    transform: [{ translateY: lyricsTranslateY.value }],
  }));

  // shared values for gesture-based seeking
  const isSeekingShared = useSharedValue(false);
  const progressBarWidthRef = useRef(0);

  // animated style for content fade (kept for consistency but always fully visible)
  const contentFadeStyle = useAnimatedStyle(() => {
    return {
      opacity: 1,
      transform: [{ translateY: 0 }],
    };
  });

  // animated style for background (kept for consistency but always fully visible)
  const backgroundExpandStyle = useAnimatedStyle(() => {
    return { opacity: 1 };
  });

  // swipe to dismiss sheet
  const sheetTranslateY = useSharedValue(0);
  const sheetContext = useSharedValue(0);

  // animated style for the entire sheet
  const sheetAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      sheetTranslateY.value,
      [0, SCREEN_HEIGHT],
      [1, 0.9],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      sheetTranslateY.value,
      [0, SCREEN_HEIGHT * 0.5],
      [1, 0.5],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY: sheetTranslateY.value }, { scale }],
      opacity,
    };
  });

  // background overlay animated style
  const overlayAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      sheetTranslateY.value,
      [0, SCREEN_HEIGHT * 0.5],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  function dismissSheet() {
    router.back();
  }

  // pan gesture for swipe to dismiss
  const sheetPanGesture = Gesture.Pan()
    .onStart(() => {
      sheetContext.value = sheetTranslateY.value;
    })
    .onUpdate((event) => {
      // only allow downward swipes (positive translationY)
      sheetTranslateY.value = Math.max(
        0,
        sheetContext.value + event.translationY
      );
    })
    .onEnd((event) => {
      // dismiss if dragged far enough or velocity is high enough
      if (
        sheetTranslateY.value > DISMISS_THRESHOLD ||
        event.velocityY > DISMISS_VELOCITY
      ) {
        sheetTranslateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 200, easing: Easing.out(Easing.cubic) },
          () => {
            runOnJS(dismissSheet)();
          }
        );
      } else {
        // snap back to original position
        sheetTranslateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
        });
      }
    })
    .activeOffsetY([10, 10])
    .failOffsetX([-20, 20]);

  // artwork push animation state - spotify style with two layers
  const [previousArtworkUrl, setPreviousArtworkUrl] = useState<string | null>(
    null
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const currentArtworkTranslateX = useSharedValue(0);
  const previousArtworkTranslateX = useSharedValue(0);
  const currentArtworkOpacity = useSharedValue(1);
  const previousArtworkOpacity = useSharedValue(0);

  // animated styles for both artwork layers
  const currentArtworkStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: currentArtworkTranslateX.value }],
    opacity: currentArtworkOpacity.value,
  }));

  const previousArtworkStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: previousArtworkTranslateX.value }],
    opacity: previousArtworkOpacity.value,
  }));

  // trigger spotify-style push animation
  // direction: "left" = next track (current slides left, new comes from right)
  // direction: "right" = previous track (current slides right, new comes from left)
  function triggerArtworkPush(direction: "left" | "right") {
    const slideDistance = ARTWORK_SIZE + 32; // full artwork width plus gap
    const exitDirection = direction === "left" ? -slideDistance : slideDistance;
    const enterDirection =
      direction === "left" ? slideDistance : -slideDistance;

    // capture current artwork as the outgoing one with cache buster
    const currentImage = albumImage || currentTrack?.image;
    const currentUrl = currentImage
      ? (() => {
          const baseUrl = getThumbnailUrl(currentImage, "large");
          return `${baseUrl}${
            baseUrl.includes("?") ? "&" : "?"
          }cb=${imageCacheBuster}`;
        })()
      : null;
    setPreviousArtworkUrl(currentUrl);
    setIsAnimating(true);

    // set up initial positions
    previousArtworkTranslateX.value = 0;
    previousArtworkOpacity.value = 1;
    currentArtworkTranslateX.value = enterDirection;
    currentArtworkOpacity.value = 1;

    // animate outgoing artwork off screen
    previousArtworkTranslateX.value = withTiming(exitDirection, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
    previousArtworkOpacity.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    // animate incoming artwork into position
    currentArtworkTranslateX.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    // clean up after animation
    setTimeout(() => {
      setIsAnimating(false);
      setPreviousArtworkUrl(null);
    }, 320);
  }

  // load lyrics when track changes
  useEffect(() => {
    if (!currentTrack) return;

    // check if this is a track change (not initial load)
    const isTrackChange =
      previousTrackHash.current !== null &&
      previousTrackHash.current !== currentTrack.trackhash;

    if (isTrackChange) {
      // fade out current lyrics first
      lyricsOpacity.value = withTiming(0, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });
      lyricsTranslateY.value = withTiming(-8, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });

      // load new lyrics after fade out
      setTimeout(() => {
        void loadLyrics().then(() => {
          // fade in new lyrics
          lyricsTranslateY.value = 8;
          lyricsOpacity.value = withTiming(1, {
            duration: 200,
            easing: Easing.out(Easing.cubic),
          });
          lyricsTranslateY.value = withTiming(0, {
            duration: 200,
            easing: Easing.out(Easing.cubic),
          });
        });
      }, 150);
    } else {
      // initial load - just load normally
      void loadLyrics();
    }

    previousTrackHash.current = currentTrack.trackhash;
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

  // callback to store line positions when they're measured
  const handleLineLayout = useCallback(
    (index: number, layout: LayoutRectangle) => {
      lyricLinePositions.current[index] = layout.y + layout.height / 2;
    },
    []
  );

  useEffect(() => {
    lyricLinePositions.current = [];
  }, [syncedLines]);

  // auto-scroll lyrics card to center current line
  useEffect(() => {
    if (!isSynced || currentLineIndex < 0 || !lyricsCardScrollRef.current)
      return;

    // use measured position if available, otherwise estimate
    const lineCenter = lyricLinePositions.current[currentLineIndex];
    if (lineCenter === undefined) return;

    const scrollY = Math.max(0, lineCenter - LYRICS_CARD_HEIGHT / 2);
    lyricsCardScrollRef.current.scrollTo({
      y: scrollY,
      animated: true,
    });
  }, [currentLineIndex, isSynced]);

  async function loadLyrics() {
    if (!currentTrack) return;
    setLyricsLoading(true);
    setSyncedLines([]);
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
        if (typeof local.lyrics[0] !== "string") {
          setSyncedLines(local.lyrics as SyncedLine[]);
          setIsSynced(true);
          setLyricsLoading(false);
          return;
        }
      }

      // try online search for synced lyrics
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

      if (online && online.lyrics && Array.isArray(online.lyrics)) {
        const first = online.lyrics[0];
        if (typeof first !== "string") {
          setSyncedLines(online.lyrics as unknown as SyncedLine[]);
          setIsSynced(true);
        }
      }
    } catch {
      // silently fail - no lyrics available
    } finally {
      setLyricsLoading(false);
    }
  }

  const handleLyricLinePress = useCallback(
    (index: number) => {
      if (!isSynced || !syncedLines[index]) return;
      void seekTo(syncedLines[index].time);
    },
    [isSynced, syncedLines, seekTo]
  );

  function toggleQueueView() {
    const animConfig = {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    };

    // start transitioning - both views will render
    setIsTransitioning(true);

    if (showQueue) {
      // transitioning from queue to artwork view
      viewTransition.value = withTiming(0, animConfig, () => {
        runOnJS(setShowQueue)(false);
        runOnJS(setIsTransitioning)(false);
      });
    } else {
      // transitioning from artwork to queue view
      setShowQueue(true);
      viewTransition.value = withTiming(1, animConfig, () => {
        runOnJS(setIsTransitioning)(false);
      });
    }
  }

  // js callbacks for gesture handlers
  function startSeeking(x: number) {
    if (progressBarWidthRef.current <= 0 || duration <= 0) return;
    const percent = Math.max(0, Math.min(1, x / progressBarWidthRef.current));
    setIsSeeking(true);
    setSeekPosition(percent * duration);
  }

  function updateSeeking(x: number) {
    if (progressBarWidthRef.current <= 0 || duration <= 0) return;
    const percent = Math.max(0, Math.min(1, x / progressBarWidthRef.current));
    setSeekPosition(percent * duration);
  }

  function finishSeeking() {
    if (isSeeking) {
      void seekTo(seekPosition);
      setIsSeeking(false);
    }
  }

  // gesture handler for progress bar - uses native gesture system to avoid event bubbling
  const progressGesture = Gesture.Pan()
    .onStart((event) => {
      isSeekingShared.value = true;
      runOnJS(startSeeking)(event.x);
    })
    .onUpdate((event) => {
      runOnJS(updateSeeking)(event.x);
    })
    .onEnd(() => {
      isSeekingShared.value = false;
      runOnJS(finishSeeking)();
    })
    .onFinalize(() => {
      // ensure we always clean up even if gesture is cancelled
      if (isSeekingShared.value) {
        isSeekingShared.value = false;
        runOnJS(finishSeeking)();
      }
    })
    .hitSlop({ top: 12, bottom: 12 })
    .activeOffsetX([-5, 5])
    .failOffsetY([-20, 20]);

  if (!currentTrack) {
    return (
      <GestureDetector gesture={sheetPanGesture}>
        <Animated.View
          style={[
            styles.container,
            { paddingTop: insets.top + 16 },
            sheetAnimatedStyle,
          ]}
        >
          <View style={styles.dismissHandle} />
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes" size={64} color="#424242" />
            <ThemedText style={styles.placeholder}>
              Nothing is playing
            </ThemedText>
          </View>
        </Animated.View>
      </GestureDetector>
    );
  }

  const progress = duration > 0 ? position / duration : 0;
  const displayProgress = isSeeking ? seekPosition / duration : progress;
  const displayPosition = isSeeking ? seekPosition : position;

  // use albumImage from store with cache buster to prevent blurry cached images
  const imageToUse = albumImage || currentTrack.image;
  const thumbnailUrl = imageToUse
    ? (() => {
        const baseUrl = getThumbnailUrl(imageToUse, "large");
        return `${baseUrl}${
          baseUrl.includes("?") ? "&" : "?"
        }cb=${imageCacheBuster}`;
      })()
    : null;
  const artistNames =
    currentTrack.artists && currentTrack.artists.length > 0
      ? currentTrack.artists.map((a) => a.name).join(", ")
      : "Unknown Artist";

  async function handlePlayPause() {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }

  function handleProgressBarLayout(event: LayoutChangeEvent) {
    progressBarWidthRef.current = event.nativeEvent.layout.width;
  }

  function goToAlbum() {
    if (currentTrack && currentTrack.albumhash) {
      router.push(`/album/${currentTrack.albumhash}`);
    }
  }

  function goToArtist() {
    if (
      currentTrack &&
      currentTrack.artists &&
      currentTrack.artists.length > 0
    ) {
      router.push(`/artist/${currentTrack.artists[0].artisthash}`);
    }
  }

  // check if next will actually change tracks
  function willNextChangeTrack(): boolean {
    if (queue.length === 0) return false;
    if (repeatMode === "one") return false;
    const isAtEnd = currentIndex >= queue.length - 1;
    if (isAtEnd && repeatMode !== "all") return false;
    return true;
  }

  // check if previous will actually change tracks (not just seek to start)
  function willPreviousChangeTrack(): boolean {
    if (queue.length === 0) return false;
    // if position > 3s, previous just seeks to start
    if (position > 3000) return false;
    const isAtStart = currentIndex === 0;
    if (isAtStart && repeatMode !== "all") return false;
    return true;
  }

  async function handleNext() {
    if (willNextChangeTrack()) {
      triggerArtworkPush("left");
    } else {
      // at end of queue, if we go forward, just seek to beginning
      await seekTo(0);
    }
    await next();
  }

  async function handlePrevious() {
    if (willPreviousChangeTrack()) {
      triggerArtworkPush("right");
      await previous();
    } else {
      // at start of queue or position > 3, if we go back, just seek to beginning
      await seekTo(0);
    }
  }

  const repeatIcon =
    repeatMode === "one"
      ? "repeat-outline"
      : repeatMode === "all"
      ? "repeat"
      : "repeat-outline";

  // queue data - upcoming tracks only (current + next)
  const upcomingQueue = queue.slice(currentIndex);

  return (
    <GestureDetector gesture={sheetPanGesture}>
      <Animated.View style={[styles.container, sheetAnimatedStyle]}>
        {/* blurred background */}
        {thumbnailUrl && (
          <Animated.View
            style={[
              styles.backgroundWrapper,
              overlayAnimatedStyle,
              backgroundExpandStyle,
            ]}
          >
            <ImageBackground
              source={{ uri: thumbnailUrl }}
              style={styles.backgroundImage}
              blurRadius={50}
            >
              <View style={styles.backgroundOverlay} />
            </ImageBackground>
          </Animated.View>
        )}

        <View style={[styles.content, { paddingTop: insets.top + 8 }]}>
          {/* dismiss handle indicator */}
          <View style={styles.dismissHandle} />

          {/* header with back button - stays fixed */}
          <Animated.View style={[styles.header, contentFadeStyle]}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={12}
            >
              <Ionicons name="chevron-down" size={28} color="#ffffff" />
            </Pressable>
            <ThemedText style={styles.headerTitle} numberOfLines={1}>
              {showQueue ? "Up Next" : "Now Playing"}
            </ThemedText>
            <Pressable
              onPress={toggleQueueView}
              style={[
                styles.queueButton,
                showQueue && styles.queueButtonActive,
              ]}
              hitSlop={12}
            >
              <Ionicons name="list" size={24} color="#ffffff" />
            </Pressable>
          </Animated.View>

          {/* scrollable content area */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={true}
          >
            {/* artwork view - wrapped in animated view for transition */}
            <Animated.View style={[{ width: "100%" }, artworkViewStyle]}>
              {(!showQueue || isTransitioning) && (
                <>
                  <View style={styles.artworkContainer}>
                    <Pressable onPress={goToAlbum}>
                      <Animated.View style={styles.artworkWrapper}>
                        {/* previous artwork layer - slides out during transition */}
                        {isAnimating && previousArtworkUrl && (
                          <Animated.View
                            style={[styles.artworkLayer, previousArtworkStyle]}
                          >
                            <Image
                              source={{ uri: previousArtworkUrl }}
                              style={styles.artwork}
                            />
                          </Animated.View>
                        )}
                        {isAnimating && !previousArtworkUrl && (
                          <Animated.View
                            style={[styles.artworkLayer, previousArtworkStyle]}
                          >
                            <View
                              style={[
                                styles.artwork,
                                styles.artworkPlaceholder,
                              ]}
                            >
                              <Ionicons
                                name="musical-note"
                                size={80}
                                color="#424242"
                              />
                            </View>
                          </Animated.View>
                        )}

                        {/* current artwork layer - slides in during transition */}
                        <Animated.View
                          style={[styles.artworkLayer, currentArtworkStyle]}
                        >
                          {thumbnailUrl ? (
                            <Image
                              source={{ uri: thumbnailUrl }}
                              style={styles.artwork}
                            />
                          ) : (
                            <View
                              style={[
                                styles.artwork,
                                styles.artworkPlaceholder,
                              ]}
                            >
                              <Ionicons
                                name="musical-note"
                                size={80}
                                color="#424242"
                              />
                            </View>
                          )}
                        </Animated.View>
                      </Animated.View>
                    </Pressable>
                  </View>

                  {/* track info */}
                  <Animated.View style={[styles.trackInfo, contentFadeStyle]}>
                    <Pressable onPress={goToAlbum}>
                      <ThemedText style={styles.trackTitle} numberOfLines={2}>
                        {currentTrack.title}
                      </ThemedText>
                    </Pressable>
                    <Pressable onPress={goToArtist}>
                      <ThemedText style={styles.trackArtist} numberOfLines={1}>
                        {artistNames}
                      </ThemedText>
                    </Pressable>
                  </Animated.View>

                  {/* progress bar and controls */}
                  <Animated.View
                    style={[styles.progressContainer, contentFadeStyle]}
                  >
                    <GestureDetector gesture={progressGesture}>
                      <Animated.View
                        style={styles.progressBarTouchArea}
                        onLayout={handleProgressBarLayout}
                      >
                        <View style={styles.progressBarBackground}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${displayProgress * 100}%` },
                            ]}
                          />
                        </View>
                        <View
                          style={[
                            styles.progressBarThumb,
                            { left: `${displayProgress * 100}%` },
                          ]}
                        />
                      </Animated.View>
                    </GestureDetector>
                    <View style={styles.progressLabels}>
                      <ThemedText style={styles.progressLabel}>
                        {formatTime(displayPosition)}
                      </ThemedText>
                      <ThemedText style={styles.progressLabel}>
                        {formatTime(duration)}
                      </ThemedText>
                    </View>
                  </Animated.View>

                  <Animated.View style={[styles.controlsRow, contentFadeStyle]}>
                    <Pressable
                      onPress={toggleShuffle}
                      style={styles.secondaryButton}
                      hitSlop={12}
                    >
                      <Ionicons
                        name="shuffle"
                        size={24}
                        color={
                          shuffleMode ? "#ffffff" : "rgba(255,255,255,0.5)"
                        }
                      />
                    </Pressable>

                    <Pressable
                      onPress={() => void handlePrevious()}
                      style={styles.controlButton}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="play-skip-back"
                        size={32}
                        color="#ffffff"
                      />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        void handlePlayPause();
                      }}
                      style={styles.playButton}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="large" color="#111111" />
                      ) : isPlaying ? (
                        <Ionicons name="pause" size={40} color="#111111" />
                      ) : (
                        <Ionicons name="play" size={40} color="#111111" />
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => void handleNext()}
                      style={styles.controlButton}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="play-skip-forward"
                        size={32}
                        color="#ffffff"
                      />
                    </Pressable>

                    <Pressable
                      onPress={cycleRepeatMode}
                      style={styles.secondaryButton}
                      hitSlop={12}
                    >
                      <View>
                        <Ionicons
                          name={repeatIcon}
                          size={24}
                          color={
                            repeatMode !== "off"
                              ? "#ffffff"
                              : "rgba(255,255,255,0.5)"
                          }
                        />
                        {repeatMode === "one" && (
                          <View style={styles.repeatOneDot} />
                        )}
                      </View>
                    </Pressable>
                  </Animated.View>

                  {/* lyrics card - only show when we have synced lyrics */}
                  {isSynced && syncedLines.length > 0 && (
                    <Animated.View style={lyricsCardAnimatedStyle}>
                      <View style={lyricsStyles.cardWrapper}>
                        <View style={lyricsStyles.cardHeader}>
                          <ThemedText style={lyricsStyles.cardHeaderTitle}>
                            Lyrics
                          </ThemedText>
                          <Pressable
                            onPress={() => router.push("/lyrics")}
                            style={lyricsStyles.expandButton}
                            hitSlop={12}
                          >
                            <Ionicons name="expand" size={20} color="#ffffff" />
                          </Pressable>
                        </View>

                        <View style={lyricsStyles.card}>
                          <BlurView
                            intensity={30}
                            tint="dark"
                            style={StyleSheet.absoluteFill}
                          />
                          <View style={lyricsStyles.cardOverlay} />

                          <ScrollView
                            ref={lyricsCardScrollRef}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={lyricsStyles.lyricsContainer}
                            nestedScrollEnabled={true}
                          >
                            {syncedLines.map((line, index) => (
                              <LyricLine
                                key={`${index}-${line.time}`}
                                line={line}
                                index={index}
                                currentIndex={currentLineIndex}
                                onPress={() => handleLyricLinePress(index)}
                                onLayout={handleLineLayout}
                              />
                            ))}
                          </ScrollView>
                        </View>
                      </View>
                    </Animated.View>
                  )}

                  {/* no lyrics placeholder - show when no synced lyrics */}
                  {!lyricsLoading &&
                    (!isSynced || syncedLines.length === 0) && (
                      <Animated.View style={lyricsCardAnimatedStyle}>
                        <Pressable
                          onPress={() => router.push("/lyrics")}
                          style={lyricsStyles.noLyricsCard}
                        >
                          <Ionicons
                            name="text"
                            size={20}
                            color="rgba(255,255,255,0.4)"
                          />
                          <ThemedText style={lyricsStyles.noLyricsText}>
                            View lyrics
                          </ThemedText>
                        </Pressable>
                      </Animated.View>
                    )}
                </>
              )}
            </Animated.View>

            {/* queue view - wrapped in animated view for transition */}
            <Animated.View style={[{ width: "100%" }, queueViewStyle]}>
              {(showQueue || isTransitioning) && (
                <View style={styles.queueContainer}>
                  <View style={queueStyles.list}>
                    {upcomingQueue.length > 0 ? (
                      upcomingQueue.map((item, index) => (
                        <QueueItem
                          key={`${item.trackhash}-${currentIndex + index}`}
                          track={item}
                          index={currentIndex + index}
                          isCurrent={index === 0}
                          onPress={() => {
                            if (index > 0) {
                              void skipTo(currentIndex + index);
                            }
                          }}
                          onRemove={() => {
                            if (index > 0) {
                              removeFromQueue(currentIndex + index);
                            }
                          }}
                        />
                      ))
                    ) : (
                      <View style={queueStyles.empty}>
                        <ThemedText style={queueStyles.emptyText}>
                          Queue is empty
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </Animated.View>
          </ScrollView>

          {/* sticky controls for queue view */}
          {(showQueue || isTransitioning) && (
            <Animated.View style={[queueViewStyle]}>
              <View
                style={[
                  styles.stickyControls,
                  { paddingBottom: insets.bottom + 16 },
                ]}
              >
                {/* progress bar */}
                <View style={styles.progressContainer}>
                  <GestureDetector gesture={progressGesture}>
                    <Animated.View
                      style={styles.progressBarTouchArea}
                      onLayout={handleProgressBarLayout}
                    >
                      <View style={styles.progressBarBackground}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${displayProgress * 100}%` },
                          ]}
                        />
                      </View>
                      <View
                        style={[
                          styles.progressBarThumb,
                          { left: `${displayProgress * 100}%` },
                        ]}
                      />
                    </Animated.View>
                  </GestureDetector>
                  <View style={styles.progressLabels}>
                    <ThemedText style={styles.progressLabel}>
                      {formatTime(displayPosition)}
                    </ThemedText>
                    <ThemedText style={styles.progressLabel}>
                      {formatTime(duration)}
                    </ThemedText>
                  </View>
                </View>

                {/* main controls */}
                <View style={styles.controlsRow}>
                  <Pressable
                    onPress={toggleShuffle}
                    style={styles.secondaryButton}
                    hitSlop={12}
                  >
                    <Ionicons
                      name="shuffle"
                      size={24}
                      color={shuffleMode ? "#ffffff" : "rgba(255,255,255,0.5)"}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => void handlePrevious()}
                    style={styles.controlButton}
                    hitSlop={8}
                  >
                    <Ionicons name="play-skip-back" size={32} color="#ffffff" />
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      void handlePlayPause();
                    }}
                    style={styles.playButton}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="large" color="#111111" />
                    ) : isPlaying ? (
                      <Ionicons name="pause" size={40} color="#111111" />
                    ) : (
                      <Ionicons name="play" size={40} color="#111111" />
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => void handleNext()}
                    style={styles.controlButton}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="play-skip-forward"
                      size={32}
                      color="#ffffff"
                    />
                  </Pressable>

                  <Pressable
                    onPress={cycleRepeatMode}
                    style={styles.secondaryButton}
                    hitSlop={12}
                  >
                    <View>
                      <Ionicons
                        name={repeatIcon}
                        size={24}
                        color={
                          repeatMode !== "off"
                            ? "#ffffff"
                            : "rgba(255,255,255,0.5)"
                        }
                      />
                      {repeatMode === "one" && (
                        <View style={styles.repeatOneDot} />
                      )}
                    </View>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// queue-specific styles
const queueStyles = StyleSheet.create({
  list: {
    paddingVertical: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 0,
    gap: 12,
    backgroundColor: "transparent",
    borderRadius: 10,
  },
  itemCurrent: {
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: 4,
  },
  itemArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  itemArtPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255,255,255,0.9)",
  },
  itemTitleCurrent: {
    color: "#ffffff",
    fontWeight: "600",
  },
  itemArtist: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  itemDuration: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    fontVariant: ["tabular-nums"],
    marginLeft: 8,
  },
  swipeActions: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.caution,
    borderRadius: 10,
    marginRight: 0,
  },
  swipeRemove: {
    width: 70,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
});

// lyrics card styles
const lyricsStyles = StyleSheet.create({
  cardWrapper: {
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  expandButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  card: {
    height: LYRICS_CARD_HEIGHT,
    borderRadius: Radii.lg,
    overflow: "hidden",
    backgroundColor: "rgba(25,25,25,0.8)",
    ...Shadows.md,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  lyricsContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  lineContainer: {
    paddingVertical: 8,
  },
  lyricLine: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 28,
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
  noLyricsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Radii.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignSelf: "center",
  },
  noLyricsText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  backgroundWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  dismissHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
    alignSelf: "center",
    marginBottom: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  stickyControls: {
    paddingTop: 16,
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  queueButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  queueButtonActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  artworkContainer: {
    alignItems: "center",
    marginBottom: 32,
    overflow: "hidden",
  },
  artworkWrapper: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    position: "relative",
  },
  artworkLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 12,
    backgroundColor: "#1e1e1e",
  },
  artworkPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  queueContainer: {
    flex: 1,
    marginBottom: 16,
  },
  trackInfo: {
    alignItems: "center",
    marginBottom: 24,
    gap: 6,
  },
  trackTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  trackArtist: {
    fontSize: 18,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
  trackAlbum: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBarTouchArea: {
    height: 24,
    justifyContent: "center",
    marginHorizontal: 7,
    overflow: "visible",
  },
  progressBarBackground: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "visible",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 2,
  },
  progressBarThumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ffffff",
    marginLeft: -7,
    top: 5,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    fontVariant: ["tabular-nums"],
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 16,
  },
  secondaryButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  controlButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  repeatOneDot: {
    position: "absolute",
    bottom: -4,
    left: "50%",
    marginLeft: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  placeholder: {
    fontSize: 16,
    color: "#757575",
  },
});
