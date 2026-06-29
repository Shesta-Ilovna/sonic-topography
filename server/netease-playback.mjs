const NETEASE_ALLOWED_BITRATES = new Set(['320000', '192000', '128000']);
const NETEASE_DEFAULT_BITRATE = '320000';

export function normalizeNeteaseBitrate(value) {
  const raw = String(value || '').trim();
  return NETEASE_ALLOWED_BITRATES.has(raw) ? raw : NETEASE_DEFAULT_BITRATE;
}

export function neteasePlayableUrlCacheKey(id, cookie, bitrate) {
  return `${id}::${cookie}::${normalizeNeteaseBitrate(bitrate)}`;
}

export function buildNeteasePlayerUrl(id, bitrate) {
  const encodedId = encodeURIComponent(id);
  return `https://music.163.com/api/song/enhance/player/url?id=${encodedId}&ids=%5B${encodedId}%5D&br=${normalizeNeteaseBitrate(bitrate)}`;
}
