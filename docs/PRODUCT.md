# Product Intent & Feature Map (`PRODUCT.md`)

> **1-Line Summary:** The permanent source of truth for what the user wants the app to do and feel like, independent of how the code is currently implemented.

## 1. Core Vision & User Experience Intent

- **What This App Does (Plain English):** Music Manager is a local-first Windows desktop music player. It plays your own audio files and their linked music videos as one song, with synced lyrics, one queue, and no account or cloud library. Bundled `yt-dlp` + `ffmpeg` find and store video/audio; everything matches to a single song identity built from artist and title.
- **How It Must Feel to Use:** Instant local playback; audio, video, lyrics and the progress bar always share one clock and never disagree; no double audio ever; clean light and dark themes with strong contrast; fully usable offline for local files.

## 2. Active Features (Do Not Break)

### [FEATURE: Linked-AV-Playback] | Aliases: video mode, audio video toggle, linked video, video pill, muted video

> **1-Line Summary:** The song's audio always plays the sound while the video shows the picture muted beside it, so switching audio⇄video never interrupts anything.

- **User Intention (Non-Negotiable):** Audio and video must be linked, not competing. The video file should carry no audio at all; the audio file is the only sound source and the master clock.
- **Visual / UI Behavior:** Bottom-left pill in the fullscreen player shows `Video • 360p` or `Audio • 128 kb/s` and toggles mode instantly with no gap.
- **Code Anchors (Grep Targets):**
  - `src/renderer/components/lyric/MusicFull.vue` -> `enterVideoMode`, `syncVideoSlaveState`, `videoPillBadge`
  - `src/renderer/composables/useLinkedMediaSync.ts` -> `useLinkedMediaSync`, `enforceSyncTick`
  - `src/renderer/store/modules/playerCore.ts` -> `setPlaybackMode`

### [FEATURE: One-Play-State-For-Every-Button] | Aliases: play button, pause desync, play/pause sync, big button

> **1-Line Summary:** Every play/pause button reflects the real audible state and controls whichever surface is actually playing.

- **User Intention (Non-Negotiable):** The button must never show "paused" while sound plays, and one click must stop everything (audio, video, MV drawer).
- **Visual / UI Behavior:** Identical play/pause icons on the PlayBar, fullscreen player, mini bars and stacked layout.
- **Code Anchors (Grep Targets):**
  - `src/renderer/hooks/usePlaybackControl.ts` -> `playMusicEvent`
  - `src/renderer/store/modules/playerCore.ts` -> `setIsPlay`, `handlePause`
  - `src/renderer/services/mediaCoordinator.ts` -> `toggleActiveNonAudioPlayback`

### [FEATURE: Per-Song-Media-Reset] | Aliases: next song bug, old artwork stays, stale video, track change reset

> **1-Line Summary:** Pressing next/previous fully drops the old song's video, artwork and mode, so nothing carries over to the new song.

- **User Intention (Non-Negotiable):** Media is matched by song ID; a song without a video must never show the previous song's video or picture.
- **Visual / UI Behavior:** The video frame, quality selection and mode pill reset the instant the track changes.
- **Code Anchors (Grep Targets):**
  - `src/renderer/services/playbackController.ts` -> `playTrack`
  - `src/renderer/store/modules/playerCore.ts` -> `resetMediaStateForNewSong`
  - `src/renderer/components/lyric/MusicFull.vue` -> `resetVideoStateForNewSong`

### [FEATURE: Per-Codec-Video-Qualities] | Aliases: qualities tab, quality list, video source, codec rows, download video

> **1-Line Summary:** The video source menu lists one row per height AND codec with real bitrate and a single size badge, downloads video-only files, and shows tick/delete/speed states.

- **User Intention (Non-Negotiable):** Size must appear once per row; codec must be visible so different variants can be chosen; finished downloads get a green tick and a delete button; the audio row shows its real bitrate.
- **Visual / UI Behavior:** "Video Source & Media" dialog → Qualities tab: rows like `1080p | mp4 • av01 • 2500 kb/s | 45.2 MB`.
- **Code Anchors (Grep Targets):**
  - `src/main/modules/youtubeFormats.ts` -> `mapAndGroupFormats`, `normalizeCodec`
  - `src/renderer/utils/videoQualityHelpers.ts` -> `formatQualityRow`, `getUniqueVideoHeights`
  - `src/renderer/components/player/VideoSourcePopover.vue` -> `downloadVideoQuality`, `downloadedVariantFor`

### [FEATURE: Synced-Lyrics-With-Responsive-Layout] | Aliases: lyrics panel, lyric column, mini lyrics, line times, under artwork, widescreen split

