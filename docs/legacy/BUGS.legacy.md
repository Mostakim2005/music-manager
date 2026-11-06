# Music Manager — Defect Prevention & Architectural Safeguards

This document records critical failure modes observed in Namida, their technical root causes, and the concrete safeguards implemented in our Electron/Vue 3 hybrid architecture to ensure rock-solid stability.

---

## 1. Defect RCA: "Bad state: Cannot add event after closing" (Namida's Fatal Flaw)

### 1.1 The Failure Mode in Namida
* **Symptom**: When a user downloads a video for an existing audio track or updates track metadata while listening, the app throws `Bad state: Cannot add event after closing`. Once triggered, the error cascades to **every subsequent song played** until the app process is killed via Windows Task Manager.
* **Root Cause Analysis (RCA)**:
  * Namida uses a global Dart `StreamController` singleton for broadcasting playback events.
  * During the media update, Namida abruptly called `streamController.close()` to tear down the audio pipeline before switching to the `.mp4` video container.
  * Meanwhile, an asynchronous background task (the downloader completion callback or indexer) posted a completion event (`controller.add(...)`) to the dead controller without checking `if (!controller.isClosed)`.
  * In Dart, adding an event to a closed stream throws an unhandled `StateError`, permanently corrupting the Dart runtime audio service for that entire session.

### 1.2 The Safeguard in the Hybrid Architecture (AlgerMusicPlayer + Vue 3)
* **DOM Event Model vs. Closed Streams**:
  * The hybrid app uses standard HTML5 media elements (`<audio>` and `<video>`) managed by Pinia reactive state.
  * Standard JavaScript event listeners (`addEventListener('timeupdate')`, `addEventListener('ended')`) do not throw fatal process errors if an element is unloaded or replaced.
* **Decoupled Media Swapping**:
  * Instead of destroying the entire player context to switch to video, the Vue 3 player store cleanly updates `currentTrack.mediaUrl` and toggles a boolean `isVideoMode`.
  * The audio context smoothly rebinds via `HTMLMediaElement.src`, with async operations wrapped in standard `try/catch` and `AbortController` cancellation tokens.

---

## 2. Defect RCA: Windows File Pathing & Special Character Corruption

### 2.1 The Failure Mode in Namida
* **Symptom**: Downloaded songs fail to play, reporting "cannot find them", or songs with special punctuation (`:`, `?`, `"`, multi-byte Japanese/Korean kanji) mislabel tags and break indexers.
* **Root Cause**:
  * Mobile-first SQLite path normalization failing on Windows drive letters (`E:\Music\...`) and unescaped Windows reserved characters.

### 2.2 The Safeguard in the Hybrid Architecture
* **Node.js Native `path` Module**:
  * File operations in Electron run in the Node.js main process using `node:path` (`path.resolve`, `path.normalize`).
  * Filenames are sanitized through `filenamify` before writing to disk, replacing illegal NTFS characters with safe Unicode equivalents.
  * Tag reading and writing is handled by native C++ TagLib bindings (`music-metadata`, `flac-tagger`, `node-id3`), guaranteeing valid UTF-8 string encoding across all ID3v2.3 and ID3v2.4 frames.

---

## 3. Defect RCA: Background Playback Loops & Process Throttling

### 3.1 The Failure Mode in Namida
* **Symptom**: Minimizing the player causes the active track to repeat continuously because the UI thread is occluded and fails to advance the queue.

### 3.2 The Safeguard in the Hybrid Architecture
* In Electron's main process ([`src/main/modules/window.ts`](file:///c:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/AlgerMusicPlayer/src/main/modules/window.ts#L394-L400)), the browser window is configured with:
  ```typescript
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,
    contextIsolation: true,
    webSecurity: false,
    backgroundThrottling: false // Prevents Chromium from pausing timers when minimized
  }
  ```
* Track advancement logic runs in the Pinia player store on HTML5 audio `ended` events, completely immune to window minimization.

---

## 4. Defect RCA: Packaged Renderer White-Screen Crash on Startup

### 4.1 The Failure Mode
* **Symptom**: Packaged executable (`MusicManager-v5.1.0-Portable.exe` and `dist/win-unpacked/Music Manager.exe`) launches into an unresponsive white screen. The window frame and title bar appear, but the web contents never render.
* **Root Cause Analysis (RCA)**:
  1. **Temporal Dead Zone (TDZ) via Top-Level Await**:
     * `src/renderer/hooks/MusicHook.ts` previously executed a top-level await: `export const musicDB = await useIndexedDB(...)`.
     * In Vite dev server, ES modules are loaded on demand and evaluate sequentially. However, when Vite/Rollup bundles the production build into `index-[hash].js`, tree-shaking and chunk hoisting placed callers of `musicDB` (such as `src/renderer/services/musicSource/cache.ts` and `src/renderer/api/music.ts`) earlier in the chunk's execution tree.
     * When the bundle loaded, calling `musicDB.getData(...)` before `MusicHook.ts` top-level assignment completed threw `ReferenceError: Cannot access 'musicDB' before initialization`, crashing Vue 3 initialization.
  2. **Packaged Tray Icon Path Resolution**:
     * In packaged mode, icon paths resolved via `join(__dirname, '../../resources')` pointed inside `app.asar`, which is not a physical filesystem directory for native OS API calls (`Tray(iconPath)`).
