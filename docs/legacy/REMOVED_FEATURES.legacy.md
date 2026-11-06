# Removed Features Manifest (Music Manager v5.2)

This document tracks all features, views, routes, components, language packs, and IPC modules removed during the v5.2 De-China cleanup, English-only localization, and rebrand.

**Upstream Base Commit**: `319e7d2`  
**Upstream Repository**: [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer)  
**Date**: November 2026  

---

## 1. Summary of Removals

In Music Manager v5.2, Chinese cloud-dependent services, Netease account login mechanisms, non-English localization packs, and promotional/donation modules were deleted to produce a lean, privacy-focused, English-first desktop music player centered around local files and direct media sources (YouTube in Phase 2).

### Preserved Features
- **Core Player & Pipeline**: Play bar, fullscreen lyrics, audio visualizer, sleep timer, equalizer, playback controller, and `api/music.ts`.
- **Primary Views**: Home (clean greeting & continue listening), Search (direct query), Local Music, History, Favorites, Downloads, and Settings.
- **Audio Tools**: Local track editor, metadata managers, and LRC synchronizer.

---

## 2. Inventory of Removed Files & Components

| Original Path | Category | Purpose | Upstream Hash |
| :--- | :--- | :--- | :--- |
| `src/main/modules/loginWindow.ts` | Main Process | Electron browser window to capture Netease Web login cookies (`MUSIC_U`) | `319e7d2` |
| `src/renderer/views/login/index.vue` | View | Main login view with QR, cellphone, cookie, and UID tabs | `319e7d2` |
| `src/renderer/components/login/CookieLogin.vue` | Component | Cookie input form for manual session authentication | `319e7d2` |
| `src/renderer/components/login/QrLogin.vue` | Component | Netease QR code polling for mobile app authorization | `319e7d2` |
| `src/renderer/components/login/UidLogin.vue` | Component | User ID query login mode | `319e7d2` |
| `src/renderer/components/settings/CookieSettingsModal.vue` | Component | Cookie/token modal in basic settings | `319e7d2` |
| `src/renderer/views/toplist/index.vue` | View | Netease official & global chart ranking discovery feed | `319e7d2` |
| `src/renderer/views/podcast/index.vue` | View | Netease DJ radio / podcast discovery feed | `319e7d2` |
| `src/renderer/views/podcast/radio.vue` | View | Podcast radio program details & episode list | `319e7d2` |
| `src/renderer/views/user/index.vue` | View | User profile page, cloud playlists, and listening records | `319e7d2` |
| `src/renderer/views/user/detail.vue` | View | Public user details, following count, and created playlists | `319e7d2` |
| `src/renderer/views/user/followers.vue` | View | User followers list | `319e7d2` |
| `src/renderer/views/user/follows.vue` | View | User following list | `319e7d2` |
| `src/renderer/views/mv/index.vue` | View | Netease MV discovery feed with region tabs (Mainland, HK/TW, Japan, Korea) | `319e7d2` |
| `src/renderer/views/list/index.vue` | View | Netease playlist categories & discovery feed | `319e7d2` |
| `src/renderer/views/album/index.vue` | View | Netease new albums discovery feed | `319e7d2` |
| `src/renderer/views/home/components/HomeHero.vue` | Component | Home recommendation banner carousel and Netease shortcuts | `319e7d2` |
| `src/renderer/views/home/components/HomeAlbumSection.vue` | Component | Home new album recommendation shelf | `319e7d2` |
| `src/renderer/views/home/components/HomeArtists.vue` | Component | Home recommended artists horizontal scroll list | `319e7d2` |
| `src/renderer/views/home/components/HomeDailyRecommend.vue` | Component | Daily personalized track recommendations | `319e7d2` |
| `src/renderer/views/home/components/HomeNewSongs.vue` | Component | Home new songs recommendation section | `319e7d2` |
| `src/renderer/views/home/components/HomePlaylistSection.vue` | Component | Home personalized playlist recommendation grid | `319e7d2` |
| `src/renderer/views/home/components/HomePrivateContent.vue` | Component | Netease exclusive radar & private content cards | `319e7d2` |
| `src/renderer/views/home/components/NavCard.vue` | Component | Home navigation quick card | `319e7d2` |
| `src/renderer/views/music/HistoryRecommend.vue` | View | Historical daily recommendations view | `319e7d2` |
| `src/renderer/components/Coffee.vue` | Component | Buy Me a Coffee sponsor popover with Alipay/WeChat QR codes | `319e7d2` |
| `src/renderer/components/common/DonationList.vue` | Component | Donor list and sponsor recognition viewer | `319e7d2` |
| `src/renderer/views/set/tabs/DonationTab.vue` | Component | Donation and sponsor tab in Settings view | `319e7d2` |
| `src/renderer/api/donation.ts` | API | HTTP requests to upstream donation API | `319e7d2` |
| `src/renderer/assets/alipay.png` | Asset | Alipay donation QR code image | `319e7d2` |
| `src/renderer/assets/wechat.png` | Asset | WeChat Pay donation QR code image | `319e7d2` |
| `src/renderer/assets/gzh.png` | Asset | WeChat official account QR code image | `319e7d2` |
| `src/i18n/lang/zh-CN/*` | Localization | Simplified Chinese language pack (15 files) | `319e7d2` |
| `src/i18n/lang/zh-Hant/*` | Localization | Traditional Chinese language pack (15 files) | `319e7d2` |
| `src/i18n/lang/ja-JP/*` | Localization | Japanese language pack (15 files) | `319e7d2` |
| `src/i18n/lang/ko-KR/*` | Localization | Korean language pack (15 files) | `319e7d2` |

