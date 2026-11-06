# Upstream provenance and attribution

This file records exactly where the source in this repository comes from, so that
anyone can tell which code is original to Music Manager and which was inherited
under an open-source license.

## Lineage

Music Manager is an **independent derivative** of
[AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer), forked from
commit `f57204d` on **2026-10-28**. The repository was created by cloning the
upstream project locally, re-rooting the history into a new repository
(`Mostakim2005/music-manager`), and developing on top of it. It is **not a GitHub
fork** — there is no "forked from" banner — so this file exists to document the
relationship instead.

| Fact | Value |
| --- | --- |
| Fork point (upstream commit) | `f57204d` — *fix(history): 云端播放记录入口对扫码登录用户开放*, 2026-10-28 |
| Commits imported from upstream | 857 |
| Commits authored in this repository | 16 |
| Upstream last release | `v5.1.0`, published 2026-03-22 |
| Upstream source activity after that release | One source commit (the fork point), no release |

> **Contributor notice.** GitHub lists the upstream authors as contributors of this
> repository because their commits are present in its history. That listing is
> accurate and is left intact deliberately — it reflects real authorship of the
> inherited code. It is not an endorsement of Music Manager by those authors.

## What originates where

| Area | Origin | License |
| --- | --- | --- |
| Electron application shell, window/preload plumbing | AlgerMusicPlayer | MIT (© Alger) |
| Player core, queue, playback controller, Pinia stores | AlgerMusicPlayer | MIT (© Alger) |
| Renderer layout, settings surfaces, component library | AlgerMusicPlayer | MIT (© Alger) |
| HTTP client, download manager, update pipeline | AlgerMusicPlayer | MIT (© Alger) |
| Lyric parser / aligner, IndexedDB schema, volume fade | YesPlayMusic | MIT (© 2020-2023 qier222) |
| Stacked fullscreen player, video pill UX | Namida | Feature-design inspiration only — no source incorporated |
| Local-first library with linked A/V variants and acoustic fingerprint index | Music Manager | PolyForm Noncommercial |
| Per-codec video quality ladder via bundled `yt-dlp` | Music Manager | PolyForm Noncommercial |
| Edit LRC, word-by-word karaoke, romanization | Music Manager | PolyForm Noncommercial |
| Listening Stats, A-B loop, bookmarks, `.m3u8` / `.json` backup | Music Manager | PolyForm Noncommercial |
| English-only source sweep and removal of the cloud/CJK layer | Music Manager | PolyForm Noncommercial |
| "Music Manager" rebrand, logo and icons | Music Manager | PolyForm Noncommercial |

The authoritative list of every dependency and its license is
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), which reproduces the MIT
notice text required by both upstream projects.

## Upstream policy

This repository **does not track upstream**. The `upstream` remote is kept only as
a historical reference for the fork point; no further commits are merged from it.
Fixes are not sent upstream either — this is a standalone derivative.

## Licensing consequence

Because the inherited source is MIT, its copyright notices must be preserved in
this repository and in every distributed build. They are:
`© Alger`, and `© 2020-2023 qier222`. Music Manager's own additions are
`© 2026 Mostakim2005` under the PolyForm Noncommercial License 1.0.0. The MIT
license permits distribution of the combined work, but it does **not** permit
stripping those notices — see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
