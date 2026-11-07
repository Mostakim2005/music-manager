# Defect & Resolution Log (`BUGS.md`)
> **1-Line Summary:** Catalogs resolved architectural and packaging defects, Root Cause Analysis (RCA), and verification strategies.

---

## Active Defect Log

### [BUG-001] Release v5.4.0 Timing Gap & Shipped Binary Upstream Endpoints
* **Issue Symptom:** The published `v5.4.0` Windows binaries (Portable and Setup) displayed "Alger" in the About dialog, and the in-app update checker queried `algerkong/AlgerMusicPlayer` instead of `Mostakim2005/music-manager`.
* **Root Cause Analysis (RCA):**
  * Tag `v5.4.0` was placed on commit `28008e1` on 6 Nov at 13:21 (Dhaka time), triggering CI release build run `42180321408`.
  * The rebrand commit `ad01e26` (repointing identity, CODEOWNERS, update check URLs, and author attribution) was committed and pushed at 15:35, two hours *after* the release binaries were built and published.
  * Consequently, the cloud repository contained the rebrand on `main`, but the downloadable `v5.4.0` binaries did not.
* **Resolution Strategy:**
  1. Bump version from `5.4.0` to `5.4.1` in `package.json`.
  2. Sweep and remediate residual upstream references:
     * `src/renderer/utils/update.ts`: repoint release fallback URL to `Mostakim2005/music-manager/releases/latest`.
     * `src/renderer/components/common/InstallAppModal.vue`: update app name to "Music Manager" and download URL to official release page.
     * `src/renderer/index.html`: set `<html lang="en">` and remove legacy external Baidu tracking telemetry scripts.
     * `src/main/index.ts`: set Windows `AppUserModelId` to `com.musicmanager.app`.
     * `src/main/modules/mpris.ts`: update MPRIS player name to `MusicManager`.
     * `src/main/modules/fileManager.ts` & `scripts/fetch-binaries.mjs`: set User-Agent to `MusicManager/5.4.1`.
     * `resources/manifest.json`: update application name, short name, and description.
  3. Commit and tag `v5.4.1` from `main` to trigger a clean CI build producing verified binaries.
* **Code Anchors:**
  * `package.json`
  * `src/renderer/utils/update.ts`
  * `src/renderer/components/common/InstallAppModal.vue`
  * `src/renderer/index.html`
  * `src/main/index.ts`
  * `src/main/modules/mpris.ts`

---

### [BUG-002] Nested Local Repository Scaffolding Trap
* **Issue Symptom:** The workspace folder contained two nested `.git` directories: an outer repository (`master`, 10 commits, no remote) and an inner repository (`AlgerMusicPlayer/`, `main`, remote `Mostakim2005/music-manager`).
* **Root Cause Analysis (RCA):**
  * Outer repository was the initial research workspace scaffold used to draft documentation before code development.
  * All documentation was subsequently migrated and archived into `AlgerMusicPlayer/docs/legacy/` and pushed to GitHub.
  * The presence of the outer `.git` posed a trap where tools or agents could inadvertently commit to the local-only outer repository instead of the real repository.
* **Resolution Strategy:**
  1. Verify byte-for-byte fidelity of all outer docs vs `AlgerMusicPlayer/docs/legacy/`.
  2. Ensure the GitHub cloud repository is 100% self-sufficient.
  3. Retire the outer `.git` directory and mark `AlgerMusicPlayer` (or root clone of `Mostakim2005/music-manager`) as the sole authoritative repository.