---

## 3. Removed Routes

| Route Path | Route Name | Former Target View | Notes |
| :--- | :--- | :--- | :--- |
| `/login` | `login` | `src/renderer/views/login/index.vue` | Deleted from `router/index.ts` |
| `/toplist` | `toplist` | `src/renderer/views/toplist/index.vue` | Deleted from `router/home.ts` |
| `/podcast` | `podcast` | `src/renderer/views/podcast/index.vue` | Deleted from `router/home.ts` |
| `/podcast/radio/:id` | `podcastRadio` | `src/renderer/views/podcast/radio.vue` | Deleted from `router/other.ts` |
| `/user` | `user` | `src/renderer/views/user/index.vue` | Deleted from `router/home.ts` |
| `/user/follows` | `userFollows` | `src/renderer/views/user/follows.vue` | Deleted from `router/other.ts` |
| `/user/followers` | `userFollowers` | `src/renderer/views/user/followers.vue` | Deleted from `router/other.ts` |
| `/user/detail/:uid` | `userDetail` | `src/renderer/views/user/detail.vue` | Deleted from `router/other.ts` |
| `/mv` | `mv` | `src/renderer/views/mv/index.vue` | MV discovery page deleted; `components/MvPlayer.vue` preserved |
| `/list` | `list` | `src/renderer/views/list/index.vue` | Discovery feed deleted from `router/home.ts` |
| `/album` | `album` | `src/renderer/views/album/index.vue` | Discovery feed deleted from `router/home.ts` |
| `/history-recommend` | `historyRecommend` | `src/renderer/views/music/HistoryRecommend.vue` | Deleted from `router/other.ts` |

---

## 4. UI Cleanups & Modifications

1. **TitleBar & Header**:
   - Removed external download/donation button (`http://donate.alger.fun/download`).
   - Replaced brand text "Alger" with "Music Manager".
   - Removed upstream GitHub links and author URLs.
2. **SearchBar**:
   - Replaced anime user avatar and "Login" / "To Login" label with a clean Settings/Menu popover.
   - Removed hot-search keywords and Chinese suggestions autocomplete.
   - Removed Coffee donation trigger and GitHub release links.
   - Replaced discovery tabs with `Home`, `Local Music`, `History`, `Favorites`.
3. **Settings**:
   - Removed "Donation" tab.
   - Removed author information and GitHub sponsor links from "About" tab.
   - Removed manual Netease token/cookie management from "Basic" tab.
   - Fixed default locale strictly to `en-US` (`src/main/set.json` and `src/i18n/languages.ts`).
4. **App Popups & Modals**:
   - Removed 20-second donation drawer (`TrafficWarningDrawer.vue`).
   - Removed post-disclaimer donation popup (`DisclaimerModal.vue`).

---

## 5. How to Merge Upstream Updates Selectively

When upstream [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) releases new commits, follow this workflow to incorporate fixes without restoring deleted Chinese or cloud features:

### Step 1: Fetch and Identify Changes
```bash
git remote add upstream https://github.com/algerkong/AlgerMusicPlayer.git
git fetch upstream
git log --oneline 319e7d2..upstream/main
```