> **1-Line Summary:** Lyrics and Up Next Queue share a 50/50 side column when the window is wide (>=960px), or lyrics collapse to a scrollable click-to-seek strip under the artwork when narrow, with each line's start time visible.

- **User Intention (Non-Negotiable):** The lyric column must never drop broken below the player; the current line must appear exactly once; clicking a line seeks; `mm:ss,ms` start times stay visible; switching between Lyrics and Up Next Queue keeps playback uninterrupted.
- **Visual / UI Behavior:** 50/50 desktop split >=960px (track header + baked-glow artwork + waveform transport on the left, segmented Lyrics/Queue pane on the right); below 960px a 3-line strip under the artwork/video; toggleable per-line timestamps in the lyric settings.
- **Code Anchors (Grep Targets):**
  - `src/renderer/components/lyric/MusicFull.vue` -> `underArtworkLyricLines`, `lineTimeLabel`, `showUnderArtworkLyrics`, `rightPaneTab`, `onQueueDrop`
  - `src/renderer/types/lyric.ts` -> `LyricConfig`

### [FEATURE: Edit-LRC-Editor] | Aliases: edit lrc, lyric editor, timestamps, lrc sync, tap timestamp

> **1-Line Summary:** "Edit LRC" opens the raw LRC with millisecond timestamps, per-line ±0.1s nudges and live playback following, and applies edits to the player instantly.

- **User Intention (Non-Negotiable):** The user must be able to fix mismatched auto-found lyrics while watching the times change live, and see the first lyric's start time next to the seek bar.
- **Visual / UI Behavior:** Button at the bottom of the lyric section; editor rows show `[mm:ss.xxx]` timestamps with nudge buttons and preview-seek.
- **Code Anchors (Grep Targets):**
  - `src/renderer/components/lyric/MusicFull.vue` -> `handleApplyEditedLrc`, `rawLrcString`
  - `src/renderer/components/common/LrcSynchronizerModal.vue` -> `nudgeLine`, `commitTimestampEdit`
  - `src/renderer/utils/lyrics.ts` -> `formatLrcTimestamp`, `formatLrcTimestampMs`, `parseLrcTimestamp`

### [FEATURE: Lyric-Timing-Offset-Control] | Aliases: offset, minus plus, lyric shift, correction, reset icon

> **1-Line Summary:** A uniform-sized − / reset / + control with Remove/Add labels and a manual ±seconds input shifts lyrics live per song.

- **User Intention (Non-Negotiable):** All controls one size, a proper reset icon (not a clickable label), and a manual input where 0.1 means 0.1 s and 1 means 1 s, positive or negative.
- **Visual / UI Behavior:** Bottom-right of the lyric area; remembered per song.
- **Code Anchors (Grep Targets):**
  - `src/renderer/components/lyric/LyricCorrectionControl.vue` -> `nudge`, `reset`, `applyDraft`
  - `src/renderer/hooks/MusicHook.ts` -> `setCorrectionTime`, `correctionTimeMap`

### [FEATURE: Lyric-Search-Match-Badges] | Aliases: lyric search, lrc search, match picker, length match, offset badge

> **1-Line Summary:** Online lyric search shows every candidate with length-match and start-offset badges so the user can pick the version closest to their file.

- **User Intention (Non-Negotiable):** Never silently trust one match; show `length ✓` or `Δ ±Xs` versus the file, plus where the lyrics start.
- **Visual / UI Behavior:** "Lyric Matches" picker in the track editor after an LRCLIB fetch.
- **Code Anchors (Grep Targets):**
  - `src/main/modules/tagAndMetadataManager.ts` -> `lrcTimeBounds`
  - `src/renderer/components/common/LocalTrackEditorModal.vue` -> `applyLyricCandidate`, `formatCandidateOffset`

### [FEATURE: Audio-Video-Length-Mismatch-Warning] | Aliases: length warning, different version, glass warning

> **1-Line Summary:** A glass banner warns when the linked video and the audio file have different lengths, which means different versions.

- **User Intention (Non-Negotiable):** Quality may differ but length must roughly match; a mismatch means lyric sync will suffer, so say so.
- **Visual / UI Behavior:** Top-center glassmorphism banner in the fullscreen player; auto-hides after a few seconds.
- **Code Anchors (Grep Targets):**
  - `src/renderer/components/lyric/MusicFull.vue` -> `checkMediaLengthMismatch`, `lengthMismatchWarning`

### [FEATURE: Save-To-Disk-Batches] | Aliases: save to disk, save audio, save video, save lrc, saved tick

