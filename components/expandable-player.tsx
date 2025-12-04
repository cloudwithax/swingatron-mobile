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
  withSpring,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
  useDerivedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/themed-text";
import { usePlayerStore, useNowPlayingTransitionStore } from "@/src/stores";
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

// mini player dimensions
const MINI_PLAYER_HEIGHT = 64;
const MINI_ARTWORK_SIZE = 44;

// spring config for smooth morphing
const SPRING_CONFIG = {
  damping: 28,
  stiffness: 280,
  mass: 1,
};

// swipe thresholds
const DISMISS_THRESHOLD = 150;
const DISMISS_VELOCITY = 800;

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

// lyric line component
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

// queue item component
interface QueueItemProps {
  track: Track;
  index: number;
  isCurrent: boolean;
  onPress: () => void;
  onRemove: () => void;
}

function QueueItem({ track, isCurrent, onPress, onRemove }: QueueItemProps) {
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

// animated wrapper for queue items with cascading effect
interface AnimatedQueueItemProps extends QueueItemProps {
  queueIndex: number; // position in the visible queue (0, 1, 2...)
  viewTransition: { value: number };
}

function AnimatedQueueItem({
  queueIndex,
  viewTransition,
  ...queueItemProps
}: AnimatedQueueItemProps) {
  // stagger delay based on position (max 10 items for animation)
  const staggerDelay = Math.min(queueIndex, 10) * 0.06;

  const animatedStyle = useAnimatedStyle(() => {
    // each item animates based on viewTransition, with a staggered start
    const adjustedProgress = interpolate(
      viewTransition.value,
      [staggerDelay, staggerDelay + 0.4],
      [0, 1],
      Extrapolation.CLAMP
    );

    const opacity = adjustedProgress;
    const translateY = interpolate(
      adjustedProgress,
      [0, 1],
      [20, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <QueueItem {...queueItemProps} />
    </Animated.View>
  );
}

interface ExpandablePlayerProps {
  miniPlayerBottomOffset: number; // distance from bottom of screen to mini player bottom
}

export function ExpandablePlayer({
  miniPlayerBottomOffset,
}: ExpandablePlayerProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isExpanded = useNowPlayingTransitionStore((s) => s.isExpanded);
  const collapse = useNowPlayingTransitionStore((s) => s.collapse);

  // queue view toggle
  const [showQueue, setShowQueue] = useState(false);
  const [isQueueTransitioning, setIsQueueTransitioning] = useState(false);
  const viewTransition = useSharedValue(0);

  // animated styles for queue crossfade
  const artworkViewStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      viewTransition.value,
      [0, 0.4],
      [1, 0],
      Extrapolation.CLAMP
    ),
    transform: [{ translateY: viewTransition.value * -20 }],
    maxHeight: interpolate(
      viewTransition.value,
      [0, 0.3, 0.8, 1],
      [10000, 10000, 500, 0],
      Extrapolation.CLAMP
    ),
    overflow: "hidden",
  }));

  const queueViewStyle = useAnimatedStyle(() => {
    // slide up smoothly to overlap the artwork space
    const slideUp = interpolate(
      viewTransition.value,
      [0, 1],
      [0, -(ARTWORK_SIZE + 32)],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      viewTransition.value,
      [0.2, 0.6],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY: slideUp }],
    };
  });

  // playback state
  const { position, duration, isPlaying } = usePlaybackProgress();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const pendingTrack = usePlayerStore((s) => s.pendingTrack);
  // use pending track for immediate metadata display when available
  const displayTrack = pendingTrack || currentTrack;
  const albumImage = usePlayerStore((s) => s.albumImage);
  const imageCacheBuster = usePlayerStore((s) => s.imageCacheBuster);

  // two-layer image system to prevent blinking during image changes
  // displayedUrl is what we actually show, pendingUrl is what we're loading
  // use store's cache buster to match what was prefetched
  const displayedUrlRef = useRef<string | null>(null);
  const [displayedUrl, setDisplayedUrl] = useState<string | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // handle both initial load and subsequent changes
  useEffect(() => {
    if (!albumImage) {
      setDisplayedUrl(null);
      setPendingUrl(null);
      displayedUrlRef.current = null;
      return;
    }
    // use the store's cache buster to match the prefetched URL
    const baseUrl = getThumbnailUrl(albumImage, "large");
    const newUrl = `${baseUrl}${
      baseUrl.includes("?") ? "&" : "?"
    }cb=${imageCacheBuster}`;

    // always set as pending - let the preloader handle the swap
    setPendingUrl(newUrl);
  }, [albumImage, imageCacheBuster]);

  // callback when pending image finishes loading - swap to the new image
  const handlePendingImageLoad = useCallback(() => {
    setPendingUrl((current) => {
      if (current) {
        displayedUrlRef.current = current;
        setDisplayedUrl(current);
      }
      return null;
    });
  }, []);

  // use displayedUrl for rendering
  const thumbnailUrl = displayedUrl;

  const isLoading = usePlayerStore((s) => s.isLoading);
  const pendingTrackHash = usePlayerStore((s) => s.pendingTrackHash);
  // controls should be disabled when loading a track (either isLoading or pendingTrackHash)
  const isControlsDisabled = isLoading || !!pendingTrackHash;
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
  const lyricsCardRef = useRef<View>(null);
  const mainScrollRef = useRef<any>(null);
  const lyricLinePositions = useRef<number[]>([]);
  const currentScrollY = useRef(0);
  // lyrics animation
  const lyricsOpacity = useSharedValue(1);
  const lyricsTranslateY = useSharedValue(0);
  const previousTrackHash = useRef<string | null>(null);

  const lyricsCardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: lyricsOpacity.value,
    transform: [{ translateY: lyricsTranslateY.value }],
  }));

  // shared values for seeking gesture
  const isSeekingShared = useSharedValue(false);
  const progressBarWidthRef = useRef(0);

  // main expansion animation value (0 = mini, 1 = full)
  const expansion = useSharedValue(0);

  // drag offset for swipe to dismiss
  const dragOffset = useSharedValue(0);

  // scroll offset for artwork parallax when expanded
  const scrollOffset = useSharedValue(0);

  // scroll handler to track scroll position
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollOffset.value = event.contentOffset.y;
      runOnJS(updateScrollY)(event.contentOffset.y);
    },
  });

  // keep track of scroll position for artwork gesture
  function updateScrollY(y: number) {
    currentScrollY.current = y;
  }

  // derived value combining expansion and drag
  const effectiveExpansion = useDerivedValue(() => {
    const dragFactor = interpolate(
      dragOffset.value,
      [0, SCREEN_HEIGHT],
      [0, 1],
      Extrapolation.CLAMP
    );
    return expansion.value * (1 - dragFactor);
  });

  // animate expansion when isExpanded changes
  useEffect(() => {
    if (isExpanded) {
      expansion.value = withSpring(1, SPRING_CONFIG);
    } else {
      expansion.value = withSpring(0, SPRING_CONFIG);
    }
  }, [isExpanded, expansion]);

  // calculate positions
  const miniPlayerY =
    SCREEN_HEIGHT - miniPlayerBottomOffset - MINI_PLAYER_HEIGHT;
  const expandedY = 0;

  // helper to scroll to current line with retry logic
  const scrollToCurrentLine = useCallback(() => {
    if (!isSynced || currentLineIndex < 0 || !lyricsCardScrollRef.current) {
      // console.log("[SCROLL] Skipped: ", { isSynced, currentLineIndex, hasRef: !!lyricsCardScrollRef.current });
      return;
    }

    const attemptScroll = (attempt = 0) => {
      const lineCenter = lyricLinePositions.current[currentLineIndex];
      // console.log(`[SCROLL] Attempt ${attempt}, index ${currentLineIndex}, center: ${lineCenter}, positions: ${lyricLinePositions.current.length}`);

      if (lineCenter === undefined) {
        // if layout not ready, retry up to 10 times (1s)
        if (attempt < 10) {
          setTimeout(() => attemptScroll(attempt + 1), 100);
        }
        return;
      }

      const scrollY = Math.max(0, lineCenter - LYRICS_CARD_HEIGHT / 2);
      // console.log(`[SCROLL] Scrolling to y=${scrollY}`);
      lyricsCardScrollRef.current?.scrollTo({ y: scrollY, animated: true });
    };

    attemptScroll();
  }, [currentLineIndex, isSynced]);

  const handleLineLayout = useCallback(
    (index: number, layout: LayoutRectangle) => {
      // console.log(`[LAYOUT] Line ${index} at y=${layout.y}`);
      lyricLinePositions.current[index] = layout.y + layout.height / 2;
    },
    []
  );

  useEffect(() => {
    lyricLinePositions.current = [];
  }, [syncedLines]);

  // auto-scroll lyrics - triggers when index changes
  useEffect(() => {
    if (!isExpanded) return;
    scrollToCurrentLine();
  }, [currentLineIndex, isExpanded, scrollToCurrentLine]);

  // animate expansion when isExpanded changes
  useEffect(() => {
    if (isExpanded) {
      // Try scrolling immediately in case layout is ready
      scrollToCurrentLine();

      expansion.value = withSpring(1, SPRING_CONFIG, (finished) => {
        if (finished) {
          runOnJS(scrollToCurrentLine)();
        }
      });

      // Safety timeout to ensure scroll happens even if animation callback is skipped
      const timeout = setTimeout(() => {
        scrollToCurrentLine();
      }, 350);

      return () => clearTimeout(timeout);
    } else {
      expansion.value = withSpring(0, SPRING_CONFIG);
    }
  }, [isExpanded, expansion, scrollToCurrentLine]);
  // animated container style - morphs from mini player to full screen
  const containerStyle = useAnimatedStyle(() => {
    const height = interpolate(
      effectiveExpansion.value,
      [0, 1],
      [MINI_PLAYER_HEIGHT, SCREEN_HEIGHT],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      effectiveExpansion.value,
      [0, 1],
      [miniPlayerY, expandedY],
      Extrapolation.CLAMP
    );

    const borderRadius = interpolate(
      effectiveExpansion.value,
      [0, 0.3],
      [0, 16],
      Extrapolation.CLAMP
    );

    return {
      height,
      transform: [{ translateY }],
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
    };
  });

  // mini player content opacity (fades out as we expand)
  const miniContentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      effectiveExpansion.value,
      [0, 0.3],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // full content opacity (fades in as we expand)
  const fullContentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      effectiveExpansion.value,
      [0.5, 1],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      pointerEvents: effectiveExpansion.value > 0.5 ? "auto" : "none",
    };
  });



  // scale image content to maintain high resolution
  // we render the image at full ARTWORK_SIZE and scale it down
  // this forces the native image loader to decode the high-res version
  const imageScaleStyle = useAnimatedStyle(() => {
    const currentSize = interpolate(
      effectiveExpansion.value,
      [0, 1],
      [MINI_ARTWORK_SIZE, ARTWORK_SIZE],
      Extrapolation.CLAMP
    );

    const scale = currentSize / ARTWORK_SIZE;
    // center the large image within the container
    const offset = (currentSize - ARTWORK_SIZE) / 2;

    return {
      width: ARTWORK_SIZE,
      height: ARTWORK_SIZE,
      left: offset,
      top: offset,
      transform: [{ scale }],
    };
  });

  // background blur opacity
  const backgroundStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      effectiveExpansion.value,
      [0.3, 1],
      [0, 0.6],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // collapse the player (from button press)
  const handleCollapse = useCallback(() => {
    collapse();
    dragOffset.value = 0;
  }, [collapse, dragOffset]);

  // collapse from drag gesture - sync expansion to current visual state first
  const handleCollapseFromDrag = useCallback(() => {
    // calculate current effective expansion to avoid jump
    const dragFactor = interpolate(
      dragOffset.value,
      [0, SCREEN_HEIGHT],
      [0, 1],
      Extrapolation.CLAMP
    );
    const currentEffective = expansion.value * (1 - dragFactor);

    // set expansion to current visual state, then animate to 0
    expansion.value = currentEffective;
    dragOffset.value = 0;

    // now collapse - this will animate expansion from currentEffective to 0
    collapse();
  }, [collapse, dragOffset, expansion]);

  // pan gesture for swipe to dismiss - only triggers when at the top of scroll
  const panGesture = Gesture.Pan()
    .onStart(() => {
      // Reset drag when starting a new gesture
      dragOffset.value = 0;
    })
    .onUpdate((event) => {
      // only allow dragging down if we're at the top of the scroll content
      if (event.translationY > 0 && scrollOffset.value <= 5) {
        dragOffset.value = event.translationY;
      }
    })
    .onEnd((event) => {
      // only dismiss if we were actually dragging (scrollOffset was at top)
      if (
        scrollOffset.value <= 5 &&
        (dragOffset.value > DISMISS_THRESHOLD ||
          event.velocityY > DISMISS_VELOCITY)
      ) {
        // dismiss - call collapse immediately, the expansion animation will handle the visual
        runOnJS(handleCollapseFromDrag)();
      } else {
        // snap back
        dragOffset.value = withSpring(0, SPRING_CONFIG);
      }
    })
    .enabled(isExpanded)
    .activeOffsetY(15) // only activate after 15px of downward movement
    .failOffsetY(-10); // fail immediately if scrolling up

  // artwork push animation for track changes
  const [previousArtworkUrl, setPreviousArtworkUrl] = useState<string | null>(
    null
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const currentArtworkTranslateX = useSharedValue(0);
  const previousArtworkTranslateX = useSharedValue(0);
  const currentArtworkOpacity = useSharedValue(1);
  const previousArtworkOpacity = useSharedValue(0);

  const currentArtworkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: currentArtworkTranslateX.value }],
    opacity: currentArtworkOpacity.value,
  }));

  const previousArtworkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: previousArtworkTranslateX.value }],
    opacity: previousArtworkOpacity.value,
  }));

  function triggerArtworkPush(direction: "left" | "right") {
    const slideDistance = ARTWORK_SIZE + 32;
    const exitDirection = direction === "left" ? -slideDistance : slideDistance;
    const enterDirection =
      direction === "left" ? slideDistance : -slideDistance;

    // save the current artwork URL before it changes for the exit animation
    const currentUrl = thumbnailUrl;
    setPreviousArtworkUrl(currentUrl);
    setIsAnimating(true);

    previousArtworkTranslateX.value = 0;
    previousArtworkOpacity.value = 1;
    currentArtworkTranslateX.value = enterDirection;
    currentArtworkOpacity.value = 1;

    previousArtworkTranslateX.value = withTiming(exitDirection, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
    previousArtworkOpacity.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    currentArtworkTranslateX.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    setTimeout(() => {
      setIsAnimating(false);
      setPreviousArtworkUrl(null);
    }, 320);
  }

  // load lyrics when track changes
  useEffect(() => {
    if (!currentTrack) return;

    const isTrackChange =
      previousTrackHash.current !== null &&
      previousTrackHash.current !== currentTrack.trackhash;

    if (isTrackChange) {
      lyricsOpacity.value = withTiming(0, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });
      lyricsTranslateY.value = withTiming(-8, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });

      setTimeout(() => {
        void loadLyrics().then(() => {
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
      void loadLyrics();
    }

    previousTrackHash.current = currentTrack.trackhash;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.trackhash]);

  // update current line index
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

  // auto-scroll lyrics - triggers when index changes
  useEffect(() => {
    if (!isExpanded) return;
    scrollToCurrentLine();
  }, [currentLineIndex, isExpanded, scrollToCurrentLine]);

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
        local?.lyrics &&
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

      const primaryArtist =
        (currentTrack.artists?.length
          ? currentTrack.artists[0].name
          : currentTrack.albumartists?.length
          ? currentTrack.albumartists[0].name
          : "") || "";

      const online = await searchAndDownloadLyrics(
        currentTrack.trackhash,
        currentTrack.title,
        primaryArtist,
        currentTrack.album,
        currentTrack.filepath
      );

      if (online?.lyrics && Array.isArray(online.lyrics)) {
        const first = online.lyrics[0];
        if (typeof first !== "string") {
          setSyncedLines(online.lyrics as unknown as SyncedLine[]);
          setIsSynced(true);
        }
      }
    } catch {
      // silently fail
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
    const animConfig = { duration: 400, easing: Easing.inOut(Easing.cubic) };
    setIsQueueTransitioning(true);

    if (showQueue) {
      viewTransition.value = withTiming(0, animConfig, () => {
        runOnJS(setShowQueue)(false);
        runOnJS(setIsQueueTransitioning)(false);
      });
    } else {
      setShowQueue(true);
      viewTransition.value = withTiming(1, animConfig, () => {
        runOnJS(setIsQueueTransitioning)(false);
      });
    }
  }

  // seeking callbacks
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
      if (isSeekingShared.value) {
        isSeekingShared.value = false;
        runOnJS(finishSeeking)();
      }
    })
    .hitSlop({ top: 12, bottom: 12 })
    .activeOffsetX([-5, 5])
    .failOffsetY([-20, 20]);

  if (!displayTrack) {
    return null;
  }

  const progress = duration > 0 ? position / duration : 0;
  const displayProgress = isSeeking ? seekPosition / duration : progress;
  const displayPosition = isSeeking ? seekPosition : position;

  const artistNames =
    displayTrack.artists && displayTrack.artists.length > 0
      ? displayTrack.artists.map((a) => a.name).join(", ")
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
    if (currentTrack?.albumhash) {
      handleCollapse();
      router.push(`/album/${currentTrack.albumhash}`);
    }
  }

  function goToArtist() {
    if (
      currentTrack &&
      currentTrack.artists &&
      currentTrack.artists.length > 0
    ) {
      handleCollapse();
      router.push(`/artist/${currentTrack.artists[0].artisthash}`);
    }
  }

  function willNextChangeTrack(): boolean {
    if (queue.length === 0) return false;
    if (repeatMode === "one") return false;
    const isAtEnd = currentIndex >= queue.length - 1;
    if (isAtEnd && repeatMode !== "all") return false;
    return true;
  }

  function willPreviousChangeTrack(): boolean {
    if (queue.length === 0) return false;
    if (position > 3000) return false;
    const isAtStart = currentIndex === 0;
    if (isAtStart && repeatMode !== "all") return false;
    return true;
  }

  async function handleNext() {
    if (willNextChangeTrack()) {
      triggerArtworkPush("left");
    } else {
      await seekTo(0);
    }
    await next();
  }

  async function handlePrevious() {
    if (willPreviousChangeTrack()) {
      triggerArtworkPush("right");
      await previous();
    } else {
      await seekTo(0);
    }
  }

  const repeatIcon =
    repeatMode === "one"
      ? "repeat-outline"
      : repeatMode === "all"
      ? "repeat"
      : "repeat-outline";

  // Split queue into sections
  const previousQueue = queue.slice(0, currentIndex);
  const nowPlaying = currentTrack ? [currentTrack] : [];
  const upNextQueue = queue.slice(currentIndex + 1);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/* blurred background - only visible when expanded */}
        {thumbnailUrl && (
          <Animated.View style={[styles.backgroundWrapper, backgroundStyle]}>
            <ImageBackground
              source={{ uri: thumbnailUrl }}
              style={styles.backgroundImage}
              blurRadius={50}
            >
              <View style={styles.backgroundOverlay} />
            </ImageBackground>
          </Animated.View>
        )}

        {/* mini player content - fades out on expand */}
        <Animated.View style={[styles.miniContent, miniContentStyle]}>
          <View style={styles.miniProgressBar}>
            <View
              style={[styles.miniProgressFill, { width: `${progress * 100}%` }]}
            />
          </View>
          <View style={styles.miniInner}>
            {/* mini artwork */}
            <View style={{ width: MINI_ARTWORK_SIZE + 12, justifyContent: "center" }}>
              {thumbnailUrl ? (
                <Image
                  source={{ uri: thumbnailUrl }}
                  style={{
                    width: MINI_ARTWORK_SIZE,
                    height: MINI_ARTWORK_SIZE,
                    borderRadius: 8,
                    backgroundColor: "rgba(255,255,255,0.1)",
                  }}
                />
              ) : (
                <View
                  style={{
                    width: MINI_ARTWORK_SIZE,
                    height: MINI_ARTWORK_SIZE,
                    borderRadius: 8,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="musical-note" size={24} color="#424242" />
                </View>
              )}
            </View>
            <Pressable
              style={styles.miniTrackInfo}
              onPress={() => useNowPlayingTransitionStore.getState().expand()}
            >
              <ThemedText style={styles.miniTrackTitle} numberOfLines={1}>
                {displayTrack.title}
              </ThemedText>
              <ThemedText style={styles.miniTrackArtist} numberOfLines={1}>
                {artistNames}
              </ThemedText>
            </Pressable>
            <View style={styles.miniControls}>
              <Pressable
                onPress={() => void previous()}
                style={styles.miniControlButton}
                hitSlop={8}
                disabled={isControlsDisabled}
              >
                <Ionicons
                  name="play-skip-back"
                  size={22}
                  color={isControlsDisabled ? Palette.textMuted : Palette.textPrimary}
                />
              </Pressable>
              <Pressable
                onPress={() => void handlePlayPause()}
                style={styles.miniPlayButton}
                disabled={isControlsDisabled}
              >
                {isControlsDisabled ? (
                  <ActivityIndicator size="small" color={Palette.background} />
                ) : (
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={24}
                    color={Palette.background}
                  />
                )}
              </Pressable>
              <Pressable
                onPress={() => void next()}
                style={styles.miniControlButton}
                hitSlop={8}
                disabled={isControlsDisabled}
              >
                <Ionicons
                  name="play-skip-forward"
                  size={22}
                  color={isControlsDisabled ? Palette.textMuted : Palette.textPrimary}
                />
              </Pressable>
            </View>
          </View>
        </Animated.View>



        {/* full screen content - fades in on expand */}
        <Animated.View
          style={[
            styles.fullContent,
            fullContentStyle,
            { paddingTop: insets.top + 8 },
          ]}
        >
          {/* dismiss handle */}
          <View style={styles.dismissHandle} />

          {/* header */}
          <View style={styles.header}>
            <Pressable
              onPress={handleCollapse}
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
          </View>

          {/* scrollable content */}
          <Animated.ScrollView
            ref={mainScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={true}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {/* expanded artwork */}
            <Animated.View
              style={{
                width: ARTWORK_SIZE,
                height: ARTWORK_SIZE,
                alignSelf: "center",
                marginBottom: 32,
                marginTop: 10,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {!isExpanded && (
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => useNowPlayingTransitionStore.getState().expand()}
                />
              )}
              {isAnimating && previousArtworkUrl && (
                <Animated.View
                  style={[styles.artworkLayer, previousArtworkAnimStyle]}
                >
                  <Animated.Image
                    source={{ uri: previousArtworkUrl }}
                    style={[styles.artworkImage, imageScaleStyle]}
                    resizeMode="cover"
                  />
                </Animated.View>
              )}
              <Animated.View
                style={[styles.artworkLayer, currentArtworkAnimStyle]}
              >
                {thumbnailUrl || pendingUrl ? (
                  <Animated.Image
                    source={{ uri: (thumbnailUrl || pendingUrl)! }}
                    style={[styles.artworkImage, imageScaleStyle]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.artworkPlaceholder}>
                    <Ionicons
                      name="musical-note"
                      size={isExpanded ? 80 : 18}
                      color="#424242"
                    />
                  </View>
                )}
                {/* hidden preloader for pending image - triggers swap when loaded */}
                {pendingUrl && thumbnailUrl !== pendingUrl && (
                  <Image
                    source={{ uri: pendingUrl }}
                    style={{
                      position: "absolute",
                      width: 1,
                      height: 1,
                      opacity: 0,
                    }}
                    onLoad={handlePendingImageLoad}
                  />
                )}
              </Animated.View>
            </Animated.View>

            {/* artwork/queue toggle */}
            <Animated.View style={[{ width: "100%" }, artworkViewStyle]}>
              {(!showQueue || isQueueTransitioning) && (
                <>
                  {/* track info */}
                  <View style={styles.trackInfo}>
                    <Pressable onPress={goToAlbum}>
                      <ThemedText style={styles.trackTitle} numberOfLines={2}>
                        {displayTrack.title}
                      </ThemedText>
                    </Pressable>
                    <Pressable onPress={goToArtist}>
                      <ThemedText style={styles.trackArtist} numberOfLines={1}>
                        {artistNames}
                      </ThemedText>
                    </Pressable>
                  </View>

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

                  {/* controls */}
                  <View style={styles.controlsRow}>
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
                      disabled={isControlsDisabled}
                    >
                      <Ionicons
                        name="play-skip-back"
                        size={32}
                        color={isControlsDisabled ? "rgba(255,255,255,0.4)" : "#ffffff"}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => void handlePlayPause()}
                      style={styles.playButton}
                      disabled={isControlsDisabled}
                    >
                      {isControlsDisabled ? (
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
                      disabled={isControlsDisabled}
                    >
                      <Ionicons
                        name="play-skip-forward"
                        size={32}
                        color={isControlsDisabled ? "rgba(255,255,255,0.4)" : "#ffffff"}
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

                  {/* lyrics card */}
                  {isSynced && syncedLines.length > 0 && (
                    <Animated.View style={lyricsCardAnimatedStyle}>
                      <View style={lyricsStyles.cardWrapper}>
                        <View style={lyricsStyles.cardHeader}>
                          <ThemedText style={lyricsStyles.cardHeaderTitle}>
                            Lyrics
                          </ThemedText>
                          <Pressable
                            onPress={() => {
                              lyricsCardRef.current?.measureInWindow(
                                (x, y, width, height) => {
                                  useNowPlayingTransitionStore
                                    .getState()
                                    .setLyricsCardLayout({
                                      x,
                                      y,
                                      width,
                                      height,
                                    });
                                  useNowPlayingTransitionStore
                                    .getState()
                                    .expandLyrics();
                                  router.push("/lyrics");
                                }
                              );
                            }}
                            style={lyricsStyles.expandButton}
                            hitSlop={12}
                          >
                            <Ionicons name="expand" size={20} color="#ffffff" />
                          </Pressable>
                        </View>
                        <View ref={lyricsCardRef} style={lyricsStyles.card}>
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

                  {/* no lyrics placeholder */}
                  {!lyricsLoading &&
                    (!isSynced || syncedLines.length === 0) && (
                      <Animated.View style={lyricsCardAnimatedStyle}>
                        <Pressable
                          onPress={() => {
                            useNowPlayingTransitionStore
                              .getState()
                              .expandLyrics();
                            router.push("/lyrics");
                          }}
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

            {/* queue view */}
            <Animated.View style={[{ width: "100%" }, queueViewStyle]}>
              {(showQueue || isQueueTransitioning) && (
                <View style={styles.queueContainer}>
                  {/* Now Playing section */}
                  {nowPlaying.length > 0 && (
                    <View style={queueStyles.section}>
                      <ThemedText style={queueStyles.sectionHeader}>
                        Now Playing
                      </ThemedText>
                      {nowPlaying.map((item, index) => (
                        <AnimatedQueueItem
                          key={`now-${item.trackhash}`}
                          track={item}
                          index={currentIndex}
                          queueIndex={0}
                          viewTransition={viewTransition}
                          isCurrent={true}
                          onPress={() => {}}
                          onRemove={() => {}}
                        />
                      ))}
                    </View>
                  )}

                  {/* Up Next section */}
                  {upNextQueue.length > 0 && (
                    <View style={queueStyles.section}>
                      <ThemedText style={queueStyles.sectionHeader}>
                        Up Next
                      </ThemedText>
                      {upNextQueue.map((item, index) => (
                        <AnimatedQueueItem
                          key={`next-${item.trackhash}-${index}`}
                          track={item}
                          index={currentIndex + 1 + index}
                          queueIndex={index + 1}
                          viewTransition={viewTransition}
                          isCurrent={false}
                          onPress={() => void skipTo(currentIndex + 1 + index)}
                          onRemove={() => removeFromQueue(currentIndex + 1 + index)}
                        />
                      ))}
                    </View>
                  )}

                  {/* Previously Played section */}
                  {previousQueue.length > 0 && (
                    <View style={queueStyles.section}>
                      <ThemedText style={queueStyles.sectionHeader}>
                        Previously Played
                      </ThemedText>
                      {previousQueue.map((item, index) => (
                        <AnimatedQueueItem
                          key={`prev-${item.trackhash}-${index}`}
                          track={item}
                          index={index}
                          queueIndex={nowPlaying.length + upNextQueue.length + index + 1}
                          viewTransition={viewTransition}
                          isCurrent={false}
                          onPress={() => void skipTo(index)}
                          onRemove={() => removeFromQueue(index)}
                        />
                      ))}
                    </View>
                  )}

                  {/* Empty state */}
                  {queue.length === 0 && (
                    <View style={queueStyles.empty}>
                      <ThemedText style={queueStyles.emptyText}>
                        Queue is empty
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          </Animated.ScrollView>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const queueStyles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  list: { paddingVertical: 8 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
    backgroundColor: "transparent",
    borderRadius: 10,
  },
  itemCurrent: { backgroundColor: "rgba(255,255,255,0.12)", marginBottom: 4 },
  itemArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  itemArtPlaceholder: { alignItems: "center", justifyContent: "center" },
  itemInfo: { flex: 1, gap: 4 },
  itemTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255,255,255,0.9)",
  },
  itemTitleCurrent: { color: "#ffffff", fontWeight: "600" },
  itemArtist: { fontSize: 13, color: "rgba(255,255,255,0.5)" },
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
  emptyText: { fontSize: 14, color: "rgba(255,255,255,0.5)" },
});

const lyricsStyles = StyleSheet.create({
  cardWrapper: { marginTop: 8 },
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
  lyricsContainer: { paddingVertical: 12, paddingHorizontal: 16 },
  lineContainer: { paddingVertical: 8 },
  lyricLine: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 28,
    textAlign: "left",
    width: "100%",
    color: "rgba(255,255,255,0.3)",
  },
  lyricLineActive: { color: "#ffffff" },
  lyricLinePast: { color: "rgba(255,255,255,0.4)" },
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
  noLyricsText: { fontSize: 14, color: "rgba(255,255,255,0.5)" },
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: Palette.surface,
    overflow: "hidden",
    zIndex: 10,
  },
  backgroundWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  miniContent: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: MINI_PLAYER_HEIGHT,
  },
  miniProgressBar: {
    height: 3,
    backgroundColor: Palette.surfaceVariant,
  },
  miniProgressFill: {
    height: "100%",
    backgroundColor: Palette.primary,
  },
  miniInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  miniTrackInfo: {
    flex: 1,
    marginRight: 8,
    justifyContent: "center",
  },
  miniTrackTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.textPrimary,
  },
  miniTrackArtist: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  miniControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  miniControlButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  miniPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  artworkLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  artworkImage: {
    // width/height/radius handled by animated style and container
  },
  artworkPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e1e1e",
  },
  fullContent: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
    zIndex: 20,
  },
  dismissHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
    alignSelf: "center",
    marginBottom: 8,
    zIndex: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    height: 40,
    zIndex: 20,
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 64,
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
  queueContainer: {
    flex: 1,
    marginBottom: 16,
  },
});
