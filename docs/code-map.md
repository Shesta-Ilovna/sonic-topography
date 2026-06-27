# Sonic Topography Code Map

This file is the project index for future code changes, debugging, testing, and review.

Last fully verified commit: `unknown`

## Start Here

| Goal | Main files | Tests | Verification |
| --- | --- | --- | --- |
| Electron shell, window chrome, login bridge, installer config | `desktop/main.js`, `desktop/preload.cjs`, `scripts/dev-electron.mjs`, `package.json` | `src/lib/neteaseCookie.test.ts`, `src/lib/qqCookie.test.ts` | `npm run dev:electron`, `npm run build:electron:dir`, `npm run build:electron` |
| Player UI, sidebar, search, cloud music panel | `src/components/UI/UI.tsx`, `src/index.css`, `src/App.tsx` | `src/lib/triggerSettings.test.ts`, `src/lib/presetTransfer.test.ts` | `npm run lint`, `npm run build`, `npm run dev:electron` |
| Netease API, cookies, liked songs, playlists, daily recommendations | `vite.config.ts`, `local-server.mjs`, `server/netease-library.mjs`, `src/lib/neteaseCookie.ts` | `src/lib/neteaseCookie.test.ts`, `src/lib/neteasePlaylist.test.ts` | `npx tsx src/lib/neteaseCookie.test.ts`, `npx tsx src/lib/neteasePlaylist.test.ts`, `npm run build` |
| QQ Music API, cookies, search, personal playlists, lyrics, audio proxy | `server/qq-music.mjs`, `vite.config.ts`, `local-server.mjs`, `src/lib/qqCookie.ts` | `src/lib/qqCookie.test.ts`, `src/lib/qqMusicLibrary.test.ts` | `npx tsx src/lib/qqCookie.test.ts`, `npx tsx src/lib/qqMusicLibrary.test.ts`, `npm run build` |
| Update checks and installer download | `server/update-service.mjs`, `src/lib/updateSource.ts`, `desktop/main.js`, `package.json` | `src/lib/updateSource.test.ts` | `npx tsx src/lib/updateSource.test.ts`, `npm run build:electron:dir` |
| Preset import/export | `src/lib/presetTransfer.ts`, `src/components/UI/UI.tsx` | `src/lib/presetTransfer.test.ts` | `npx tsx src/lib/presetTransfer.test.ts`, `npm run lint` |
| Theme colors, backdrop lock, and shader palette | `src/lib/themes.ts`, `src/App.tsx`, `src/components/UI/UI.tsx`, `src/components/AudioVisualizer/MapScene.tsx`, `src/components/AudioVisualizer/CustomShaderMaterial.ts` | `src/lib/themes.test.ts`, `src/lib/themeShader.test.ts`, `src/lib/presetTransfer.test.ts` | `npx tsx src/lib/themes.test.ts`, `npx tsx src/lib/themeShader.test.ts`, `npm run build`, manual custom theme color check |
| Audio analysis, ground effects mixer, and 3D terrain | `src/lib/AudioEngine.ts`, `src/lib/groundEqSettings.ts`, `src/components/AudioVisualizer/MapScene.tsx`, `src/components/AudioVisualizer/CustomShaderMaterial.ts` | `src/lib/audioFrameCache.test.ts`, `src/lib/groundEqSettings.test.ts`, `src/lib/presetTransfer.test.ts` | `npx tsx src/lib/audioFrameCache.test.ts`, `npx tsx src/lib/groundEqSettings.test.ts`, `npx tsx src/lib/presetTransfer.test.ts`, `npm run build`, manual playback in Electron |

## End-To-End Flow

```text
npm run dev:electron
-> scripts/dev-electron.mjs starts Vite
-> Electron loads http://127.0.0.1:3000
-> React/CSS hot reload; main/preload/server changes need Electron restart
```

```text
Netease playlist loading
UI cloud panel
-> /api/netease/playlists
-> /api/netease/playlist?id=<id>&limit=all
-> vite.config.ts in dev or local-server.mjs in packaged mode
-> getPlaylistPlayableSongs()
-> playlist detail may expose only a partial playlist.tracks array
-> server/netease-library.mjs reads playlist.trackIds as the source of truth
-> fetchNeteaseSongDetails() batches /api/song/detail for the full track list
-> UI shows "loaded X / total Y songs"
```

```text
QQ login and library
Settings -> Account -> QQ Music -> official y.qq.com QR login window
-> desktop/main.js reads QQ cookies
-> UI stores cookie and syncs PUT /api/qq/login/cookie
-> /api/qq/user/playlists
-> /api/qq/playlist/tracks?id=<id>&limit=all
-> server/qq-music.mjs maps songs to the shared NeteaseSong shape with provider: 'qq'
```

