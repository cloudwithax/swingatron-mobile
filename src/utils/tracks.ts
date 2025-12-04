import type { Track } from "../api/types";

/**
 * sorts album tracks by disc number then track number
 * ensures playback order matches the intended album sequence
 */
export function sortAlbumTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => {
    const discA = a.disc || 1;
    const discB = b.disc || 1;
    if (discA !== discB) {
      return discA - discB;
    }
    return (a.track || 0) - (b.track || 0);
  });
}
