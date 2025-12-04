export interface TrackArtist {
  artisthash: string
  name: string
  image: string
}

export interface AlbumArtist {
  artisthash: string
  name: string
  image: string
  colors?: string[]
  created_date?: number
  help_text?: string
}

export interface Genre {
  genrehash: string
  name: string
}

export interface Track {
  album: string
  albumhash: string
  trackhash: string
  title: string
  filepath: string
  artists?: TrackArtist[]
  albumartists?: TrackArtist[]
  bitrate: number
  duration: number
  disc?: number
  track?: number
  image: string
  folder: string
  is_favorite?: boolean
}

export interface Album {
  albumhash: string
  title: string
  date?: number
  image: string
  albumartists?: AlbumArtist[]
  colors?: string[]
  versions?: string[]
  help_text?: string
  created_date?: number
  trackcount?: number
  duration?: number
}

export interface Artist {
  artisthash: string
  name: string
  image: string
  colors?: string[]
  help_text?: string
  created_date?: number
  trackcount?: number
  albumcount?: number
}

export interface ArtistExpanded {
  artisthash: string
  name: string
  image: string
  color?: string
  genres?: Genre[]
  duration?: number
  trackcount?: number
  albumcount?: number
  is_favorite?: boolean
}

export interface Folder {
  path: string
  name: string
  count?: number
  trackcount?: number
  foldercount?: number
  is_sym?: boolean
}

export interface AlbumInfo {
  albumhash: string
  albumartists?: AlbumArtist[]
  artisthashes?: string[]
  base_title?: string
  color?: string
  created_date?: number
  date?: number
  duration?: number
  genrehashes?: string
  genres?: Genre[]
  id?: number
  image: string
  is_favorite?: boolean
  lastplayed?: number
  og_title?: string
  playcount?: number
  playduration?: number
  title: string
  trackcount?: number
  type?: string
  versions?: string[]
}

export interface AlbumWithInfo {
  info: AlbumInfo
  tracks: Track[]
  copyright?: string
}

export interface AlbumsAndAppearances {
  albums?: Album[]
  appearances?: Album[]
  singles_and_eps?: Album[]
  compilations?: Album[]
  artistname?: string
}

export interface ArtistInfo {
  artist: ArtistExpanded
  albums: AlbumsAndAppearances
  tracks?: Track[]
}

export type SimilarArtist = Artist

export interface FolderContentRequest {
  folder: string
  start: number
  limit: number
}

export interface FolderContentResponse {
  folders: Folder[]
  tracks: Track[]
  total: number
  path: string
}

export interface RootFolder {
  path: string
  name: string
}

export interface TopResultItem {
  type: string
  title?: string
  name?: string
  albumcount?: number
  artisthash?: string
  trackhash?: string
  albumhash?: string
  color?: string
  created_date?: number
  date?: number
  duration?: number
  id?: number
  image?: string
  lastplayed?: number
  playcount?: number
  playduration?: number
  trackcount?: number
  album?: string
  albumartists?: AlbumArtist[]
  artisthashes?: string[]
  artists?: TrackArtist[]
  bitrate?: number
  filepath?: string
  folder?: string
  is_favorite?: boolean
}

export interface SearchResults {
  tracks: Track[]
  albums: Album[]
  artists: Artist[]
}

export interface TopSearchResults {
  top_result?: TopResultItem
  tracks: Track[]
  albums: Album[]
  artists: Artist[]
}

export interface User {
  id: number
  username: string
  image: string
  roles: string[]
}

export interface ProfileSettings {
  usersOnLogin: boolean
}

export interface UsersResponse {
  settings: ProfileSettings
  users: User[]
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accesstoken: string
  refreshtoken: string
  user: User
}

export interface PairResponse {
  accesstoken: string
  refreshtoken: string
  user: User
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RefreshTokenResponse {
  accesstoken: string
  refreshtoken: string
}

export interface FavoriteRequest {
  hash: string
  type: 'track' | 'album' | 'artist'
}

export interface LogTrackRequest {
  trackHash: string
  duration: number
  timestamp: number
}

export interface PaginatedRequest {
  start: number
  limit: number
  sortBy?: string
  reverse?: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
}

export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
}

export interface QueueItem {
  id: string
  track: Track
  position: number
}

export type RepeatMode = 'off' | 'all' | 'one'

export type ShuffleMode = boolean

export type AlbumSortOption =
  | 'title'
  | 'created_date'
  | 'date'
  | 'albumartists'
  | 'duration'
  | 'trackcount'
  | 'playcount'
  | 'playduration'
  | 'lastplayed'