### Step 2: Use Path-Filtered Cherry-Picks
Do not run a broad `git merge upstream/main`. Instead, selectively cherry-pick or apply patches only to retained files:
- Allowed paths: `src/main/modules/mpris.ts`, `src/renderer/components/player/*`, `src/renderer/components/lyric/*`, `src/renderer/utils/lyrics.ts`, `src/renderer/hooks/MusicHook.ts`, electron build scripts.
- Ignored paths: Any commit touching `src/renderer/views/{login,toplist,podcast,user,mv,list,album}`, `src/i18n/lang/{zh-CN,zh-Hant,ja-JP,ko-KR}`, `src/main/modules/loginWindow.ts`, or donation components.

### Step 3: Checkout-Only Merge Strategy
If merging a specific upstream feature commit:
```bash
# 1. Cherry-pick without auto-committing
git cherry-pick -n <commit-hash>

# 2. Re-remove any resurrecting files tracked in this manifest
git checkout HEAD -- src/i18n/languages.ts src/renderer/router/home.ts src/renderer/router/other.ts
git rm -rf --ignore-unmatch src/renderer/views/login src/renderer/views/toplist src/renderer/views/podcast src/renderer/views/user src/main/modules/loginWindow.ts

# 3. Verify typecheck and tests pass
npm run typecheck
npm test
```


---

## 6. Phase 2 Removals: Complete Netease & Legacy Cloud Retirement

In Phase 2, all remaining Netease API endpoints, background servers, unblock proxies, and Chinese cloud metadata fetchers were permanently removed. YouTube is now the sole online streaming, search, and download source, with lyrics provided by LRCLIB and local library indexing managed by the unified IndexedDB song database (`songLibrary`).

### Summary of Phase 2 Removals

| Component / File | Category | Original Purpose / Notes | Upstream Hash |
| :--- | :--- | :--- | :--- |
| `src/main/server.ts` | Main Process | Local HTTP server running `netease-cloud-music-api-alger` on port 30488 | `319e7d2` |
| `src/main/unblockMusic.ts` | Main Process | Interceptor proxy running `@unblockneteasemusic/server` | `319e7d2` |
| `netease-cloud-music-api-alger` | Dependency | Netease cloud music API server package (removed from `package.json`) | `319e7d2` |
| `@unblockneteasemusic/server` | Dependency | Netease song unblocker package (removed from `package.json`) | `319e7d2` |
| `src/renderer/api/album.ts` | Renderer API | Netease new albums query endpoint | `319e7d2` |
| `src/renderer/api/artist.ts` | Renderer API | Netease artist details, albums, and top songs | `319e7d2` |
| `src/renderer/api/gdmusic.ts` | Renderer API | GD Music station aggregation parser for 126.net streams | `319e7d2` |
| `src/renderer/api/home.ts` | Renderer API | Netease home banners, personalized FM, and recommendations | `319e7d2` |
| `src/renderer/api/list.ts` | Renderer API | Netease playlist categories and details | `319e7d2` |
| `src/renderer/api/login.ts` | Renderer API | QR, phone, cookie, and UID login network requests | `319e7d2` |
| `src/renderer/api/parseFromCustomApi.ts` | Renderer API | Legacy custom API JSON parser | `319e7d2` |
| `src/renderer/api/playlist.ts` | Renderer API | Netease playlist import and task status | `319e7d2` |
| `src/renderer/api/podcast.ts` | Renderer API | Netease DJ radio / podcast endpoints | `319e7d2` |
| `src/renderer/api/user.ts` | Renderer API | Netease cloud user listening records and playlists (stubbed offline) | `319e7d2` |
| `src/renderer/views/artist/detail.vue` | View & Route | `/artist/detail/:id` artist detail view | `319e7d2` |
| `src/renderer/views/music/MusicListPage.vue` | View & Route | `/music-list/:id?` Netease cloud playlist/album music list view | `319e7d2` |
| `src/renderer/views/playlist/ImportPlaylist.vue` | View & Route | `/playlist/import` Netease playlist import tool | `319e7d2` |
| `src/renderer/components/common/ArtistDrawer.vue` | Component | Artist discography and top song drawer | `319e7d2` |
| `src/renderer/components/podcast/ProgramList.vue` | Component | Podcast episode list component | `319e7d2` |
| `src/renderer/services/musicSource/providers/builtin.ts` | Music Source | Removed `neteaseProvider`, `gdmusicProvider`, `customApiProvider`, `unblockProviders`; added `youtubeProvider` | `319e7d2` |
| `tests/userAuth.test.ts` | Tests | Netease login auth state tests (deleted) | `319e7d2` |

