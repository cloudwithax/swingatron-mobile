import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAudioModeAsync } from "expo-audio";
import { VideoPlayer } from "expo-video";
import { Image } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getBaseUrl, getThumbnailUrl, getTrackStreamUrl } from "../api/client";
import { logTrackPlayback } from "../api/playback";
import type { RepeatMode, Track } from "../api/types";

// playback status type for VideoPlayer
interface PlaybackStatus {
  isLoaded: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  didJustFinish: boolean;
}

// playback status subscriber type for external hooks
export type PlaybackSubscriber = () => void;

const playbackSubscribers = new Set<PlaybackSubscriber>();

// cache the last known status to provide immediate state to new subscribers
let lastKnownStatus: PlaybackStatus | null = null;

// get current playback snapshot for useSyncExternalStore
export function getPlaybackSnapshot(): PlaybackStatus | null {
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

function notifySubscribers(status: PlaybackStatus): void {
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
  // track hash of the track that is currently being loaded (set immediately on click)
  // this allows the UI to show loading state before the async loadTrack function runs
  pendingTrackHash: string | null;
  // full track object being loaded - allows player UI to show metadata immediately
  pendingTrack: Track | null;
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

let player: VideoPlayer | null = null;
let audioConfigured = false;
let statusCheckInterval: NodeJS.Timeout | null = null;

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
      pendingTrackHash: null,
      pendingTrack: null,
      error: null,
      showQueue: false,
      playbackSource: "queue",
      albumImage: null,
      imageCacheBuster: Date.now(),
      play: async () => {
        if (!player) return;
        player.play();
        // notify subscribers with current status
        if (lastKnownStatus) {
          notifySubscribers({ ...lastKnownStatus, isPlaying: true });
        }
      },
      pause: async () => {
        if (!player) return;
        player.pause();
        // notify subscribers with current status
        if (lastKnownStatus) {
          notifySubscribers({ ...lastKnownStatus, isPlaying: false });
        }
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
        // expo-video seekTo uses seconds, not milliseconds
        player.currentTime = position / 1000;
        // notify subscribers with updated position
        if (lastKnownStatus) {
          notifySubscribers({
            ...lastKnownStatus,
            currentTime: position / 1000,
          });
        }
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
        set({
          isLoading: true,
          pendingTrackHash: track.trackhash,
          pendingTrack: track,
          error: null,
        });
        try {
          // stop and remove existing player if any
          if (player) {
            player.pause();
            if (statusCheckInterval) {
              clearInterval(statusCheckInterval);
              statusCheckInterval = null;
            }
            player.remove();
            player = null;
          }

          const uri = getTrackStreamUrl(track.trackhash, track.filepath);

          // prepare metadata for lock screen
          const existingAlbumImage = get().albumImage;
          const imageToUse = existingAlbumImage || track.image;
          const artworkUrl = await buildArtworkUrl(imageToUse);
          const artistNames =
            track.artists?.map((a) => a.name).join(", ") || "Unknown Artist";

          // create new player with expo-video configured for audio playback with lock screen controls
          player = new VideoPlayer({
            uri,
            metadata: {
              title: track.title,
              artist: artistNames,
              artwork: artworkUrl,
            },
          });

          // configure for audio-only background playback with lock screen controls
          player.loop = false;
          player.staysActiveInBackground = true;
          player.showNowPlayingNotification = true;
          player.audioMixingMode = "doNotMix";
          player.volume = get().volume;
          player.muted = get().isMuted;

          // set up status polling
          statusCheckInterval = setInterval(() => {
            if (!player) return;

            const status: PlaybackStatus = {
              isLoaded: true,
              isPlaying: player.playing,
              currentTime: player.currentTime,
              duration: player.duration,
              didJustFinish:
                player.status === "idle" &&
                player.currentTime >= player.duration - 0.1,
            };

            // notify external hooks for real-time progress updates
            notifySubscribers(status);

            // handle scrobbling
            if (currentSession && get().currentTrack && status.isPlaying) {
              const positionMillis = status.currentTime * 1000;
              const delta = positionMillis - currentSession.lastPosition;
              if (delta > 0) {
                currentSession.accumulated += delta;
                currentSession.lastPosition = positionMillis;
                void maybeScrobble(get().currentTrack, get().playbackSource);
              }
            }

            // auto-advance to next track when playback ends
            if (status.didJustFinish) {
              void get().next();
            }
          }, 250);

          // wait for the player to be ready
          await new Promise<void>((resolve) => {
            let attempts = 0;
            const checkInterval = setInterval(() => {
              attempts++;
              if (player?.status !== "idle" || attempts > 20) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 250);
          });

          // notify subscribers with initial status
          if (player) {
            notifySubscribers({
              isLoaded: true,
              isPlaying: false,
              currentTime: 0,
              duration: player.duration,
              didJustFinish: false,
            });
          }

          // check if the album image changed - if not, reuse existing cache buster
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
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "failed to load track";
          set({ error: message });
          throw e;
        } finally {
          set({ isLoading: false, pendingTrackHash: null, pendingTrack: null });
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

        // set pending track immediately so UI can show metadata right away
        const trackToPlay = queue[index];
        set({
          pendingTrackHash: trackToPlay.trackhash,
          pendingTrack: trackToPlay,
        });
        await get().playTrack(trackToPlay);
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
        // expo-video uses seconds, convert to milliseconds for comparison
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
          // pause playback before removing
          player.pause();
          if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
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