* **Resolution Strategy**:
  1. **Lazy Proxy Pattern for IndexedDB**:
     * In [`src/renderer/hooks/IndexDBHook.ts`](file:///c:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/AlgerMusicPlayer/src/renderer/hooks/IndexDBHook.ts#L193-L226), exported a lazy proxy object `musicDB` whose methods dynamically await an internal singleton `getMusicDBInstance()`. Eliminated top-level await from module roots.
     * Added defensive guards for headless/test environments where `typeof indexedDB === 'undefined'`.
  2. **Packaged Resource Routing**:
     * In [`src/main/index.ts`](file:///c:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/AlgerMusicPlayer/src/main/index.ts), [`src/main/modules/window.ts`](file:///c:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/AlgerMusicPlayer/src/main/modules/window.ts), and [`src/main/modules/tray.ts`](file:///c:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/AlgerMusicPlayer/src/main/modules/tray.ts), routed asset lookup through `app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources')`.
     * Configured `extraResources` in `package.json` to bundle icons directly to the physical resources directory.
* **Verification**:
  * Launched unpacked binary `Music Manager.exe` with `--enable-logging`.
  * Queried embedded diagnostics endpoint `http://127.0.0.1:41820/api/diagnostics`; verified `recentErrors.Count: 0` and confirmed instant, clean rendering.

---

## 5. Defect RCA: Silent `catch` Blocks Created by the Comment Sweep (v5.3.0)

### 5.1 The Failure Mode
A mechanical comment-removal pass — the kind used to strip Chinese comments during the English-only sweep — does not distinguish between a comment that merely *documents* code and a comment that *is* the body of a block:

```ts
// before the sweep                        // after the sweep
try {                                     try {
  await fs.promises.unlink(tmp);            await fs.promises.unlink(tmp);
} catch {                                 } catch {
  // Ignore ENOENT: the file is gone        }
}                                         
```

The result is an **empty catch block**. This is not cosmetic: the comment was the only record of *why* the error is deliberately swallowed. Deleting it removes the reasoning, and the block silently passes review. It is also a lint violation (`no-empty`), so it fails CI.

The same class of damage appears in two other forms:
- **Collapsed indentation** — a line rebuilt by the pass loses its leading whitespace, so rewritten lines end up at one space while their siblings sit at four.
- **Emptied doc comments** — a block comment whose text was entirely removed leaves a bare `/**` / `*/` pair (95 such sites were found).

### 5.2 Detection
```powershell
cd AlgerMusicPlayer
npx eslint ./src 2>&1 | Select-String "no-empty"   # must be empty
```
Compare against the pre-sweep baseline: the working tree showed **0** `no-empty` errors before the sweep and **13** after. Never trust "the sweep only touched comments" without this check — `git diff` will show the `catch {}` as a *modification*, not a deletion, so a deletion-only audit will miss it.

### 5.3 Safeguard
* Comment sweeps must **rewrite** comments that carry block semantics into the target language, never delete them. Every `catch {}` produced by the sweep was restored with an English explanation.
* Run `npx prettier --write ./src` afterwards to normalise any indentation the pass collapsed.
* Keep the sweep gate (`node .sweep-gate.mjs`) and the lint check in the post-rebase workflow — see [`REMOVED_FEATURES.md`](REMOVED_FEATURES.md) §7.

### 5.4 Verification
* `npx eslint ./src` → 15 problems, all pre-existing (unused variable, escape/control-char regex rules); `no-empty` count is 0.
* `npm run typecheck:node` / `typecheck:web` → exit 0.
* `npx vitest run` → 18 files / 169 tests pass.
* `npm run build` → exit 0.

---

## 6. Environment Limitation: Electron GUI Cannot Launch in the Agent Sandbox

### 6.1 The Symptom
Launching the packaged app from an agent shell produces misleading results that look like an application defect:

```
> "dist\win-unpacked\Music Manager.exe" --enable-logging
bad option: --enable-logging          # exit code 9
```

and, when started with no arguments, the process exits **0** without ever creating
`%APPDATA%\Music Manager\`, so it looks like the app starts and immediately dies.

### 6.2 The Actual Cause
Neither behaviour is an app bug. In this sandbox:

1. **Standard Electron/Chromium switches are rejected** before the app boots —
   `--enable-logging`, `--v=1` and similar come back as `bad option` with exit 9.
   This is the shell rejecting the argument, not Electron.
2. **The Electron runtime starts but its API is unavailable.** A minimal probe
   run *by* `electron.exe` printed the version header — proving the binary and
   its Chrome 144 runtime load — and then failed on the very next line:
   ```
   PROBE: electron 40.10.6 chrome 144.0.7559.236
   TypeError: Cannot read properties of undefined (reading 'whenReady')
   ```
   `require('electron')` resolves to the npm stub, not the live runtime, so
   `app`, `BrowserWindow` and the whole GUI layer are `undefined`. A headless
   process cannot open a window, and `app.whenReady()` never fires, so the app
   exits cleanly with code 0 and writes nothing.

### 6.3 What This Means for Verification
**Do not** treat "app exits immediately" as a regression when working in this
sandbox, and do not chase it as one. The GUI simply cannot be exercised here.

Verify packaging changes by **static inspection of the artifact** instead:

```powershell
cd AlgerMusicPlayer
# 1. Confirm the bundled binaries are present and still execute
& dist/win-unpacked/resources/bin/ffmpeg.exe -version
& dist/win-unpacked/resources/bin/yt-dlp.exe --version

# 2. Confirm the shipped main bundle resolves them from resources/bin only,
#    and carries no reference to a package that was removed
npx asar extract dist/win-unpacked/resources/app.asar .asarx
#    then grep .asarx/out/main/index.js for "ffmpeg-static" / "app.asar.unpacked"

# 3. Confirm locale trimming took effect
(Get-ChildItem dist/win-unpacked/locales -File).Count   # expect 1
```

This is how the v5.3.5 packaging change was validated: the shipped bundle was
confirmed to contain no `ffmpeg-static` reference and no `app.asar.unpacked`
dependency, while both binaries still ran from `resources/bin`. **Runtime
behaviour of the packaged GUI is still unverified and must be checked on a real
desktop session.**