> **1-Line Summary:** Save Audio / Save Video / Save Lyrics have checkboxes for one-shot batch saving, persistent green "Saved" ticks, and duplicate prevention.

- **User Intention (Non-Negotiable):** The user must see what was saved and at which quality, never accidentally save the same item twice, and never wonder if a save was cancelled.
- **Visual / UI Behavior:** "Save to Disk" dialog: per-row checkboxes, `Saved • 480p` ticks, a "Save Selected" button, and a "n saved" summary chip.
- **Code Anchors (Grep Targets):**
  - `src/renderer/components/player/SaveToDiskModal.vue` -> `saveSelected`, `markSaved`, `pendingSelectedCount`

### [FEATURE: In-Player-Metadata-Editor] | Aliases: edit metadata, edit artwork, rename file, tag editor button

> **1-Line Summary:** The "Edit Metadata, Artwork & Filename" editor is reachable from inside the player, not only from the local music list.

- **User Intention (Non-Negotiable):** Editing tags, artwork, filename and lyrics must not require going back to the library view; for songs without lyrics the editor can add or search them.
- **Visual / UI Behavior:** Edit button on the PlayBar and in the fullscreen control strip; opens the same editor as the list's edit button.
- **Code Anchors (Grep Targets):**
  - `src/renderer/hooks/useLocalTrackEditor.ts` -> `useLocalTrackEditor`
  - `src/renderer/components/common/LocalTrackEditorModal.vue` -> `handleSave`, `handleAutoFetchLyrics`

### [FEATURE: Unified-Song-Library] | Aliases: variants, song identity, duplicates, fingerprint, one song, queues, smart playlists, folders, tags, rating, allowlist

> **1-Line Summary:** Dexie v4 unifies audio/video/lyrics variants with multi-queue snapshots, rule-based smart playlists, folder browser, ratings/moods/tags, excluded subfolders, minimum duration filtering, and artist split exceptions.

- **User Intention (Non-Negotiable):** Each song keeps one canonical identity across variants; queue clears are undoable and queues save across sessions; combined artist names (`Tyler, The Creator`, `Earth, Wind & Fire`, user allowlist) are never falsely split.
- **Visual / UI Behavior:** Local Music page offers `All Tracks`, `Folders`, and `Smart Playlists` tabs, quick queue actions (`Play Next`, `Add to Queue`), Rating/Mood/Tag editor modal, Folder Manager controls (exclusions, min duration, artist allowlist), and PlayingListDrawer Saved Queues + Undo Clear banner.
- **Code Anchors (Grep Targets):**
  - `src/renderer/services/songLibrary.ts` -> `computeNormKey`, `ingestLocalTrack`, `saveNamedQueue`, `saveSmartPlaylist`, `updateSongTagsAndRating`, `evaluateSmartPlaylist`
  - `src/renderer/utils/localMusicUtils.ts` -> `DEFAULT_ARTIST_EXCEPTIONS`, `parseMultiArtists`, `parseMultiGenres`, `getArtistSplitExceptions`, `setArtistSplitExceptions`
  - `src/renderer/views/local-music/index.vue` -> `folderGroups`, `smartMatchedTracks`, `openTagEditor`
  - `src/renderer/components/player/PlayingListDrawer.vue` -> `handleSaveCurrentQueue`, `loadSavedQueue`, `handleUndoClear`

### [FEATURE: Player-Look-And-Feel] | Aliases: stacked player, themes, palette, waveform, fullscreen, ambient canvas, karaoke glow, smtc, media session, pitch black, lexend deca, pill slider, baked glow, frosted mini player, collage

> **1-Line Summary:** A polished Namida-inspired player: `Lexend Deca` typography, dynamic artwork color engine with 5-level Pitch Black mode, Material 3 pill-thumb sliders, `20px` settings cards, 50/50 widescreen & stacked layouts, pre-baked 64x64 artwork glow, WebGL2 ambient shader canvas, frosted glass playbar, hover-reveal floating lyrics, 2x2 collage cards, 3-row track tiles, karaoke word fill, real Dexie-cached acoustic waveform seekbar with seek-poke pulse, and Windows SMTC media controls.

