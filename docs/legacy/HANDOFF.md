# Handoff — Linked A/V playback, per-song media reset, per-codec qualities, Edit LRC, save ticks

**Repo:** `AlgerMusicPlayer/` (its own git repository; the workspace-root `.gitignore` excludes it)
**Branch:** `main`
**HEAD:** `808969c` — `feat(v5.4.0): linked A/V playback, per-song media reset and player UX overhaul`
(previous: `bf9d1bc` — smaller portable + installer target; `08ee837` — English-only source sweep)
**Working tree:** clean
**App:** Electron (main / preload / Vue 3 renderer), Dexie/IndexedDB, FFmpeg + yt-dlp bundled.
**Version:** `5.4.0`
**Artifact:** [`releases/MusicManager-v5.3.5-Portable.exe`](releases/MusicManager-v5.3.5-Portable.exe) — 446.9 MB, **stale**: it predates the v5.4.0 changes. Rebuild with `npm run build:portable` before the GUI checklist.

---

## 1. Status at a glance

| Area | State |
|---|---|
| Local file playback + Range seeking | **Done** (`f3c2189`) |
| Audio ⇄ video switching, subtitle/lyric seek, arbitrary offsets | **Done** (`f3c2189`) |
| One shared clock on every surface (incl. video mode + lyric window) | **Done** (`7f12111`) |
| Per-variant delete from disk vs unlink | **Done** (`7f12111`) |
| Remembered download folder | **Done** (`7f12111`) |
| Acoustic fingerprint DB, backfill, duplicate merge | **Done** (`7f12111`) |
| Automatic metadata lookup + tag/cover writing | **Done** (`7f12111`) |
| English sweep (runtime strings + comments) | **Done** (`08ee837`) |
| Portable build size (474 MB → 447 MB) | **Done** (`bf9d1bc`) |
| `build:installer` script wired (NSIS) | **Done** (`bf9d1bc`) — not yet run |
| Packaged `MusicManager-v5.3.5-Portable.exe` | **Built** — 446.9 MB, in `releases/` |
| Linked A/V playback + play-state sync (v5.4 session) | **Done** — see §2c |
| Per-song media reset, qualities tab, Edit LRC, save ticks (v5.4 session) | **Done** — see §2c |
| GUI runtime check on a real desktop | **Outstanding** — §3.2 |

---

## 2. What this commit added — the English sweep

This closes the single open requirement carried over from `7f12111` (§3.1 of the
previous handoff). It is a **text-only** change: no behaviour, signatures, IPC
channels or schema were touched.
### 2.1 Comments
The previous session had already removed the Chinese comment lines mechanically.
That pass was re-verified: **3298 deleted lines, 0 of them non-comment**.

It had one class of silent regression, now fixed: a `catch { // comment }` block
became `catch {}`, i.e. an empty block (`no-empty`). Empty catch blocks were
rewritten with an English comment rather than left silent. 13 such sites were
repaired across `cache.ts`, `fileManager.ts`, `localMusicScanner.ts`,
`lxMusicHttp.ts`, `mpris.ts`, `tagAndMetadataManager.ts`, `MusicHook.ts`,
`usePlayerHooks.ts`, `migration.ts`, `pluginStore.ts`, `lxListParser.ts`.

The mechanical pass also collapsed the leading indentation of every line it
rewrote. Those 417 lines were re-indented and the tree was normalised with
`prettier --write ./src`.

### 2.2 Runtime strings
468 lines carrying Chinese string literals were translated, covering:

- `console.*` diagnostics across `main/**` and `renderer/**`
- `throw new Error(...)` / `LyricParseError(...)` messages
- IPC error payloads and dialog titles
- notification titles/bodies (batch-download and single-download completion)
- the `未播放` / `未知艺术家` / `未知专辑` fallbacks

`src/renderer/utils/yrcParser.ts` parse diagnostics are now English too.

### 2.3 Number formatting
`src/renderer/utils/index.ts` → `formatNumber()` used the Chinese myriad scale
(`万` = 1e4, `亿` = 1e8). It now uses the Western scale (`M` = 1e6, `B` = 1e9).

### 2.4 Documented exemptions
The sweep is **not** a blanket "delete every CJK character". Four exclusions are
deliberate and are recorded in [`docs/REMOVED_FEATURES.md`](../docs/REMOVED_FEATURES.md):

