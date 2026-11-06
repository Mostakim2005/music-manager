# Music Manager — Progressive Information Architecture Index

Welcome to the **Music Manager** master index. This workspace contains the complete research, comparative analysis, cloned base repositories, and architectural roadmap for building an open-source, MIT-licensed desktop music player hybrid inspired by Namida's unique capabilities.

---

## Workspace Navigation

### Level 0: Overview & Quick Navigation
* **Target Project**: Music Manager (Hybrid of AlgerMusicPlayer & YesPlayMusic with Namida's Feature Set)
* **License Target**: **MIT** (100% Permissive, FOSS, No EULA or copyleft restrictions)
* **Root Directory**: `C:\Users\kazir\Documents\Agentic Harness\Windows Exe\Music Manager`
* **Core Base Repositories Cloned**:
  * [AlgerMusicPlayer/](file:///C:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/AlgerMusicPlayer): Modern Vue 3 + TypeScript + Vite + Tailwind + MV Video Engine + Local Tagger
  * [YesPlayMusic/](file:///C:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/YesPlayMusic): Vue + Electron + Node-Vibrant Dynamic Color Aesthetics + Apple Music UI
* **Developer Handoff Guide**: [HANDOFF.md](file:///C:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/HANDOFF.md)

### Level 1: System Design & Technical Comparison
* [ARCHITECTURE.md](file:///C:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/docs/ARCHITECTURE.md)
  * Comprehensive 3-Way Technical Comparison: **Namida vs. AlgerMusicPlayer vs. YesPlayMusic**
  * Technology stack breakdown: Flutter vs. Vue 3/TypeScript vs. Vue 2/Webpack
  * Hybrid Architecture Specification: Using AlgerMusicPlayer as the engineering engine and YesPlayMusic as the visual reference
  * Subsystem Specifications: YouTube Engine (`yt-dlp` + `ffmpeg`), Unified Song Library (`musicManagerLibrary` Dexie DB), Global Media Coordinator (`mediaCoordinator.ts`), Namida Stacked Player, Local Tag & Cover Protocol

### Level 2: Feature Catalog & Implementation Mapping
* [FEATURES.md](file:///C:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/docs/FEATURES.md)
  * Comprehensive Inventory of Namida's Standout Features (Visuals, Synced Lyrics with Offset, Audio/Video Toggle, Smart Transitions, Tagging, Library, Extras)
  * Version 5.2.0 Flagship Features & Direct Code Anchors (Namida Stacked Player, Video Source Popover, YouTube Search & Engine, Unified Song Variants DB, Playback Exclusivity Coordinator, Overhauled LRC Synchronizer, Local Protocol & Cover Rendering)
  * Version 5.3.0: completes the English-only source sweep (comments, logs, thrown errors, dialog titles, notification bodies) and switches numeric units to `M`/`B`
  * Version 5.3.5: portable artifact cut from 474 MB to 447 MB (duplicate 79 MB ffmpeg removed, 54 unused Electron locale paks dropped) and the NSIS installer target wired via `build:installer`
  * Version 5.4.0: linked A/V playback (muted video following the audio master clock), per-song media reset, per-codec video ladder with video-only media, responsive lyrics + Edit LRC + line timestamps, Save-to-Disk batches with saved ticks, in-player metadata editor, and lyric-search match badges
  * Exclusion of Low-Priority Advanced DSP (retaining Smart Transitions)
  * Component Mapping Matrix: How each Namida feature maps directly into the Alger/YesPlay codebase

### Level 3: Defect Prevention, Architectural Safeguards & De-China Audit
* [BUGS.md](file:///C:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/docs/BUGS.md)
  * Root Cause Analysis of Namida's fatal `Bad state: Cannot add event after closing` bug
  * Prevention strategies in Electron/HTML5 Audio (avoiding unhandled IPC stream closures, Windows file lock handling, and race conditions during media swaps)
* [REMOVED_FEATURES.md](file:///C:/Users/kazir/Documents/Agentic%20Harness/Windows%20Exe/Music%20Manager/docs/REMOVED_FEATURES.md)
  * Complete audit trail of purged legacy Netease/Asian regional content, feeds, QR login, donate links, and non-English locales for clean upstream rebasing
  * **§7 Phase 3**: the v5.3.0 source-level English sweep, its four deliberate CJK exemptions (`transliteration.ts`, `i18n/lang/**`, the multilingual `HEADER_KEYWORD_RE`, the CJK font-preview sample), the `.sweep-gate.mjs` regression gate, and the re-sweep workflow to run after every upstream merge
