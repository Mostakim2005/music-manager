# Third-Party Notices

Music Manager itself is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).
It builds on open-source software that keeps its own license. This file lists every
direct dependency and bundled tool with its license, split by whether its code ships
inside the application.

License texts: [MIT](https://opensource.org/licenses/MIT) · [ISC](https://opensource.org/licenses/ISC) · [Apache-2.0](https://opensource.org/licenses/Apache-2.0) · [Unlicense](https://unlicense.org) · [GPL](https://www.gnu.org/licenses/gpl-2.0.html)

## Upstream projects this app is built on

| Project | Role | License | Upstream |
| --- | --- | --- | --- |
| AlgerMusicPlayer | Base engine (player, UI shell, Electron pipeline) — most of the source tree | MIT | [License](https://github.com/algerkong/AlgerMusicPlayer/blob/main/LICENSE) |
| YesPlayMusic | Ported utilities: lyric parser/aligner, IndexedDB schema, play/pause volume fade | MIT | [License](https://github.com/qier222/YesPlayMusic/blob/main/LICENSE) |
| Namida | Feature-design inspiration only (stacked player, video pill UX). No source code incorporated. | — | [Project](https://github.com/namidaco/Namida) |

## Ships inside the app

### Bundled binaries

| Package | License | Upstream license text |
| --- | --- | --- |
| ffmpeg (static binary in `resources/bin`) | GPL-2.0-or-later (build-dependent) | [ffmpeg legal](https://ffmpeg.org/legal.html) |
| yt-dlp (binary in `resources/bin`) | Unlicense | [License](https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE) |

### Production dependencies (in `app.asar`)

| Package | License | Upstream license text |
| --- | --- | --- |
| @electron-toolkit/preload | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @electron-toolkit/utils | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @httptoolkit/dbus-native | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @xhayper/discord-rpc | ISC | [ISC](https://opensource.org/licenses/ISC) |
| big-integer | Unlicense | [Unlicense](https://unlicense.org) |
| cheerio | MIT | [MIT](https://opensource.org/licenses/MIT) |
| cors | MIT | [MIT](https://opensource.org/licenses/MIT) |
| crypto-js | MIT | [MIT](https://opensource.org/licenses/MIT) |
| dayjs | MIT | [MIT](https://opensource.org/licenses/MIT) |
| dexie | Apache-2.0 | [Apache-2.0](https://opensource.org/licenses/Apache-2.0) |
| electron-store | MIT | [MIT](https://opensource.org/licenses/MIT) |
| electron-updater | MIT | [MIT](https://opensource.org/licenses/MIT) |
| electron-window-state | MIT | [MIT](https://opensource.org/licenses/MIT) |
| express | MIT | [MIT](https://opensource.org/licenses/MIT) |
| fflate | MIT | [MIT](https://opensource.org/licenses/MIT) |
| file-type | MIT | [MIT](https://opensource.org/licenses/MIT) |
| flac-tagger | Custom (see package LICENSE.md) | [npm package](https://www.npmjs.com/package/flac-tagger) |
| font-list | MIT | [MIT](https://opensource.org/licenses/MIT) |
| form-data | MIT | [MIT](https://opensource.org/licenses/MIT) |
| husky | MIT | [MIT](https://opensource.org/licenses/MIT) |
| jsencrypt | MIT | [MIT](https://opensource.org/licenses/MIT) |
| mpris-service | MIT | [MIT](https://opensource.org/licenses/MIT) |
| music-metadata | MIT | [MIT](https://opensource.org/licenses/MIT) |
| node-fetch | MIT | [MIT](https://opensource.org/licenses/MIT) |
| node-id3 | MIT | [MIT](https://opensource.org/licenses/MIT) |
| node-machine-id | MIT | [MIT](https://opensource.org/licenses/MIT) |
| node-vibrant | MIT | [MIT](https://opensource.org/licenses/MIT) |
| pinia-plugin-persistedstate | MIT | [MIT](https://opensource.org/licenses/MIT) |
| vue-i18n | MIT | [MIT](https://opensource.org/licenses/MIT) |

### Frameworks bundled into the renderer build

| Package | License | Upstream license text |
| --- | --- | --- |
| vue | MIT | [MIT](https://opensource.org/licenses/MIT) |
| vue-router | MIT | [MIT](https://opensource.org/licenses/MIT) |
| pinia | MIT | [MIT](https://opensource.org/licenses/MIT) |
| naive-ui | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @vueuse/core | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @vueuse/electron | MIT | [MIT](https://opensource.org/licenses/MIT) |
| axios | MIT | [MIT](https://opensource.org/licenses/MIT) |
| lodash | MIT | [MIT](https://opensource.org/licenses/MIT) |
| marked | MIT | [MIT](https://opensource.org/licenses/MIT) |
| howler | MIT | [MIT](https://opensource.org/licenses/MIT) |
| tunajs | MIT | [MIT](https://opensource.org/licenses/MIT) |
| tinycolor2 | MIT | [MIT](https://opensource.org/licenses/MIT) |
| animate.css | MIT | [MIT](https://opensource.org/licenses/MIT) |
| remixicon | Apache-2.0 | [Apache-2.0](https://opensource.org/licenses/Apache-2.0) |

## Build / test only — not shipped

| Package | License | Upstream license text |
| --- | --- | --- |
| @commitlint/cli, @commitlint/config-conventional | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @electron-toolkit/eslint-config, @electron-toolkit/eslint-config-ts, @electron-toolkit/tsconfig | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @eslint/js | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @rushstack/eslint-patch | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @types/howler, @types/node, @types/node-fetch, @types/tinycolor2 | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @typescript-eslint/eslint-plugin, @typescript-eslint/parser | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @vitejs/plugin-vue | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @vue/compiler-sfc | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @vue/eslint-config-prettier, @vue/eslint-config-typescript | MIT | [MIT](https://opensource.org/licenses/MIT) |
| @vue/runtime-core | MIT | [MIT](https://opensource.org/licenses/MIT) |
| autoprefixer | MIT | [MIT](https://opensource.org/licenses/MIT) |
| cross-env | MIT | [MIT](https://opensource.org/licenses/MIT) |
| electron | MIT | [MIT](https://opensource.org/licenses/MIT) |
| electron-builder | MIT | [MIT](https://opensource.org/licenses/MIT) |
| electron-vite | MIT | [MIT](https://opensource.org/licenses/MIT) |
| eslint, eslint-config-prettier, eslint-plugin-import, eslint-plugin-prettier, eslint-plugin-simple-import-sort, eslint-plugin-vue, eslint-plugin-vue-scoped-css | MIT | [MIT](https://opensource.org/licenses/MIT) |
| fake-indexeddb | Apache-2.0 | [Apache-2.0](https://opensource.org/licenses/Apache-2.0) |
| globals | MIT | [MIT](https://opensource.org/licenses/MIT) |
| lint-staged | MIT | [MIT](https://opensource.org/licenses/MIT) |
| pinyin-match | MIT | [MIT](https://opensource.org/licenses/MIT) |
| png-to-ico | MIT | [MIT](https://opensource.org/licenses/MIT) |
| postcss | MIT | [MIT](https://opensource.org/licenses/MIT) |
| prettier | MIT | [MIT](https://opensource.org/licenses/MIT) |
| sass | MIT | [MIT](https://opensource.org/licenses/MIT) |
| sharp | Apache-2.0 | [Apache-2.0](https://opensource.org/licenses/Apache-2.0) |
| tailwindcss | MIT | [MIT](https://opensource.org/licenses/MIT) |
| typescript | Apache-2.0 | [Apache-2.0](https://opensource.org/licenses/Apache-2.0) |
| unplugin-auto-import, unplugin-vue-components | MIT | [MIT](https://opensource.org/licenses/MIT) |
| vite, vite-plugin-compression, vite-plugin-vue-devtools | MIT | [MIT](https://opensource.org/licenses/MIT) |
| vitest | MIT | [MIT](https://opensource.org/licenses/MIT) |
| vue-eslint-parser | MIT | [MIT](https://opensource.org/licenses/MIT) |
| vue-tsc | MIT | [MIT](https://opensource.org/licenses/MIT) |