| Path | Why |
|---|---|
| `src/shared/transliteration.ts` | Pinyin/kana lookup tables — removing them breaks romanisation. |
| `src/i18n/lang/**` | Locale bundle data, not source text. |
| `src/renderer/utils/lxListParser.ts` | `HEADER_KEYWORD_RE` must match CJK/Korean/Japanese column headers in user-imported CSV/M3U playlists. |
| `src/i18n/lang/en-US/settings.ts` → `fontPreview.chineseText` | The CJK sample line that previews font rendering; translating it would defeat its purpose. |

Gate used to prove the sweep is complete (returns **0** unexplained lines):

```powershell
node .sweep-gate.mjs
```

### 2.5 Also swept beyond `src/`
- **Build tooling** — `eslint.config.mjs`, `vite.config.ts`,
  `electron.vite.config.ts`, `build/installer.nsh`, `scripts/check_i18n.ts`,
  `scripts/export_i18n_report.ts`, `scripts/fix-sandbox.js`.
- **GitHub workflows** — `pr-check.yml`, `deploy.yml`.
- **Issue templates** — the upstream `bug-report.zh-CN.yml` and
  `feature-report.zh-CN.yml` were **replaced** with English `bug-report.yml` and
  `feature-report.yml`, not translated (the project ships no other locale).
- **Tests** — incidental Chinese test names/comments translated. CJK used as
  *fixture data* stays, because it is what is under test: plugin metadata
  samples, Japanese/Chinese lyric strings for the translator, and a CJK filename
  for the tag writer.
- **Docs** — rewrote `README.md` for Music Manager (the upstream one still
  advertised the removed Netease account features) and deleted the stale
  `DEV.md` and `docs/custom-api-readme.md`.

### 2.6 Verification actually run
```
npm run typecheck:node   # exit 0
npm run typecheck:web    # exit 0
npx vitest run           # 18 files / 169 tests pass
npx eslint ./src         # no-empty count 0 (baseline was 0, sweep broke then fixed it)
node .sweep-gate.mjs     # 0 unexplained CJK lines
npm run build            # exit 0 (electron-vite build)
```
**Not run:** the GUI. This sandbox cannot initialize an Electron window, so the
packaged app was validated by static inspection of the artifact instead — see
`docs/BUGS.md` §6.

---

## 2c. What the v5.4 session added — UI state fixes and requested features

Everything below follows the annotated-screenshot review (8 requested areas).
Verified with `typecheck:web`, `typecheck:node`, `vitest` (170/170), `eslint`
(15 pre-existing problems, `no-empty` 0), `node .sweep-gate.mjs` (0) and
`npm run build`. **Not GUI-tested** — see §3.2.

### 2c.1 Linked A/V playback (fixes play-button desync and the mode-switch gap)
Video mode is now **linked**: the song's audio element stays the master clock
and the only sound source; the video element is **muted** and follows it
(play/pause slave watcher + drift correction >0.75s in `MusicFull.vue`).
Consequences: no double audio, one play state (`playerStore.isPlay` = audio
state), audio/video share one duration by construction, and switching modes has
no audible gap (nothing is paused; the video simply joins when ready).
- `playerCore.setPlaybackMode('video')` no longer pauses the audio.
- `audioService.play()` (resume path) now cancels a pending fade-out pause —
  that late 200ms pause was the "button shows playing but it paused" bug.
- `MusicHook`'s audio `'pause'` handler no longer flips `isPlay` while video
  mode or another media surface owns playback (late crossfade pauses).
- All play buttons route through one path (`usePlaybackControl` toggles the
  active non-audio surface first via `mediaCoordinator.toggleActiveNonAudioPlayback`);
  `handlePause` pauses every surface (`mediaCoordinator.pauseAllLocal('audioService')`).
- **Video-only media**: quality downloads and streams use `videoOnly: true`
  (`-f bestvideo…`, no merge) and `formatId` for exact per-codec rows — smaller
  files, no duplicated audio, and the stream is directly range-seekable (the
  ffmpeg mux proxy is only a fallback now). Stream URLs are prefetched on song
  change (4h cache) so mode switches are near-instant.

