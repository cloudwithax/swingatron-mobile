import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import { Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Track, RepeatMode } from "../api/types";
import { logTrackPlayback } from "../api/playback";
import { getTrackStreamUrl, getThumbnailUrl, getBaseUrl } from "../api/client";

// lock screen metadata type for now playing controls
// these types aren't exported from expo-audio yet but the runtime supports them
interface LockScreenMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
}

interface LockScreenOptions {
  showSeekForward?: boolean;
  showSeekBackward?: boolean;
}

// extended audio player interface with lock screen methods
// the runtime supports these but types aren't in the package yet
interface ExtendedAudioPlayer extends AudioPlayer {
  setActiveForLockScreen?: (
    active: boolean,
    metadata?: LockScreenMetadata,
    options?: LockScreenOptions
  ) => void;
  clearLockScreenControls?: () => void;
}

// playback status subscriber type for external hooks
export type PlaybackSubscriber = () => void;

const playbackSubscribers = new Set<PlaybackSubscriber>();

// cache the last known status to provide immediate state to new subscribers
let lastKnownStatus: AudioStatus | null = null;

// get current playback snapshot for useSyncExternalStore
export function getPlaybackSnapshot(): AudioStatus | null {
  return lastKnownStatus;
}

// subscribe to playback status updates
// compatible with useSyncExternalStore - takes a callback with no args
export function subscribeToPlayback(
  onStoreChange: PlaybackSubscriber
): () => void {
  playbackSubscribers.add(onStoreChange);
  return () => {
    playbackSubscribers.delete(onStoreChange);
  };
}

function notifySubscribers(status: AudioStatus): void {
  lastKnownStatus = status;
  // notify all subscribers that state changed - they will read from snapshot
  playbackSubscribers.forEach((callback) => callback());
}

type PlayerState = {
  currentTrack: Track | null;
  queue: Track[];
  originalQueue: Track[];
  currentIndex: number;
  volume: number;
  isMuted: boolean;
  shuffleMode: boolean;
  repeatMode: RepeatMode;
  isLoading: boolean;
  error: string | null;
  showQueue: boolean;
  playbackSource: string;
  // explicit album image for high-res artwork display
  // this is set when playing from an album context to ensure we use the album's image
  albumImage: string | null;
  // cache buster for artwork URLs to coordinate between store prefetch and component
  imageCacheBuster: number;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  playPause: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  loadTrack: (track: Track) => Promise<void>;
  playTrack: (track: Track) => Promise<void>;
  setQueue: (
    tracks: Track[],
    startIndex?: number,
    preserveShuffle?: boolean,
    source?: string,
    albumImage?: string
  ) => Promise<void>;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  moveQueueItem: (from: number, to: number) => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  skipTo: (index: number) => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  clearQueue: () => Promise<void>;
  openQueue: () => void;
  closeQueue: () => void;
};

let player: ExtendedAudioPlayer | null = null;
let audioConfigured = false;
let statusSubscription: { remove: () => void } | null = null;

const MIN_PLAY_DURATION_TO_LOG = 30;

type PlaybackSession = {
  trackHash: string;
  lastPosition: number;
  accumulated: number;
  hasScrobbled: boolean;
};

let currentSession: PlaybackSession | null = null;

async function configureAudio(): Promise<void> {
  if (!audioConfigured) {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionModeAndroid: "duckOthers",
      interruptionMode: "mixWithOthers",
    });
    audioConfigured = true;
  }
}

// builds the artwork url for lock screen metadata
// returns the full url if base url is available, otherwise returns empty string
async function buildArtworkUrl(image: string | null): Promise<string> {
  if (!image) return "";
  const baseUrl = await getBaseUrl();
  if (!baseUrl) return "";
  return getThumbnailUrl(image, "large");
}