```text
Search and playback
Search panel chooses effectiveSearchProvider
-> Netease: /api/netease/search
-> QQ: /api/qq/search
-> UI.loadNeteaseSong(song, queue)
-> Netease: /api/netease/url + /api/netease/lyric + /api/netease/audio
-> QQ: /api/qq/song/url + /api/qq/lyric + /api/qq/audio
-> AudioEngine.loadUrl()
-> MapScene reads AudioEngine.getAudioData()
```

## Code Map

### React Player UI

`src/components/UI/UI.tsx`

Main interaction surface. Owns sidebar, search, cloud music panel, account login settings, update checks, playback queue, album-cover rendering, and cloud playback dispatch. The player card polls audio time at a low fixed interval rather than every animation frame to avoid repainting the whole UI at 60fps. The custom theme `showPlayerPanel` flag controls whether the right player card is visible; the card can render an empty state before a track is loaded. The cloud panel expects provider-aware song identities such as `netease:<id>` and `qq:<id>`. Netease keeps daily recommendations; QQ only has liked songs and playlists.

`src/types.ts`

Shared client types. `NeteaseSong` is the common cloud-song shape used by the player UI, saved playlists, and last-played storage; keep this type here instead of redefining it inside UI components.

### Netease Cloud Music

`server/netease-library.mjs`

Shared Netease playlist helpers used by both dev and packaged servers. Important helpers:

- `normalizeNeteasePlaylistLimit()`
- `collectNeteasePlaylistTrackIds()`
- `mergeNeteasePlaylistTrackDetails()`
- `mapNeteaseSong()`

When a playlist says it has 70 songs but only 20 display, check this module first. Netease often returns only part of the playlist in `playlist.tracks`; `playlist.trackIds` is the complete ordered ID list. `mapNeteaseSong()` also maps album artwork into the shared `cover` field used by song rows and the player panel.

`vite.config.ts`

Vite dev server API. Registers `/api/playlists`, `/api/netease/*`, `/api/qq/*`, and update APIs. Netease playlist behavior must stay in sync with `local-server.mjs`.

`local-server.mjs`

Packaged Electron local Express server. Mirrors the dev server API behavior. If a Netease API fix is made in `vite.config.ts`, apply the same production fix here.

`src/lib/neteaseCookie.ts`

Netease cookie parsing, storage, and request header helpers.

### QQ Music

`server/qq-music.mjs`

Shared QQ Music service module for Vite middleware and Express production routes. Handles cookies, login status, search, personal playlists, playlist tracks, playback URLs, lyrics, and audio proxying.

Key endpoints:

- `GET /api/qq/user/playlists`
- `GET /api/qq/playlist/tracks?id=<id>&limit=all`
- `GET /api/qq/search?keywords=<keywords>&limit=30`
- `GET /api/qq/song/url?mid=<mid>&mediaMid=<mediaMid>&quality=exhigh`
- `GET /api/qq/audio?mid=<mid>&mediaMid=<mediaMid>&quality=exhigh`

QQ playback defaults to `exhigh` / 320k MP3. Do not default to Hi-Res FLAC; QQ can return a seemingly playable FLAC purl that later 404s during real audio streaming.

### Audio And Scene

`src/lib/AudioEngine.ts`

Web Audio playback and frequency analysis. Splits audio into sub-bass, bass, low-mid, mid, high-mid, presence, brilliance, and air bands. `getAudioData()` caches one analysis snapshot per animation frame so multiple readers do not repeat analyser scans or advance trigger state twice in the same frame.

`src/lib/metadata.ts`

Local audio metadata reader for uploaded files and demo audio. It dynamically imports `music-metadata-browser` only when local metadata is requested; cloud music cover art comes from Netease/QQ API song data instead.

`src/components/AudioVisualizer/MapScene.tsx`

Three.js scene. Reads `AudioEngine.getAudioData()`, applies ground EQ settings, and passes uniforms to the terrain shader.

`src/components/AudioVisualizer/CustomShaderMaterial.ts`

Terrain shader. Low frequencies change elevation; high frequencies mostly affect glow, sparks, and shimmer.

`src/lib/groundEqSettings.ts`

Ground effects mixer storage, normalization, legacy curve migration, per-band sensitivity scaling, and the global ground motion speed value. The model is 8 independent band values plus `motionSpeed`, not a 16-point curve. The UI exposes the bands as mixer faders for sub-bass, bass, low-mid, mid, high-mid, presence, brilliance, and air, with one horizontal slider controlling how quickly the terrain columns rise and fall.

