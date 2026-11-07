# Feature Catalog & Direct Code Anchors (`FEATURES.md`)
> **1-Line Summary:** Comprehensive inventory of active features with direct code anchors, line/area ranges, and grep targets.

For complete product requirements and user experience intent, see [`docs/PRODUCT.md`](PRODUCT.md).

---

## Active Feature Catalog

### 1. Linked Audio/Video Playback & Master Audio Clock
* **Description:** Audio stays the single master clock and sound source; the video plays muted and slave-synced with drift correction (>0.75s). Switching audio⇄video introduces no audible gap or stream re-buffering.
* **Code Anchors:**
  * [`src/renderer/components/lyric/MusicFull.vue`](../src/renderer/components/lyric/MusicFull.vue) — `enterVideoMode`, `syncVideoSlaveState`, `videoPillBadge`
  * [`src/renderer/store/modules/playerCore.ts`](../src/renderer/store/modules/playerCore.ts) — `setPlaybackMode`
  * [`src/renderer/services/mediaCoordinator.ts`](../src/renderer/services/mediaCoordinator.ts) — `toggleActiveNonAudioPlayback`

### 2. Per-Song Media Reset & Unified Play State
* **Description:** Every play/pause button controls whichever surface owns playback. All media states (video stream, codec quality, mode pill) synchronously reset when a new track starts.
* **Code Anchors:**
  * [`src/renderer/services/playbackController.ts`](../src/renderer/services/playbackController.ts) — `playTrack`
  * [`src/renderer/store/modules/playerCore.ts`](../src/renderer/store/modules/playerCore.ts) — `resetMediaStateForNewSong`, `setIsPlay`, `handlePause`
  * [`src/renderer/hooks/usePlaybackControl.ts`](../src/renderer/hooks/usePlaybackControl.ts) — `playMusicEvent`

### 3. Per-Codec Video Ladder & Video-Only Downloads
* **Description:** Video streams and downloads request video-only tracks (`-f bestvideo`, no duplicate audio). Formats are normalized by height and codec (`1080p | mp4 • av01 • 2500 kb/s`).
* **Code Anchors:**
  * [`src/main/modules/youtubeFormats.ts`](../src/main/modules/youtubeFormats.ts) — `mapAndGroupFormats`, `normalizeCodec`
  * [`src/renderer/utils/videoQualityHelpers.ts`](../src/renderer/utils/videoQualityHelpers.ts) — `formatQualityRow`, `getUniqueVideoHeights`
  * [`src/renderer/components/player/VideoSourcePopover.vue`](../src/renderer/components/player/VideoSourcePopover.vue) — `downloadVideoQuality`, `downloadedVariantFor`
  * [`src/main/modules/youtube.ts`](../src/main/modules/youtube.ts) — `downloadMedia`, `getStreamUrl`

### 4. Synced Lyrics with Responsive Layout & Edit LRC
* **Description:** LRCLIB synced lyrics with word-by-word karaoke highlighting. Side column layout on wide viewports (≥1024px) and 3-line scrollable click-to-seek strip under artwork on narrow viewports. In-player Edit LRC with +/- 0.1s nudge buttons.
* **Code Anchors:**
  * [`src/renderer/components/lyric/MusicFull.vue`](../src/renderer/components/lyric/MusicFull.vue) — `underArtworkLyricLines`, `lineTimeLabel`, `showUnderArtworkLyrics`
  * [`src/renderer/components/lyric/LyricEditorModal.vue`](../src/renderer/components/lyric/LyricEditorModal.vue) — `nudgeLine`, `saveEditedLrc`
  * [`src/renderer/hooks/MusicHook.ts`](../src/renderer/hooks/MusicHook.ts) — lyric sync and tray notifications

### 5. Unified Song Variants & Local Fingerprint Library
* **Description:** Dexie IndexedDB stores audio files, bitrates, and video files as variants of a single song identity based on title and artist, with acoustic fingerprint deduplication.
* **Code Anchors:**
  * [`src/renderer/utils/db.ts`](../src/renderer/utils/db.ts) — Dexie schema & variant relations
  * [`src/renderer/services/songLibrary.ts`](../src/renderer/services/songLibrary.ts) — variant resolution and library sync

### 6. Native Tag & Metadata Repair
* **Description:** In-player metadata repair fetching artwork and tags from iTunes Search, MusicBrainz, and Cover Art Archive, with native ID3v2, Vorbis, and MP4 atom writing.
* **Code Anchors:**
  * [`src/main/modules/tagAndMetadataManager.ts`](../src/main/modules/tagAndMetadataManager.ts) — tag reading and writing per format
  * [`src/renderer/components/player/SongMetadataModal.vue`](../src/renderer/components/player/SongMetadataModal.vue) — editor dialog UI