### 2c.2 Per-song media reset (fixes "next" keeping the old video/artwork)
`playTrack` calls `playerCore.resetMediaStateForNewSong()` on song-id change
(mode→'song'), and `MusicFull` resets `activeVideoSrc/muxed/offset/height/
youtubeId/variants/record`, dismisses warnings and resets the lyric strip.
PlayBar closes its MV drawer on song change. The pill now reads
**"Video • 360p"** or **"Audio • 128 kb/s"** (audio bitrate from variants),
never "Video • ×".

### 2c.3 Lyrics layout + duplication
- Side lyric column renders only when the window is ≥1024px (JS-measured);
  otherwise a scrollable, click-to-seek 3-line strip shows under the artwork /
  video (wheel scrolls, click seeks). Artwork spacing tightened (video moves up).
- The double current line is fixed: romanization sub-lines render only when
  `romaText !== text` (the transliterator echoes Latin text) — fixed in the
  under-artwork strip, the side panel, `NamidaStackedPlayer` and the lyric
  window (`views/lyric/index.vue`, incl. its line-height math).
- **Line start times** (`mm:ss,ms`, e.g. `00:15,590`) render per lyric line;
  toggle "Line Start Times" in Lyric Settings → Display.

### 2c.4 Qualities tab
- One row per **height AND codec** (`YtVideoFormat.vcodec`, normalized
  `h264/av01/vp9/…`; both dedup layers relaxed). Detail reads
  `mp4 • av01 • 2500 kb/s` — the **size appears once**, in the bordered badge.
- Downloaded rows show a green tick **plus a delete button** (per-variant,
  codec-aware); active downloads show percent **and speed** (already in
  `YtDownloadProgress.speed`).
- The audio row shows the real `abrKbps` (`m4a / aac • 128 kb/s`) instead of
  "high bitrate". `Variant` gained optional `codec`/`formatId` fields (no Dexie
  index change).

### 2c.5 Edit LRC + offset control
- **"Edit LRC"** button at the bottom of the lyric section (also under the
  narrow-layout strip) opens `LrcSynchronizerModal` with the raw LRC
  (`[mm:ss.xxx]` timestamps — fixed `rawLrcString`, which serialized ms as
  seconds and corrupted saved .lrc times), per-line editable timestamps with
  ±0.1s nudges, live playback following (`currentTimeGetter`), and Apply hot-
  swaps `lrcArray`/`lrcTimeArray` live. Saves to tags + sidecar for local files.
- Offset control restyled: uniform 32px controls, proper reset button
  (`ri-refresh-line`), "Remove"/"Add" labels, manual ±seconds input (0.1 = 0.1s).

### 2c.6 Length warning + lyric-search match info
- Glassmorphism banner when the linked video's duration differs from the audio
  by >3s (checked on video metadata load; auto-hides after 10s).
- `lyrics:fetch-multi-source` candidates now carry `duration`, `durationDelta`,
  `offsetSec` (first lyric timestamp), `spanSec` and `durationMatch` (≤3s), and
  `LocalTrackEditorModal` shows a **"Lyric Matches"** picker with
  `length ✓`/`Δ ±Xs`/`starts mm:ss,ms` badges so the closest version wins.
- Song-ID scheme **reconfirmed**: library songs are UUID-keyed in Dexie with
  identity `normKey = clean(artist)|clean(title)` + duration ±3s (+fingerprint/
  fuzzy fallbacks); audio/video/.lrc files are linked to that id via `variants`.

### 2c.7 Save to Disk
- Checkboxes beside Save Audio / Save Video / Save Lyrics + "Select all" and
  **"Save Selected (n)"** batch button (already-saved items are skipped, so no
  duplicates).
- Saved state comes from the `variants` table: green **"Saved • m4a / 480p /
  .lrc"** ticks per row (lyrics saves now record a `kind:'lyrics'` variant),
  a "n saved" summary chip, saved-qualities list on the video row, and the
  buttons flip to Saved/disabled after completion. Download speed is shown
  while saving. Video saves are `videoOnly` (linked playback).

### 2c.8 In-player metadata editor
"Edit Metadata, Artwork & Filename" (same tooltip and modal as the Local Music
list) is now in the player: `useLocalTrackEditor` composable + button in
`PlayBar` (right zone) and `MusicFull` (control strip), resolving the current
song to its `LocalMusicEntry` by id or file URL. The editor already covers
add/search lyrics (LRCLIB picker from §2c.6), tags/artwork search (iTunes /
MusicBrainz), raw LRC text and the Tap Timestamp Maker with live times.

