export const NETEASE_PLAYLIST_PAGE_LIMIT = 1000;
export const NETEASE_MAX_PLAYLISTS = 5000;
export const NETEASE_DEFAULT_PLAYLIST_TRACK_LIMIT = 500;
export const NETEASE_MAX_PLAYLIST_TRACK_LIMIT = 2000;

export function normalizeNeteasePlaylistLimit(limit) {
  const text = String(limit || '').trim().toLowerCase();
  if (text === 'all') return NETEASE_MAX_PLAYLIST_TRACK_LIMIT;
  const value = Number(text || NETEASE_DEFAULT_PLAYLIST_TRACK_LIMIT);
  if (!Number.isFinite(value)) return NETEASE_DEFAULT_PLAYLIST_TRACK_LIMIT;
  return Math.max(1, Math.min(Math.floor(value), NETEASE_MAX_PLAYLIST_TRACK_LIMIT));
}

export function mapNeteaseSong(song) {
  const artists = song?.artists || song?.ar || [];
  const album = song?.album || song?.al || {};
  return {
    id: song?.id,
    name: song?.name,
    artist: artists.map((artist) => artist?.name).filter(Boolean).join(' / '),
    album: album?.name || '',
    cover: album?.picUrl || album?.blurPicUrl || album?.img80x80 || '',
    duration: song?.duration || song?.dt || 0,
    fee: song?.fee,
  };
}

export function mapNeteasePlaylistSummary(playlist) {
  return {
    provider: 'netease',
    id: playlist?.id,
    name: playlist?.name || '',
    trackCount: Number(playlist?.trackCount || 0),
    cover: playlist?.coverImgUrl || playlist?.picUrl || playlist?.cover || '',
  };
}

function readTrackId(track) {
  const id = typeof track === 'object' && track !== null ? track.id : track;
  const numeric = Number(id);
  return Number.isFinite(numeric) && numeric > 0 ? String(Math.trunc(numeric)) : '';
}

export function collectNeteasePlaylistTrackIds(playlist, resultLimit) {
  const limit = normalizeNeteasePlaylistLimit(resultLimit);
  const source = Array.isArray(playlist?.trackIds) && playlist.trackIds.length > 0
    ? playlist.trackIds
    : (Array.isArray(playlist?.tracks) ? playlist.tracks : []);
  const seen = new Set();
  const ids = [];

  for (const item of source) {
    const id = readTrackId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }

  return ids;
}

export function mergeNeteasePlaylistTrackDetails(playlistTracks, detailedTracks, orderedIds) {
  const byId = new Map();
  [...(Array.isArray(playlistTracks) ? playlistTracks : []), ...(Array.isArray(detailedTracks) ? detailedTracks : [])]
    .forEach((track) => {
      const id = readTrackId(track);
      if (id && !byId.has(id)) byId.set(id, track);
    });

  return orderedIds
    .map((id) => byId.get(String(id)))
    .filter(Boolean);
}
