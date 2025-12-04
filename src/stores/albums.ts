import { create } from "zustand";
import type {
  Album,
  AlbumWithInfo,
  Track,
  AlbumSortOption,
} from "../api/types";
import { getAlbums, getAlbumWithInfo } from "../api/albums";
import { toggleFavorite } from "../api/favorites";
import { sortAlbumTracks } from "../utils/tracks";

type AlbumState = {
  albums: Album[];
  isLoading: boolean;
  error: string | null;
  totalAlbums: number;
  currentPage: number;
  pageSize: number;
  sortBy: AlbumSortOption;
  sortReverse: boolean;
  currentAlbum: AlbumWithInfo | null;
  isLoadingDetail: boolean;
  detailError: string | null;
  loadAlbums: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  loadAlbumDetail: (albumHash: string) => Promise<void>;
  setSortOption: (option: AlbumSortOption, reverse?: boolean) => Promise<void>;
  toggleTrackFavorite: (track: Track) => Promise<void>;
  clearDetail: () => void;
  refresh: () => Promise<void>;
};

export const useAlbumStore = create<AlbumState>((set, get) => ({
  albums: [],
  isLoading: false,
  error: null,
  totalAlbums: 0,
  currentPage: 0,
  pageSize: 50,
  sortBy: "created_date",
  sortReverse: true,
  currentAlbum: null,
  isLoadingDetail: false,
  detailError: null,
  loadAlbums: async (reset = true) => {
    const state = get();
    if (state.isLoading) return;
    set({ isLoading: true, error: null });
    const page = reset ? 0 : state.currentPage;
    try {
      const response = await getAlbums({
        start: page * state.pageSize,
        limit: state.pageSize,
        sortBy: state.sortBy,
        reverse: state.sortReverse,
      });
      set({
        albums: reset ? response.albums : [...state.albums, ...response.albums],
        totalAlbums: response.total,
        currentPage: page,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "failed to load albums";
      set({ error: message });
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },
  loadMore: async () => {
    const state = get();
    if (state.isLoading) return;
    const hasMore = state.albums.length < state.totalAlbums;
    if (!hasMore) return;
    set({ currentPage: state.currentPage + 1 });
    await get().loadAlbums(false);
  },
  loadAlbumDetail: async (albumHash) => {
    set({ isLoadingDetail: true, detailError: null });
    try {
      const album = await getAlbumWithInfo(albumHash);
      // sort tracks by disc number then track number to ensure correct playback order
      const sortedAlbum = {
        ...album,
        tracks: sortAlbumTracks(album.tracks),
      };
      set({ currentAlbum: sortedAlbum });
    } catch (e) {
      const message = e instanceof Error ? e.message : "failed to load album";
      set({ detailError: message });
      throw e;
    } finally {
      set({ isLoadingDetail: false });
    }
  },
  setSortOption: async (option, reverse = true) => {
    set({ sortBy: option, sortReverse: reverse });
    await get().loadAlbums(true);
  },
  toggleTrackFavorite: async (track) => {
    const state = get();
    try {
      const newStatus = await toggleFavorite(
        track.trackhash,
        "track",
        track.is_favorite ?? false
      );
      if (!state.currentAlbum) return;
      const updatedTracks = state.currentAlbum.tracks.map((t) =>
        t.trackhash === track.trackhash ? { ...t, is_favorite: newStatus } : t
      );
      set({ currentAlbum: { ...state.currentAlbum, tracks: updatedTracks } });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "failed to toggle favorite";
      set({ detailError: message });
    }
  },
  clearDetail: () => {
    set({ currentAlbum: null, detailError: null });
  },
  refresh: async () => {
    await get().loadAlbums(true);
  },
}));