### Theme Colors

`src/lib/themes.ts`

Normalizes built-in and custom theme colors. First launch defaults to the built-in `Nocturnal` theme through `DEFAULT_THEME_ID`. Custom `background` maps to terrain dark colors (`uBaseColor1` / `uBaseColor2`), `fog` is a compatibility field whose product meaning is the rear canvas backdrop color (`uFogColor`), `cool` maps to `uCoolCore`, `warm` maps to `uWarmCore`, and `accent` maps to `uRippleColor`. Legacy custom themes without `fog` default to `fog = background` and `fogLinkedToBackground = true`.

`src/App.tsx`

Uses `uFogColor` as the app/canvas backdrop color so transparent far-distance terrain reveals the selected rear background.

`src/components/UI/UI.tsx`

Custom theme editor. The ground/backdrop color row has a lock control: when `fogLinkedToBackground` is true, changing terrain dark color immediately syncs the rear backdrop and disables the backdrop picker; when false, the rear backdrop is edited independently.

`src/components/AudioVisualizer/MapScene.tsx`

Feeds theme colors into Three.js fog and terrain shader uniforms each frame. Three.js fog should stay close to `uBaseColor1` for natural terrain-edge fade; do not use the rear backdrop color for the real fog layer.

`src/components/AudioVisualizer/CustomShaderMaterial.ts`

Shader palette source. Do not hard-code cyan/blue brightness washes; bright high-frequency glow should derive from `uCoolCore` so the custom cool color is visible. Far-distance transparent fade can blend toward `uFogColor` before alpha fade, but edge fog/aerial perspective should stay based on terrain base colors.

### Electron Desktop Shell

`desktop/main.js`

Electron main process. Handles frameless transparent rounded window, window IPC, dev/production loading, production local server, official Netease/QQ QR login windows, cookie extraction, and update installer opening. Startup app switches request Chromium GPU acceleration and prefer the high-performance GPU (`force_high_performance_gpu`), but Windows graphics settings and the driver can still override the final adapter choice.

`desktop/preload.cjs`

Exposes `window.sonicDesktop` through `contextBridge` and adds desktop CSS classes.

`scripts/dev-electron.mjs`

Starts Vite and Electron for development.

`package.json`

Electron Builder and NSIS installer configuration. The Windows installer is not one-click, allows users to choose the installation directory, and creates desktop/start-menu shortcuts. Packaged mode uses the app version and GitHub update source from this file, so release builds must bump `version` and configure `sonicTopography.update.owner/repo`.

On this Windows workspace, Electron Builder can fail with `EPERM` while renaming `win-unpacked.tmp` after extracting Electron. The build config uses `electronDist: node_modules/electron/dist` to reuse the installed Electron runtime and skip that fragile extraction/rename step. Windows icon assets live in `build/icon.ico` and are wired into the executable and NSIS installer/uninstaller.

## Test Index

| Test file | Covers |
| --- | --- |
| `src/lib/neteasePlaylist.test.ts` | Netease playlist `trackIds` completeness, track detail merging, playlist limit parsing |
| `src/lib/audioFrameCache.test.ts` | AudioEngine single-frame analysis cache and analyser read deduplication |
| `src/lib/themes.test.ts` | Custom theme normalization, legacy rear-backdrop defaults, and independent backdrop color mapping |
| `src/lib/themeShader.test.ts` | Shader brightness color derives from custom cool color and far-distance backdrop blend derives from `uFogColor` |
| `src/lib/groundEqSettings.test.ts` | 8-band ground effects defaults, motion speed defaults/clamping, legacy curve migration, per-band scaling |
| `src/lib/neteaseCookie.test.ts` | Netease cookie cleaning, storage, request headers |
| `src/lib/qqCookie.test.ts` | QQ cookie cleaning, login state, storage, request headers |
| `src/lib/qqMusicLibrary.test.ts` | QQ playlist detection, playlist filtering, song mapping, track limit parsing, quality candidates |
| `src/lib/updateSource.test.ts` | Update source normalization |
| `src/lib/triggerSettings.test.ts` | Pulse/meteor trigger settings import/export |
| `src/lib/presetTransfer.test.ts` | Preset package normalization, cookie exclusion, playlist migration |

## Common Change Recipes

### Fix Netease Playlist Counts