- **User Intention (Non-Negotiable):** Clean visual hierarchy, proportional spacing, strong contrast in both themes (preserving monochrome covers without false oversaturation), 5-level Pitch Black scaling up to pure AMOLED `#000`, real acoustic waveform bars for local files, and native Windows hardware media key / lock-screen controls.
- **Visual / UI Behavior:** 50/50 widescreen or stacked fullscreen layouts with pre-baked 64x64 artwork glow and play/pause artwork scaling; dynamic theme tokens (`--namida-seed`, `--namida-pitch-level`, `--namida-radius-mult`) driving Naive UI overrides, 47%-tinted icons, and `20px` settings cards; frosted glass PlayBar; 2x2 collage cards; 3-row local track tiles; interactive 140-bar waveform seekbar with 54%-width bars and seek-poke spring pulse.
- **Code Anchors (Grep Targets):**
  - `src/renderer/composables/useNamidaTheme.ts` -> `useNamidaTheme`, `extractSeedRgbFromUrl`, `applyNamidaThemeToDocument`
  - `src/renderer/composables/useBakedArtworkGlow.ts` -> `useBakedArtworkGlow`, `bakeArtworkGlow`
  - `src/renderer/utils/namidaThemeEngine.ts` -> `extractSeedRgbFromImageData`, `computeNamidaCssVars`, `buildNaiveThemeOverrides`
  - `src/renderer/utils/waveformHelpers.ts` -> `computeSeekPokeScale`, `dedupeArtworkCovers`
  - `src/renderer/styles/namida.css` -> `:root`, `.n-slider`, `.namida-karaoke-word`
  - `src/renderer/views/set/SettingSection.vue` -> `.namida-settings-card`
  - `src/renderer/components/namida/NamidaAmbientCanvas.vue` -> `renderLoop`, `hexToRgbNormalized`
  - `src/renderer/components/namida/NamidaWaveformSeekbar.vue` -> `onPointerDown`, `onPointerUp`, `normalizedPeaks`, `triggerPoke`
  - `src/renderer/components/namida/MultiArtworkCard.vue` -> `gridTiles`
  - `src/renderer/components/player/NamidaStackedPlayer.vue` -> `currentLyricSub`
  - `src/renderer/components/player/PlayBar.vue` -> `drawLiveWaveform`
  - `src/renderer/views/lyric/index.vue` -> `showControls`, `handleMouseEnter`
  - `src/renderer/views/local-music/LocalTrackRow.vue` -> `subtitleLine`, `formatBadge`
  - `src/renderer/services/osMediaSession.ts` -> `bindOsMediaSessionHandlers`, `updateOsMediaMetadata`
  - `src/renderer/services/songLibrary.ts` -> `getOrComputeWaveformPeaks`
  - `src/main/modules/audioFingerprint.ts` -> `computeWaveformPeaks`, `computePeaksFromPcm`
  - `src/renderer/utils/linearColor.ts` -> `extractVibrantPalette`, `applyDynamicPaletteToRoot`
  - `src/renderer/utils/lyrics.ts` -> `getWordFillProgress`

### [FEATURE: Audio-Enhancements] | Aliases: crossfade, equalizer, autoeq, parametric eq, preamp, mono, preservespitch, gapless, skip silence, A-B loop, bookmarks

> **1-Line Summary:** 10-band graphic EQ + AutoEQ parametric filters, Preamp gain, Mono downmix, pitch-preserving playback rate, gapless next-track pre-buffering, equal-power crossfade, skip-silence, A-B loop repeat, and per-track bookmarks.

- **User Intention (Non-Negotiable):** Audiophile DSP controls (AutoEQ `.txt` import, Preamp, Mono, `preservesPitch`, gapless warm standby) live cleanly inside `AudioDspGraph` without duplicating `MediaElementAudioSourceNode` or breaking play/pause responsiveness.
- **Visual / UI Behavior:** Advanced controls popover, upgraded EQ modal (Preamp slider, Mono/Preserve-Pitch switches, AutoEQ `.txt` upload/paste drawer, active parametric filter readout), Playback settings toggles, and A-B pill on the PlayBar.
- **Code Anchors (Grep Targets):**
  - `src/renderer/services/audioDspGraph.ts` -> `AudioDspGraph`, `parseAutoEqProfile`, `audioDspGraph`
  - `src/renderer/services/audioService.ts` -> `fadeInVolume`, `prepareGaplessNext`, `getSignalPathInfo`, `setAbLoopPointA`, `setAbLoopPointB`
  - `src/renderer/components/EQControl.vue` -> `applyPastedAutoEq`, `handleAutoEqFileUpload`, `resetParametricToGraphic`

### [FEATURE: Library-Backup-And-Stats] | Aliases: m3u8 backup, json backup, listening stats, history, listen threshold, scrobble delete

> **1-Line Summary:** Export/restore M3U8 playlists and JSON library snapshots, plus configurable listen-threshold scrobbling and per-entry history deletion.

