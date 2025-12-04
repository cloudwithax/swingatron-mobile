import { create } from "zustand";

interface LyricsCardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NowPlayingTransitionState {
  // whether the now playing view is expanded (full screen)
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  expand: () => void;
  collapse: () => void;

  // lyrics transition state
  isLyricsExpanded: boolean;
  lyricsCardLayout: LyricsCardLayout | null;
  setLyricsCardLayout: (layout: LyricsCardLayout | null) => void;
  expandLyrics: () => void;
  collapseLyrics: () => void;
}

export const useNowPlayingTransitionStore = create<NowPlayingTransitionState>(
  (set) => ({
    isExpanded: false,
    setIsExpanded: (value) => set({ isExpanded: value }),
    expand: () => set({ isExpanded: true }),
    collapse: () => set({ isExpanded: false }),

    // lyrics transition
    isLyricsExpanded: false,
    lyricsCardLayout: null,
    setLyricsCardLayout: (layout) => set({ lyricsCardLayout: layout }),
    expandLyrics: () => set({ isLyricsExpanded: true }),
    collapseLyrics: () => set({ isLyricsExpanded: false }),
  })
);