// updates the lock screen now playing metadata with current track info
async function updateLockScreenMetadata(
  audioPlayer: ExtendedAudioPlayer,
  track: Track,
  albumImage: string | null
): Promise<void> {
  // check if lock screen controls are available at runtime
  if (!audioPlayer.setActiveForLockScreen) return;

  try {
    const imageToUse = albumImage || track.image;
    const artworkUrl = await buildArtworkUrl(imageToUse);
    const artistNames =
      track.artists?.map((a) => a.name).join(", ") || "Unknown Artist";

    const metadata: LockScreenMetadata = {
      title: track.title,
      artist: artistNames,
      album: track.album || undefined,
      artwork: artworkUrl || undefined,
    };

    audioPlayer.setActiveForLockScreen(true, metadata, {
      showSeekForward: true,
      showSeekBackward: true,
    });
  } catch (e) {
    // lock screen controls not critical, log and continue
    console.log("[PLAYER] failed to set lock screen metadata:", e);
  }
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function startPlaybackSession(track: Track): void {
  currentSession = {
    trackHash: track.trackhash,
    lastPosition: 0,
    accumulated: 0,
    hasScrobbled: false,
  };
}

async function maybeScrobble(
  track: Track | null,
  source: string
): Promise<void> {
  if (!currentSession || currentSession.hasScrobbled || !track) return;
  const seconds = currentSession.accumulated / 1000;
  if (seconds >= MIN_PLAY_DURATION_TO_LOG) {
    try {
      await logTrackPlayback(track.trackhash, MIN_PLAY_DURATION_TO_LOG, source);
      currentSession.hasScrobbled = true;
    } catch {}
  }
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      originalQueue: [],
      currentIndex: 0,
      volume: 1,
      isMuted: false,
      shuffleMode: false,
      repeatMode: "off",
      isLoading: false,
      error: null,
      showQueue: false,
      playbackSource: "queue",
      albumImage: null,
      imageCacheBuster: Date.now(),
      play: async () => {
        if (!player) return;
        player.play();
        // use the player's current status which is automatically updated
        notifySubscribers(player.currentStatus);
      },
      pause: async () => {
        if (!player) return;
        player.pause();
        // use the player's current status which is automatically updated
        notifySubscribers(player.currentStatus);
      },
      playPause: async () => {
        if (!player) return;
        if (player.playing) {
          await get().pause();
        } else {
          await get().play();
        }
      },
      seekTo: async (position) => {
        if (!player) return;
        // expo-audio seekTo uses seconds, not milliseconds
        await player.seekTo(position / 1000);
        // use the player's current status which is automatically updated
        notifySubscribers(player.currentStatus);
        if (currentSession) {
          currentSession.lastPosition = position;
          currentSession.accumulated = 0;
          currentSession.hasScrobbled = false;
        }
      },
      setVolume: (volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        if (player) {
          player.volume = clamped;
        }
        set({ volume: clamped, isMuted: clamped === 0 });
      },
      toggleMute: () => {
        const state = get();
        const nextMuted = !state.isMuted;
        if (player) {
          player.muted = nextMuted;
        }
        set({ isMuted: nextMuted });
      },
      loadTrack: async (track) => {
        await configureAudio();
        set({ isLoading: true, error: null });
        try {
          // stop and remove existing player if any
          if (player) {
            // pause playback before removing to prevent audio overlap
            player.pause();
            if (statusSubscription) {
              statusSubscription.remove();
              statusSubscription = null;
            }
            player.remove();
            player = null;
          }

          const uri = getTrackStreamUrl(track.trackhash, track.filepath);

          // create new player with expo-audio
          // cast to extended type for lock screen support
          player = createAudioPlayer(uri, {
            updateInterval: 250,
          }) as ExtendedAudioPlayer;
          player.volume = get().volume;
          player.muted = get().isMuted;

          // subscribe to playback status updates
          statusSubscription = player.addListener(
            "playbackStatusUpdate",
            (status: AudioStatus) => {
              // notify external hooks for real-time progress updates
              notifySubscribers(status);

              // handle scrobbling (convert seconds to milliseconds for compatibility)
              if (currentSession && get().currentTrack) {
                const positionMillis = status.currentTime * 1000;
                const delta = positionMillis - currentSession.lastPosition;
                if (status.playing && delta > 0) {
                  currentSession.accumulated += delta;
                  currentSession.lastPosition = positionMillis;
                  void maybeScrobble(get().currentTrack, get().playbackSource);
                }
              }

              // auto-advance to next track when playback ends
              if (status.didJustFinish && !player?.loop) {
                void get().next();
              }
            }
          );

          // wait for the player to be ready
          await new Promise<void>((resolve) => {
            if (player?.isLoaded) {
              resolve();
              return;
            }
            const loadListener = player?.addListener(
              "playbackStatusUpdate",
              (status: AudioStatus) => {
                if (status.isLoaded) {
                  loadListener?.remove();
                  resolve();
                }
              }
            );
            // timeout fallback
            setTimeout(() => {
              loadListener?.remove();
              resolve();
            }, 5000);
          });

          // notify subscribers with initial status
          if (player) {
            notifySubscribers(player.currentStatus);
          }

          // update current track but preserve album image from setQueue context
          // only fall back to track.image if albumImage was never set
          const existingAlbumImage = get().albumImage;
          const imageToUse = existingAlbumImage || track.image;

          // check if the album image changed - if not, reuse existing cache buster
          // this prevents unnecessary cache busting when skipping tracks in same album
          const existingCacheBuster = get().imageCacheBuster;
          const imageChanged = existingAlbumImage !== imageToUse;
          const cacheBusterToUse = imageChanged
            ? Date.now()
            : existingCacheBuster;

          set({
            currentTrack: track,
            albumImage: imageToUse,
            imageCacheBuster: cacheBusterToUse,
          });

          // only prefetch if image actually changed
          if (imageToUse && imageChanged) {
            const baseUrl = getThumbnailUrl(imageToUse, "large");
            const cacheBustedUrl = `${baseUrl}${
              baseUrl.includes("?") ? "&" : "?"
            }cb=${cacheBusterToUse}`;
            Image.prefetch(cacheBustedUrl).catch(() => {});
          }

          startPlaybackSession(track);

          // set up lock screen controls with track metadata
          if (player) {
            void updateLockScreenMetadata(player, track, imageToUse);
          }
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "failed to load track";
          set({ error: message });
          throw e;
        } finally {
          set({ isLoading: false });
        }
      },
      playTrack: async (track) => {
        await get().loadTrack(track);
        await get().play();
      },
      setQueue: async (
        tracks,
        startIndex = 0,
        preserveShuffle = false,
        source = "queue",
        albumImage
      ) => {
        if (tracks.length === 0) return;
        const state = get();
        let queue = tracks;
        let index = startIndex;
        if (state.shuffleMode && preserveShuffle) {
          const shuffled = shuffleArray(tracks);
          const startTrack = tracks[startIndex];
          const startPos = shuffled.findIndex(
            (t) => t.trackhash === startTrack.trackhash
          );
          if (startPos > 0) {
            const copy = [...shuffled];
            const [item] = copy.splice(startPos, 1);
            copy.unshift(item);
            queue = copy;
          } else {
            queue = shuffled;
          }
          index = 0;
        }

        // generate new cache buster NOW before playTrack runs
        // this prevents component from reading stale cache buster from persistence
        const newCacheBuster = Date.now();

        set({
          queue,
          originalQueue: [...tracks],
          currentIndex: index,
          playbackSource: source,
          albumImage: albumImage ?? null,
          imageCacheBuster: newCacheBuster,
        });

        // prefetch album artwork immediately with the cache buster we just set
        if (albumImage) {
          const baseUrl = getThumbnailUrl(albumImage, "large");
          const cacheBustedUrl = `${baseUrl}${
            baseUrl.includes("?") ? "&" : "?"
          }cb=${newCacheBuster}`;
          Image.prefetch(cacheBustedUrl).catch(() => {});
        }

        await get().playTrack(queue[index]);
      },
      addToQueue: (track) => {
        const state = get();
        set({
          queue: [...state.queue, track],
          originalQueue: [...state.originalQueue, track],
        });
      },
      playNext: (track) => {
        const state = get();
        const queue = [...state.queue];
        const originalQueue = [...state.originalQueue];
        queue.splice(state.currentIndex + 1, 0, track);
        originalQueue.splice(state.currentIndex + 1, 0, track);
        set({ queue, originalQueue });
      },
      removeFromQueue: (index) => {
        const state = get();
        if (index < 0 || index >= state.queue.length) return;
        if (index === state.currentIndex) return;
        const removedTrack = state.queue[index];
        const queue = state.queue.filter((_, i) => i !== index);
        const originalQueue = state.originalQueue.filter(
          (t) => t.trackhash !== removedTrack.trackhash
        );
        let currentIndex = state.currentIndex;
        if (index < state.currentIndex) {
          currentIndex -= 1;
        }
        set({ queue, originalQueue, currentIndex });
      },
      moveQueueItem: (from, to) => {
        const state = get();
        const length = state.queue.length;
        if (from < 0 || from >= length || to < 0 || to >= length || from === to)
          return;
        const queue = [...state.queue];
        const [moved] = queue.splice(from, 1);
        queue.splice(to, 0, moved);

        let currentIndex = state.currentIndex;
        if (from === currentIndex) {
          currentIndex = to;
        } else if (from < currentIndex && to >= currentIndex) {
          currentIndex -= 1;
        } else if (from > currentIndex && to <= currentIndex) {
          currentIndex += 1;
        }

        const hashes = new Set(queue.map((t) => t.trackhash));
        const originalQueue = state.originalQueue.filter((t) =>
          hashes.has(t.trackhash)
        );

        set({ queue, originalQueue, currentIndex });
      },
      next: async () => {
        const state = get();
        if (state.queue.length === 0) return;
        const lastIndex = state.queue.length - 1;
        let nextIndex = state.currentIndex;
        if (state.repeatMode === "one") {
          nextIndex = state.currentIndex;
        } else if (state.currentIndex < lastIndex) {
          nextIndex = state.currentIndex + 1;
        } else if (state.repeatMode === "all") {
          nextIndex = 0;
        } else {
          await get().pause();
          return;
        }
        set({ currentIndex: nextIndex });
        await get().playTrack(get().queue[nextIndex]);
      },
      previous: async () => {
        const state = get();
        if (state.queue.length === 0) return;

        // get current position from player to decide whether to restart or go back
        // expo-audio uses seconds, convert to milliseconds for comparison
        let currentPosition = 0;
        if (player) {
          currentPosition = player.currentTime * 1000;
        }

        if (currentPosition > 3000) {
          await get().seekTo(0);
          return;
        }
        let prevIndex = state.currentIndex;
        if (state.currentIndex > 0) {
          prevIndex = state.currentIndex - 1;
        } else if (state.repeatMode === "all") {
          prevIndex = state.queue.length - 1;
        } else {
          await get().seekTo(0);
          return;
        }
        set({ currentIndex: prevIndex });
        await get().playTrack(get().queue[prevIndex]);
      },
      skipTo: async (index) => {
        const state = get();
        if (index < 0 || index >= state.queue.length) return;
        set({ currentIndex: index });
        await get().playTrack(state.queue[index]);
      },
      toggleShuffle: () => {
        const state = get();
        const nextShuffle = !state.shuffleMode;
        if (!nextShuffle) {
          if (!state.currentTrack) {
            set({ shuffleMode: nextShuffle, queue: [...state.originalQueue] });
            return;
          }
          const restored = [...state.originalQueue];
          const idx = restored.findIndex(
            (t) => t.trackhash === state.currentTrack?.trackhash
          );
          set({
            shuffleMode: nextShuffle,
            queue: restored,
            currentIndex: idx >= 0 ? idx : 0,
          });
          return;
        }
        if (!state.currentTrack) {
          const shuffled = shuffleArray(state.queue);
          set({ shuffleMode: nextShuffle, queue: shuffled, currentIndex: 0 });
          return;
        }
        const remaining = state.queue.filter(
          (t) => t.trackhash !== state.currentTrack?.trackhash
        );
        const shuffledRemaining = shuffleArray(remaining);
        set({
          shuffleMode: nextShuffle,
          queue: [state.currentTrack, ...shuffledRemaining],
          currentIndex: 0,
        });
      },
      cycleRepeatMode: () => {
        const state = get();
        const modes: RepeatMode[] = ["off", "all", "one"];
        const index = modes.indexOf(state.repeatMode);
        const next = modes[(index + 1) % modes.length];
        set({ repeatMode: next });
      },
      clearQueue: async () => {
        if (player) {
          // clear lock screen controls before removing player
          if (player.clearLockScreenControls) {
            try {
              player.clearLockScreenControls();
            } catch {
              // ignore errors from clearing lock screen
            }
          }
          // pause playback before removing
          player.pause();
          if (statusSubscription) {
            statusSubscription.remove();
            statusSubscription = null;
          }
          player.remove();
          player = null;
        }
        currentSession = null;
        lastKnownStatus = null;
        set({
          currentTrack: null,
          queue: [],
          originalQueue: [],
          currentIndex: 0,
        });
      },
      openQueue: () => {
        set({ showQueue: true });
      },
      closeQueue: () => {
        set({ showQueue: false });
      },
    }),
    {
      name: "swing_player",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