1. Reproduce against `/api/netease/playlist?id=<id>&limit=all`.
2. Check whether upstream `playlist.tracks.length` is smaller than `playlist.trackCount`.
3. If so, use `playlist.trackIds` and batch `/api/song/detail`; do not rely on `playlist.tracks`.
4. Do not pre-filter playlist lists by playable URL. The list should show the playlist contents; playback failure is handled when the user plays a song.
5. Update `server/netease-library.mjs` and `src/lib/neteasePlaylist.test.ts`.
6. Keep `vite.config.ts` and `local-server.mjs` behavior identical.
7. Run `npx tsx src/lib/neteasePlaylist.test.ts`, `npm run lint`, and `npm run build`.

### Change QQ Personal Library

1. Modify `server/qq-music.mjs`.
2. Update `src/lib/qqMusicLibrary.test.ts`.
3. Update `src/components/UI/UI.tsx` if the panel or search provider changes.
4. Run `npx tsx src/lib/qqMusicLibrary.test.ts`, `npx tsx src/lib/qqCookie.test.ts`, `npm run lint`, and `npm run build`.

### Change Account Login

1. Check `desktop/main.js` login windows and cookie polling.
2. Check `desktop/preload.cjs` IPC exposure.
3. Update account UI in `src/components/UI/UI.tsx`.
4. Update cookie helpers and tests as needed.
5. Verify with real QR login in Electron.

### Change Ground Effects Mixer

1. Update `src/lib/groundEqSettings.ts` for data model changes.
2. Update `src/components/UI/UI.tsx` for the mixer UI.
3. Update `src/components/AudioVisualizer/MapScene.tsx` for band-to-shader mapping.
4. If the stored model changes, update preset import/export normalization in `src/lib/presetTransfer.ts` tests.
5. Keep exactly 8 direct frequency controls unless `AudioEngine` and `CustomShaderMaterial` add more direct frequency uniforms. Global `motionSpeed` controls terrain response smoothing only.
6. Run `npx tsx src/lib/groundEqSettings.test.ts`, `npx tsx src/lib/presetTransfer.test.ts`, `npm run lint`, and `npm run build`.

## Local Verification Commands

```powershell
npx tsx src/lib/neteasePlaylist.test.ts
npx tsx src/lib/audioFrameCache.test.ts
npx tsx src/lib/themes.test.ts
npx tsx src/lib/themeShader.test.ts
npx tsx src/lib/groundEqSettings.test.ts
npx tsx src/lib/neteaseCookie.test.ts
npx tsx src/lib/qqCookie.test.ts
npx tsx src/lib/qqMusicLibrary.test.ts
npx tsx src/lib/updateSource.test.ts
npx tsx src/lib/triggerSettings.test.ts
npx tsx src/lib/presetTransfer.test.ts
npm run lint
npm run build
npm run dev:electron
npm run build:electron:dir
```

## Search Shortcuts

```powershell
rg -n "collectNeteasePlaylistTrackIds|fetchNeteaseSongDetails|getPlaylistPlayableSongs|trackIds" server vite.config.ts local-server.mjs src
rg -n "groundEqSettings|applyGroundEqBandValue|GroundEqPanel|uSubBass|uAir" src
rg -n "uCoolCore|uWarmCore|uRippleColor|uFogColor|fogLinkedToBackground|brightCool|createCustomThemeColors" src
rg -n "effectiveSearchProvider|searchNetease|loadNeteaseSong|songIdentity|/api/netease|/api/qq" src vite.config.ts local-server.mjs server
rg -n "handleQQUserPlaylists|handleQQPlaylistTracks|normalizeQQPlaylistTrackLimit|mapQQPlaylist" server src
rg -n "sonicDesktop|openNeteaseLogin|openQQLogin|Cookie" desktop src server
rg -n "wallpaper|capture|build:go|build:wallpaper|sonicserver|cmd/sonic-topography" .
```

## Known Runtime Notes

- Electron is the only formal packaging direction. Go single EXE, Wallpaper Engine, and system-audio capture are not product routes.
- Windows installer output is produced by `npm run build:electron` under `release/`. Publish that setup `.exe` as a GitHub Release asset; pushing code alone does not publish an app update.
- Do not bulk delete files or directories. If a directory must be cleared, ask the user to do it manually.
- In Electron dev mode, `src/` usually hot reloads. Changes to `desktop/main.js`, `desktop/preload.cjs`, `server/*.mjs`, `vite.config.ts`, or `local-server.mjs` may require restarting `npm run dev:electron`.
- Packaged mode starts `local-server.mjs` from `desktop/main.js`, usually on port `45437`.
- Cloud music playback can be affected by copyright, membership, region, account status, and upstream API changes.