---

## 2b. What `bf9d1bc` (v5.3.5) added — smaller portable + installer target

The portable went **474.3 MB → 446.9 MB (−27.4 MB)** by fixing two packaging
defects. No feature was removed; all functionality is retained.

### Duplicate 79 MB ffmpeg
`build.asarUnpack` unpacked the entire `ffmpeg-static` npm package *while*
`extraResources` separately shipped `resources/bin/ffmpeg.exe`. The artifact
carried two identical 79 MB binaries.

Crucially, **both were genuinely reachable**, so this was not a simple delete:

| Caller | Was reading |
|---|---|
| [`youtube.ts`](../AlgerMusicPlayer/src/main/modules/youtube.ts) (`getFfmpegPath`) | `resources/bin/ffmpeg.exe` |
| [`tagAndMetadataManager.ts`](../AlgerMusicPlayer/src/main/modules/tagAndMetadataManager.ts) (its own local `getFfmpegPath`) | the unpacked `ffmpeg-static` npm copy |

Deleting either copy alone would have broken tag writing or video muxing. Both
now import the single `getFfmpegPath()` from `youtube.ts`; the local duplicate
and the `ffmpeg-static` dependency are gone, and `scripts/fetch-binaries.mjs`
downloads ffmpeg directly instead of copying it out of that package.

### 54 wasted Electron locales
`build.electronLanguages` is now `['en-US']`. Chromium was copying ~54 locale
paks (~44 MB) for languages the app can never display, because
`src/i18n/lang/` contains only `en-US`. `locales/` went from 55 paks to 1.

### Installer target wired
```powershell
npm run build:installer   # electron-builder --win nsis  (added, not yet run)
npm run build:portable    # the rapid-test artifact (default win.target)
```
The NSIS config was already complete and was left untouched — it simply had no
script pointing at it. `win.target` stays `portable` deliberately.

### Size audit: what is left, and what cannot be cut
The remaining 447 MB is, in order:

| Component | Size | Reducible? |
|---|---|---|
| `Music Manager.exe` (Electron/Chromium runtime) | ~204 MB | Only by switching to a non-Chromium shell. Not worth it. |
| `app.asar` (app code + production node_modules) | ~485 MB uncompressed / far less in the 7z | Some, via dependency pruning (see §3.5). |
| `ffmpeg.exe` | 79 MB | **No.** Single static binary; trimming codecs means recompiling and risks breaking formats. |
| `yt-dlp.exe` | 22.5 MB | **No.** Already a single self-contained binary. |
| `dxcompiler.dll` + `dxil.dll` + `vk_swiftshader.dll` | ~31 MB | Risky — these back GPU/video decode. |

> **The `.exe` is smaller than the sum of its parts** because electron-builder's
> portable target is a 7z self-extractor. `app.asar` is ~485 MB on disk but
> compresses heavily (JS text), which is why the total lands at 447 MB.

---

## 3. Remaining work

### 3.1 Nothing blocking
No open feature or defect work is recorded.

### 3.2 GUI verification on a real desktop (outstanding)
**This is the one real gap.** No packaged build has ever been launched and
visually confirmed from this environment — see `docs/BUGS.md` §6 for why the
sandbox cannot do it. Rebuild first (`npm run build:portable` — the checked-in
`releases/` artifact predates v5.4.0), then run the checklist in §3.3 by hand
on a desktop session against the fresh portable.

### 3.3 Manual verification checklist
1. Play a local track → switch to video mode mid-song → lyrics highlight and
   progress continue; open the lyric window → it advances too; seek the video →
   lyrics jump; click a lyric → video seeks.
2. Open Video Source → Files: sizes render; delete a 480p file → audio file still
   plays; unlink a variant → file stays on disk.
3. Save to Disk → Browse → pick a folder → save audio; the folder is remembered
   for the popover's quality downloads.
4. Local Music → fingerprint menu → index (progress banner) → merge duplicates →
   song count drops and variants survive.
5. Local Music → magic wand on a folder with `Unknown Artist` files → tags/cover
   written, list refreshes, files still play.
6. Confirm no Chinese text appears in the UI, notifications, or DevTools console.
7. **New in v5.3.5:** confirm video playback still muxes (exercises ffmpeg) and
   that writing tags on a local file still works (the other ffmpeg path) — these
   are the two call sites the ffmpeg unification touched.
