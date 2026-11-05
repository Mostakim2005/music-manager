<h2 align="center">🎵 Music Manager</h2>

<p align="center">
  A local-first, MIT-licensed desktop music player for Windows.<br>
  Built on Electron, Vue 3 and TypeScript.
</p>

---

## What it is

Music Manager plays your own files and streams from YouTube, in one library and
one queue. There is no account requirement, no cloud library, and no telemetry
beyond a local error log.

It is built on the MIT-licensed [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer)
engine, with the Netease cloud layer, the non-English locales and the
promotional modules removed. See [`docs/REMOVED_FEATURES.md`](../docs/REMOVED_FEATURES.md)
for the complete audit trail of what was taken out and why.

## Features

### Library and playback
- **Local file playback** for `.mp3`, `.flac`, `.opus`, `.m4a`, `.mp4`, `.webm`
  and more, with HTTP Range seeking.
- **Unified song library** — audio files, higher-bitrate copies and music videos
  are linked as *variants of one song* in a single Dexie/IndexedDB database.
- **Acoustic fingerprint index** — detects duplicate recordings by fingerprint
  and duration, then merges them while preserving every variant.
- **Automatic metadata repair** — fills in missing titles, artists and cover art
  from iTunes Search, MusicBrainz and the Cover Art Archive, and writes the tags
  back to the file (`ID3v2`, Vorbis comments, MP4 atoms).
- **Playlist and library backup** — export and restore `.m3u8` playlists and full
  `.json` library snapshots.

### Audio and video together
- **Instant audio ⇄ video switching** mid-track, with one shared playback clock
  so lyrics, the progress bar and the video all stay in sync.
- **Adaptive quality ladder** from 1080p down to 144p, extracted through bundled
  `yt-dlp` with a multi-client fallback chain and an ephemeral local DASH proxy.
- **Per-variant management** — unlink a file from the library while keeping it on
  disk, or delete it outright, without touching the other qualities.
- **Picture-in-Picture** and strict playback exclusivity, so two sources can never
  play over each other.

### Lyrics
- **Synced lyrics** from LRCLIB, with word-by-word (karaoke) highlighting.
- **Timing offset control** (`-100 ms` / `+100 ms`) applied live to every surface,
  including the floating desktop lyric window.
- **Multi-language romanization** — Hepburn Romaji for Japanese kana and phonetic
  Bangla, generated from the shared transliteration tables.
- **In-app LRC synchronizer** — tap along to stamp timestamps onto plain lyrics and
  save them to embedded tags or a `.lrc` sidecar.

### Player and interface
- Dynamic palette extracted from the album art, with light and dark themes.
- Namida-style stacked fullscreen player with a waveform seekbar.
- Equal-power crossfade, gapless playback and skip-silence.
- A-B loop, per-track bookmarks, sleep timer and listening statistics.
- Discord Rich Presence, global media keys and system tray controls.
- **English-only interface and source.** No other locale ships.

## Requirements

- Windows 10 or newer (x64)
- No external runtime — `ffmpeg` and `yt-dlp` are bundled

## Getting started

Download the latest portable executable from the releases page and run it. No
installation is required.

## Development

```powershell
cd AlgerMusicPlayer
npm install

npm run dev              # electron-vite dev server with hot reload
npm run typecheck        # node + web type checks
npx vitest run           # unit tests
npm run build            # bundle check
npm run build:portable   # produce MusicManager-v<version>-Portable.exe
```

### Repository layout

```
AlgerMusicPlayer/
├── src/main/            Electron main process, IPC handlers, window setup
├── src/preload/         Context-isolation bridge
├── src/renderer/        Vue 3 frontend (views, components, stores, services)
├── src/shared/          Code shared between main and renderer
├── tests/               Vitest unit tests
└── scripts/             Build, packaging and i18n tooling
```

### Conventions

- **English-only source.** Comments, log messages, thrown errors and dialog
  titles are all English. Four CJK exemptions are deliberate and documented in
  [`docs/REMOVED_FEATURES.md`](../docs/REMOVED_FEATURES.md) §7; the regression
  gate is `node .sweep-gate.mjs`, which must report 0.
- **Media URLs are never stored as `local://`.** Convert at playback time with
  `toPlayableMediaUrl()`.
- **The Dexie schema is versioned.** Any index change requires a new version.

## License

MIT. See [`LICENSE`](LICENSE).

## Acknowledgements

This project is built on [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer)
by Alger, and draws its visual language from
[YesPlayMusic](https://github.com/qier222/YesPlayMusic) and the feature design of
Namida.
