# Music Manager — Progressive Information Architecture Index (`INDEX.md`)
> **Level 0 Navigation Map:** Central entry point for project architecture, feature catalog, defect log, and design decisions.

---

## Architecture & Documentation Layers

```
docs/
├── INDEX.md                 # Level 0: Layered Table of Contents & Navigation Map (this file)
├── ARCHITECTURE.md          # Level 1-2: System Design, Component Map, Techniques & Data Flow
├── PRODUCT.md               # Level 2: Product Intent, User Experience & Non-Negotiables
├── FEATURES.md              # Level 2-3: Active Feature Catalog with Direct Code Anchors
├── BUGS.md                  # Level 2-3: Defect & Resolution Log with RCA and Fix Strategies
├── DECISIONS_AND_TRAPS.md   # Level 2-3: Architectural Pivots, Options Considered & Landmines
├── VISUAL_GUIDE.html        # Visual Reference: Interactive HTML guide with interface screenshots
├── MIGRATION_AUDIT_2026-11-07.md # Full Migration & Release Audit Dossier
└── legacy/                  # Historical Pre-Migration Archives
    ├── ARCHITECTURE.legacy.md
    ├── FEATURES.legacy.md
    ├── BUGS.legacy.md
    ├── INDEX.legacy.md
    ├── REMOVED_FEATURES.legacy.md
    └── HANDOFF.md
```

---

## Progressive Layer Guide

* **Level 0: Quick Overview & Entry**
  * Repository: [`Mostakim2005/music-manager`](https://github.com/Mostakim2005/music-manager)
  * Target Platform: Windows 10/11 (Portable `.exe` and NSIS Setup `.exe`)
  * Core Engine: Vue 3 + TypeScript + Electron + Tailwind + Dexie + `yt-dlp` / `ffmpeg`

* **Level 1: System Design & Lifecycle**
  * Read [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for data flow, state management (`Pinia`), IPC protocols, and audio engine architecture.

* **Level 2: Features & Product Intent**
  * Read [`docs/PRODUCT.md`](PRODUCT.md) for user intent and feature requirements.
  * Read [`docs/FEATURES.md`](FEATURES.md) for direct grep targets and code anchors.

* **Level 3: Defensive Engineering & Bug Resolution**
  * Read [`docs/BUGS.md`](BUGS.md) for resolved defects, root causes, and regression prevention.
  * Read [`docs/DECISIONS_AND_TRAPS.md`](DECISIONS_AND_TRAPS.md) for architectural landmines and rejected options.
  * Consult [`docs/legacy/`](legacy/) for historical research comparing YesPlayMusic and Namida.