8. **New in v5.4:** play a video song → confirm the play button always matches
   the audible state and that pause stops both picture and sound; switch
   audio⇄video twice — no audio gap, and the pill reads `Video • 360p` /
   `Audio • <bitrate>`.
9. **New in v5.4:** press next from a video song to an audio-only song — the
   video/artwork/pill must reset immediately; press next back — video mode is
   off until re-enabled.
10. **New in v5.4:** shrink the window below 1024px — the lyric column
    disappears and a 3-line strip appears under the artwork (wheel scrolls,
    click seeks); the current line must appear only once.
11. **New in v5.4:** Qualities tab — rows show `mp4 • codec • bitrate`, size
    only in the badge; download one → green tick + bin button; audio row shows
    a numeric bitrate. Downloaded videos play video-only (muted) with the song
    audio.
12. **New in v5.4:** "Edit LRC" shows `[mm:ss.xxx]` per line with ±0.1s nudges
    following playback; Save to Disk checkboxes save everything once with green
    "Saved" ticks; the player's edit-metadata button opens the same editor as
    the Local Music list.

### 3.4 Known risks
- Fingerprinting spawns FFmpeg per file; the index action is explicit and reports
  failures per file. Do not call it during scan.
- Dexie schema is at **version 2**; any further index change needs a new version.
- `window.api.*` is optional in tests; keep new bridge calls optional-chained.
- Video mode still uses the progressive-stream fallback for seeking when the
  muxed DASH proxy reports `Accept-Ranges: none`.
- Media must never be stored as `local://`; convert at playback with
  `toPlayableMediaUrl()`.
- **ffmpeg has exactly one copy.** `getFfmpegPath()` in `youtube.ts` is the only
  resolver. Never reintroduce `ffmpeg-static` or an `asarUnpack` entry for it —
  that silently doubles the download.
- **`electronLanguages` is restricted to `en-US`.** Adding a locale to
  `src/i18n/lang/` requires adding it here too, or the UI strings will load but
  Chromium's own locale pak will be missing.
- `src/i18n/lang/` currently ships **only `en-US`**. The language switcher has
  nothing else to offer; do not "restore" other locales — see
  `docs/REMOVED_FEATURES.md`.

## 4. Useful commands
```
cd AlgerMusicPlayer
npm run typecheck:web && npm run typecheck:node
npx vitest run
npx eslint ./src              # no-empty must stay at 0
node .sweep-gate.mjs          # English sweep gate -> 0 unexplained lines
npm run build                 # bundling check
npm run build:portable        # rapid-test distributable -> dist/MusicManager-v<ver>-Portable.exe
npm run build:installer       # NSIS installer (shipping format, not yet run)
git log --oneline -3
```

## 4b. Possible further size work (not done, needs a decision)

electron-builder logged **~100 duplicate dependency references** during the
v5.3.5 build (`debug@4.4.3` twice, `domhandler@5.0.3` five times, `parse5@7.3.0`
twice, and so on). These are transitive duplicates inside `app.asar`, which is
~485 MB on disk before compression.

`electron` is already correctly in `devDependencies` (checked), so that common
cause is **not** in play here — the 204 MB runtime in `dist/win-unpacked` is
Electron's own unpacked binary, not something the dependency scan pulled in.
Whatever is inflating `app.asar` is inside the production dependency tree.

A conservative next step would be:

```powershell
npx asar list dist/win-unpacked/resources/app.asar > asar-list.txt
# then find the heaviest subtrees under \node_modules and check each is
# actually required by the main/renderer bundles before removing it
```

**Do not** prune blindly: the app's production dependency list includes several
runtime-needed packages (`music-metadata`, `node-id3`, `flac-tagger`, `dexie`,
`electron-store`, `express`, `cheerio`, `node-vibrant`). Anything removed must be
proven unreferenced in `out/main/index.js` and the renderer bundle.

Expect diminishing returns: `.exe` size is dominated by `Music Manager.exe`
(204 MB) and `ffmpeg.exe` (79 MB), which are 63% of the total and are not
removable without losing functionality.

## 5. Scratch files
All scratch files from both sweep sessions have been deleted. One helper is kept
on purpose and is tracked in the repo:

```
AlgerMusicPlayer/.sweep-gate.mjs    # English-sweep regression gate -> must print 0
```