### Preserved & Rewired in Phase 2
- **Online Music Source**: `youtubeProvider` resolves playable audio/video via `youtubeService.getStreamUrl` with automatic re-resolution upon media error.
- **Search Pipeline**: Rewritten to query YouTube directly with "Songs" (audio) and "Videos" tabs, thumbnail/view/channel display, playback queue actions, and direct audio/video quality downloading.
- **Lyrics Pipeline**: Replaced Netease `/lyric/new` with LRCLIB (`window.api.fetchMultiSourceLyrics`) by title/artist.
- **Unified Library Ingestion**: Local scan debounced batch ingestion into `songLibrary.ingestLocalTrack`, fuzzy duplicate merge notifications, lazy embedded YouTube link parsing, and automatic ingestion of completed downloads.
- **Settings**: Media download folder configuration (`mediaDownloadDir`), path resolution, and YouTube engine status / self-update controls.

---

## 7. Phase 3 Removal: Source-Level English-Only Sweep (v5.3.0)

Phase 2 removed the Chinese *features*, views and locale packs. It did not remove
the Chinese *text inside the remaining source*: comments, log messages, thrown
errors, dialog titles and notification bodies were still Chinese throughout
`src/main` and `src/renderer`.

v5.3.0 completes that work. The sweep is text-only — no behaviour, signature, IPC
channel, route or Dexie schema changed.

### What was swept

| Category | Scope |
| :--- | :--- |
| Source comments | All remaining Chinese comment lines in `src/**` (~3191 lines) |
| Runtime strings | `console.*` diagnostics, `throw new Error(...)`, IPC error payloads (~468 lines) |
| Lyric parser errors | `LyricParseError` messages in `yrcParser.ts` |
| Dialog titles | `dialog.showOpenDialog` titles in `fileManager.ts` and friends |
| Notification bodies | Batch-download and single-download completion toasts |
| Numeric units | `formatNumber()` switched from the Chinese myriad scale (`万`/`亿`) to `M`/`B` |

### Deliberate exemptions

The following CJK content is **intentionally retained**. Do not sweep it.

| Path | Category | Reason |
| :--- | :--- | :--- |
| `src/shared/transliteration.ts` | Data | Pinyin/kana/Bangla romanisation lookup tables. Deleting the Chinese keys breaks transliteration. |
| `src/i18n/lang/**` | Localization | Locale bundle data. Only `en-US` ships, but the files are data, not source text. |
| `src/renderer/utils/lxListParser.ts` | Logic | `HEADER_KEYWORD_RE` matches CJK/Korean/Japanese column headers when importing third-party CSV/M3U playlists. Removing them breaks import of non-English lists. |
| `src/i18n/lang/en-US/settings.ts` → `fontPreview.chineseText` | UI sample | A CJK sample line used to preview font rendering in Settings. It is data, not a translatable label. |

### Regression gate

`.sweep-gate.mjs` at the repo root re-runs the census against the exemption list
above and must report **0 unexplained CJK lines**:

```powershell
cd AlgerMusicPlayer
node .sweep-gate.mjs
```

### Note for upstream rebases

Chinese comments and log strings will reappear whenever the upstream
[AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) commits are
merged. Run `.sweep-gate.mjs` after every upstream merge; the phase-3 workflow
section below explains how to re-apply the sweep.

### Phase 3 sweep workflow (for the next upstream rebase)

1. Translate **runtime strings first** (they are user-visible): `console.*`,
   `throw new Error(...)`, IPC payloads, dialog titles, notification bodies.
2. Then translate **comments**, directory by directory.
3. Never touch the four exempted paths in the table above.
4. **Watch for empty blocks.** A mechanical comment-removal pass will turn
   `catch { // comment }` into `catch {}`, which trips ESLint's `no-empty` and —
   worse — silently drops the only explanation of why an error is swallowed.
   Rewrite such comments in English instead of deleting them. Verify with:
   ```powershell
   npx eslint ./src 2>&1 | Select-String "no-empty"   # must be empty
   ```
5. Re-run `node .sweep-gate.mjs` and confirm 0.
6. Run `npx prettier --write ./src`; mechanical edits collapse indentation.