export type ArtistSortOption =
  | 'name'
  | 'created_date'
  | 'duration'
  | 'trackcount'
  | 'albumcount'
  | 'playcount'
  | 'playduration'
  | 'lastplayed'

export type SortOption = AlbumSortOption | ArtistSortOption

export interface SortConfig {
  sortBy: SortOption
  reverse: boolean
}

export interface PlaylistSettings {
  banner_pos?: number
  square_img?: boolean
  has_gif?: boolean
  pinned?: boolean
}

export interface PlaylistImage {
  image: string
  color: string
}

export interface Playlist {
  id: number
  name: string
  image: string
  has_image: boolean
  count: number
  last_updated: string
  _last_updated: string
  thumb: string
  duration: number
  settings: PlaylistSettings
  pinned: boolean
  help_text?: string
  time?: string
  images?: PlaylistImage[]
  trackhashes?: string[]
  userid?: number
  _score?: number
  extra?: unknown
}

export interface PlaylistWithTracks {
  info: Playlist
  tracks: Track[]
}

export interface CreatePlaylistRequest {
  name: string
}

export interface AddToPlaylistRequest {
  itemtype: 'tracks' | 'album' | 'artist' | 'folder'
  itemhash: string
}

export interface SyncedLyricLine {
  time: number
  text: string
}

export interface LyricsResponse {
  lyrics: SyncedLyricLine[] | string[]
  synced: boolean
  copyright?: string
}

export interface LyricsRequest {
  trackhash: string
  filepath: string
}

export interface FavoritesCount {
  tracks: number
  albums: number
  artists: number
}

export interface RecentFavoriteItem {
  item: Track & {
    help_text?: string
    time?: string
  }
  type: 'track' | 'album' | 'artist'
}

export interface FavoritesResponse {
  tracks: Track[]
  albums: Album[]
  artists: Artist[]
  count: FavoritesCount
  recents: RecentFavoriteItem[]
}

export interface FavoritesRequestParams {
  track_limit?: number
  album_limit?: number
  artist_limit?: number
}

export interface HomeTrackItem {
  album: string
  albumhash: string
  trackhash: string
  title: string
  filepath: string
  artists?: TrackArtist[]
  albumartists?: TrackArtist[]
  artisthashes?: string[]
  bitrate: number
  duration: number
  image: string
  folder: string
  is_favorite?: boolean
  help_text?: string
  time?: string
}

export interface HomeAlbumItem {
  albumartists?: AlbumArtist[]
  albumhash: string
  artisthashes?: string[]
  base_title?: string
  color?: string
  created_date?: number
  genrehashes?: string
  help_text?: string
  id?: number
  image: string
  lastplayed?: number
  playcount?: number
  playduration?: number
  time?: string
  title: string
  trackcount?: number
  type?: string
  versions?: string[]
}

export interface HomeArtistItem {
  artisthash: string
  color?: string
  help_text?: string
  image: string
  name: string
  time?: string
  type?: string
}

export type HomeItem =
  | { item: HomeTrackItem; type: 'track' }
  | { item: HomeAlbumItem; type: 'album' }
  | { item: HomeArtistItem; type: 'artist' }

export interface HomeSection {
  description?: string
  items: HomeItem[]
  title: string
}

export interface HomeResponse {
  recently_played?: HomeSection
  recently_added?: HomeSection
}

export type ChartDuration = 'week' | 'month' | 'year' | 'alltime'
export type ChartOrderBy = 'playcount' | 'playduration'
export type TrendDirection = 'rising' | 'falling' | 'stable'

export interface ChartItemsParams {
  duration?: ChartDuration
  limit?: number
  orderBy?: ChartOrderBy
}

export interface ChartScrobbleSummary {
  text: string
  trend: TrendDirection
  dates: string
}

export interface ChartTrack extends Track {
  trend: TrendDirection
  help_text: string
  playcount?: number
  playduration?: number
}

export interface ChartArtist extends Artist {
  trend: TrendDirection
  help_text: string
  extra?: {
    playcount: number
  }
}

export interface ChartAlbum extends Album {
  trend: TrendDirection
  help_text: string
  playcount?: number
  playduration?: number
}

export interface TopTracksResponse {
  tracks: ChartTrack[]
  scrobbles: ChartScrobbleSummary
}

export interface TopArtistsResponse {
  artists: ChartArtist[]
  scrobbles: ChartScrobbleSummary
}

export interface TopAlbumsResponse {
  albums: ChartAlbum[]
  scrobbles: ChartScrobbleSummary
}

export interface StatItem {
  type: string
  title: string
  value: string
  image?: string | null
}

export interface StatsResponse {
  stats: StatItem[]
  dates: string
}