- **User Intention (Non-Negotiable):** The library must survive reinstalls; stats stay local with no telemetry, quick skips never pollute play counts, and accidental plays can be deleted individually.
- **Visual / UI Behavior:** "M3U8 / Backup" toolbar menu in Local Music; stats modal from the PlayBar with `Min Sec` / `Min %` scrobble threshold controls and delete buttons on Top Tracks and Recent History rows.
- **Code Anchors (Grep Targets):**
  - `src/main/modules/tagAndMetadataManager.ts` -> `library:export-m3u8`, `library:import-backup-json`
  - `src/renderer/services/listeningStatsService.ts` -> `addListeningSeconds`, `recordTrackPlay`, `shouldRecordPlayThreshold`, `removeScrobbleEntry`, `removeTrackStat`
  - `src/renderer/components/player/ListeningStatsModal.vue` -> `saveThresholdConfig`, `handleDeleteScrobble`, `handleDeleteTrack`

### [FEATURE: Power-UX-Seekbar-Markers-And-Command-Palette] | Aliases: sponsorblock, chapters, seekbar markers, settings search, command palette, ctrl+k, signal path

> **1-Line Summary:** Waveform seekbar overlays (A-B loop spans/ticks, clickable bookmarks, SponsorBlock segments & YouTube chapters), live all-tabs settings search, native `<dialog>` `Ctrl+K` Command Palette with lyric-snippet matching, and Live Audio Signal Path diagnostics.

- **User Intention (Non-Negotiable):** Power users can jump anywhere via `Ctrl+K` (including searching lyrics), filter every setting tab simultaneously, see A-B loop/bookmark/SponsorBlock markers directly on the waveform, optionally auto-skip non-music YouTube segments, and inspect the live DSP audio signal path in one glance.
- **Visual / UI Behavior:** Translucent A-B loop span + `A`/`B` ticks, amber bookmark pins, color-coded SponsorBlock/chapter bars on `NamidaWaveformSeekbar`; header search input in Settings revealing all matching items across all tabs; native top-layer `<dialog>` `Ctrl+K` palette; Live Audio Signal Path badge chain in `DiagnosticsModal`.
- **Code Anchors (Grep Targets):**
  - `src/renderer/services/sponsorBlockService.ts` -> `fetchSponsorBlockSegments`, `parseChaptersFromDescription`, `findActiveSkipSegment`
  - `src/renderer/components/namida/NamidaWaveformSeekbar.vue` -> `abLoopOverlay`, `renderedBookmarks`, `renderedSegments`
  - `src/renderer/views/set/index.vue` -> `settingsSearchQuery`, `isSearchingSettings`
  - `src/renderer/views/set/SettingItem.vue` -> `matchesSearch`
  - `src/renderer/utils/commandPaletteHelpers.ts` -> `searchCommandPaletteItems`, `extractLyricSnippet`
  - `src/renderer/components/namida/CommandPalette.vue` -> `openPalette`, `executeItem`
  - `src/renderer/components/player/DiagnosticsModal.vue` -> `signalPath`, `refreshSignalPath`

## 3. Planned Features & App-Merge Wishlist

### [WISHLIST: Cloud-Built-Releases] | Aliases: github actions, cloud build, releases, tag build, portable and installer

> **1-Line Summary:** Version tags trigger a GitHub Actions build that attaches both the portable `.exe` and the NSIS installer to the release, instead of storing builds locally.

- **User Intention:** Keep GitHub as the single source of truth; no heavy binaries in git history; every release offers both formats.
- **Target Integration Point:** `.github/workflows/build.yml` → `build:portable` + `build:installer`.

### [WISHLIST: Desktop-GUI-Verification] | Aliases: manual checklist, real desktop test, gui check

> **1-Line Summary:** Run the manual desktop verification checklist against a fresh portable build, since the agent sandbox cannot launch the GUI.

- **User Intention:** Prove playback, linked video, lyric editing and save flows visually before wider use.
- **Target Integration Point:** The manual checklist in `docs/legacy/HANDOFF.md` §3.3; `npm run build:portable` artifact.

### [WISHLIST: Smaller-Portable-Through-Pruning] | Aliases: size reduction, dependency pruning, smaller exe

> **1-Line Summary:** Reduce `app.asar` weight by proving duplicate or unused dependencies unreferenced before removing them.

- **User Intention:** A leaner download without losing functionality.
- **Target Integration Point:** `package.json` production dependency tree.

### [WISHLIST: Installer-Verification-On-Real-Machine] | Aliases: nsis installer, setup exe, install test

> **1-Line Summary:** Install and uninstall the NSIS setup once on a real machine to confirm shortcuts and clean removal.

- **User Intention:** Portable stays the default; the installer is optional convenience and must cleanly uninstall.
- **Target Integration Point:** `MusicManager-v<version>-Setup.exe` from the cloud release.
