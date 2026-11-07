# Changelog

## v5.4.1

### Rebranding in Release Binaries & Update Repointing

- **Rebrand in Shipped Binaries**: Bumps version to `v5.4.1` and incorporates commit `ad01e26` into the CI release build. Shipped executables now correctly display "Music Manager" in the About window and installer metadata.
- **Update Check Repointed**: Fixed in-app update checker to query `Mostakim2005/music-manager` release endpoints instead of the upstream fork.
- **Progressive Information Architecture**: Standardized documentation with `docs/INDEX.md`, `docs/FEATURES.md`, and `docs/BUGS.md` alongside existing `docs/PRODUCT.md` and `docs/ARCHITECTURE.md`.
- **System & IPC Identity**: Updated Windows `AppUserModelId` to `com.musicmanager.app`, Linux MPRIS service to `MusicManager`, and removed residual telemetry scripts and old URLs.

## v5.4.0

### Linked Audio/Video Engine & Enhanced Library

- **Linked A/V Playback**: Muted video follows the audio master clock; one shared play state with zero audible gap when toggling modes.
- **Per-Song Media Reset**: Dropped stale video/artwork states across track changes.
- **Per-Codec Video Ladder**: Normalized height/codec format selection with video-only streams/downloads via bundled `yt-dlp`.
- **Responsive Synced Lyrics & Edit LRC**: Under-artwork lyric strip for narrow windows, inline timestamps, and +/- 0.1s adjustment controls.
- **Tag Editor & Metadata Repair**: In-player metadata repair using iTunes Search, MusicBrainz, and Cover Art Archive with native ID3v2/Vorbis/MP4 tagging.

## v5.3.5

### Smaller portable build: 474 MB → 447 MB (−27 MB)

Two packaging defects were shipping dead weight. Neither was a feature change;
both are pure size wins with no loss of functionality.

- **Removed a duplicate 79 MB ffmpeg.** `build.asarUnpack` unpacked the
  `ffmpeg-static` npm package *as well as* `extraResources` shipping
  `resources/bin/ffmpeg.exe`, so the installer carried two identical 79 MB
  binaries. The two were genuinely both in use — `youtube.ts` read
  `resources/bin`, while `tagAndMetadataManager.ts` read the unpacked npm copy.
  Both now resolve through the single `getFfmpegPath()` helper in `youtube.ts`,
  and the `ffmpeg-static` dependency is gone. `scripts/fetch-binaries.mjs` now
  downloads ffmpeg directly instead of copying it out of that package.
- **Ship one Electron locale instead of 55.** `build.electronLanguages` is set
  to `['en-US']`, dropping ~44 MB of Chromium locale paks for languages the app
  can never display (`src/i18n/lang/` contains only `en-US`).

### Build targets

- Added `npm run build:installer` (`electron-builder --win nsis`). The NSIS
  config was already complete and untouched; it simply had no script wired to
  it. The default `win.target` remains `portable`, which is the rapid-testing
  artifact; the installer is the intended shipping format later.

### Verified

`typecheck:node`, `typecheck:web`, `vitest` (18 files / 169 tests) all pass. The
packaged main bundle was inspected to confirm it no longer references
`ffmpeg-static` or `app.asar.unpacked`, and that both bundled binaries
(`ffmpeg.exe`, `yt-dlp.exe`) still execute from `resources/bin`.

**Not verified:** the GUI was not launched, because this environment cannot
initialize an Electron window (see `docs/BUGS.md` §6).

## v5.3.0

### Completed: English-only source sweep

The de-China work started in v5.2.0 is now finished. Every visible string, log
message, thrown `Error`, dialog title and code comment in `src/` is English.

- **Comments** — removed the remaining Chinese comment lines across `src/main`,
  `src/renderer` and `src/shared`. Where a comment carried the intent of an
  otherwise-empty `catch` block, it was rewritten in English rather than deleted,
  so no error handling became silent.
- **Runtime strings** — translated the remaining Chinese string literals:
  `console.*` diagnostics, IPC error responses, `throw new Error(...)` messages,
  notification titles/bodies, file-dialog titles, and tooltips.
- **Lyric parser diagnostics** — `yrcParser.ts` parse errors are now English.
- **Formatting** — `formatNumber()` used the Chinese myriad units `万`/`亿`; it
  now uses `M`/`B`.
- **Verified** — `typecheck:node`, `typecheck:web`, `vitest` (169 tests) and
  `electron-vite build` all pass. `eslint` reports no regressions.

### Also swept beyond `src/`

- **Build tooling** — comments and diagnostics in `eslint.config.mjs`,
  `vite.config.ts`, `electron.vite.config.ts`, `build/installer.nsh`,
  `scripts/check_i18n.ts`, `scripts/export_i18n_report.ts` and
  `scripts/fix-sandbox.js`.
- **GitHub workflows** — comments and step names in `pr-check.yml` and
  `deploy.yml`.
- **Issue templates** — the upstream `bug-report.zh-CN.yml` and
  `feature-report.zh-CN.yml` were replaced with English `bug-report.yml` and
  `feature-report.yml` rather than translated, since the project no longer ships
  other locales.
- **Tests** — incidental Chinese test names and comments translated. CJK used as
  *fixture data* is kept, because it is the thing under test: plugin metadata
  samples, Japanese/Chinese lyric strings for the translator, and a CJK filename
  for the tag writer.
- **Docs** — rewrote `README.md` for Music Manager (the upstream README still
  advertised the removed Netease account features) and removed the stale
  `DEV.md` and `docs/custom-api-readme.md`, which documented the deleted Netease
  custom API.

Two exemptions inside `src/` are deliberate and documented in
[REMOVED_FEATURES.md](docs/REMOVED_FEATURES.md) §7:

- `src/renderer/utils/lxListParser.ts` — a multilingual CSV header matcher that
  must recognise CJK/Korean/Japanese column names in user-imported lists.
- `src/i18n/lang/en-US/settings.ts` → `fontPreview.chineseText` — the CJK sample
  line used to preview font rendering. Translating it would defeat its purpose.

## v5.1.0

### ✨ 新功能

- 新增本地音乐扫描播放功能
- 新增播客页面与组件
- 新增专辑页面
- 桌面歌词新增 单行/双行/滚动 三种显示模式，支持翻译开关和双行分组淡出动画
- 重构自动更新系统，使用 electron-updater 替代手动下载
- 设置页新增音频设备配置
- 快捷键整体重构优化
- 重构 SearchBar，集成标题滚动显示功能
- 优化音源解析策略与播放逻辑
- 优化移动端适配与 UI 布局

### 🐛 Bug 修复

- 修复自动播放循环与暂停失效问题
- 修复桌面歌词窗口首次打开无歌词问题
- 修复播放并发控制死代码、shallowRef 响应式丢失、歌词 IPC 高频调用
- 修复 AppMenu 错误主题色
- 修复播放列表抽屉关闭动画使用 setTimeout 不可靠问题
- 修复搜索结果滚动加载触发距离过大
- 修复本地音乐元数据解析并发限流与封面体积限制
- 修复本地音乐扫描增量判断逻辑
- 修复 preload 层 ipc.on 解绑监听器失效
- 修复歌词缓存 IPC 通道未接入初始化
- 修复歌词组件卸载时 groupFadeTimer 未清理导致内存泄漏
- 补全 MV/排行榜/歌单/搜索/专辑页面缺失的国际化
- 修复 NeteaseCloudMusicApi anonymous_token 文件不存在导致启动崩溃
- 修复移动端全屏歌词前奏阶段第一句歌词不可见
- 修复移动端音乐列表页按钮尺寸过大
- 登录页扫码登录改为默认首选
- 设置桌面端最小窗口尺寸为 900×640 防止内容截断
- 移除首页顶部多余 padding
- HomeHero 快捷导航仅移动端显示

### 🔒 安全

- 本地音乐 API 仅监听回环地址，防止外部访问
- LX Music 脚本执行隔离到 Worker 沙箱

### 🎨 优化

- 全面重构 UI：播放器、播放条、通用组件、列表项、布局、标题栏、搜索页等
- 重构首页 UI
- 设置页拆分为 7 个独立 Tab 组件，优化捐赠列表性能
- 重构音乐和歌词缓存逻辑，支持可配置缓存目录
- 统一进度追踪机制，移除重复的 rAF 更新循环
- 优化播放列表持久化，精简序列化字段并添加防抖写入
- 优化骨架屏加载效果，修复用户页左侧黑色背景
- 统一 SongItem 圆角与 hover 背景色
- 重构历史记录模块
- 调整主题主色
- 扩展数据层与播放能力
- 增加 i18n 检查脚本与提交钩子
- 重构 i18n 键值检查并增加引用告警模式

## v5.0.0

### ✨ 新功能

- LX Music 音源脚本导入
- 逐字歌词，支持全屏歌词和桌面歌词同步显示
- 心动模式播放
- 移动设备整体页面风格和效果优化
- 移动端添加平板模式设置
- 歌词页面样式控制优化 支持背景、宽度、字体粗细等个性化设置
- 历史日推查看
- 播放记录热力图
- 历史记录支持本地和云端记录
- 用户页面收藏专辑展示
- 添加 GPU 硬件加速设置
- 菜单展开状态保存 - 感谢 [harenchi](https://github.com/souvenp) 的贡献
- 搜索建议 - 感谢 [harenchi](https://github.com/souvenp) 的贡献
- 歌词繁体中文翻译模块，集成 OpenCC 引擎 - 感谢 [Leko](https://github.com/lekoOwO) 的贡献
- 自定义 API源 支持 [自定义源文档](https://github.com/algerkong/AlgerMusicPlayer/blob/main/docs/custom-api-readme.md) - 感谢 [harenchi](https://github.com/souvenp) 的贡献

### 🐛 Bug 修复

- 修复随机播放顺序异常
- 修复音源解析错误处理
- 修复 Mini 播放栏主题颜色问题
- 修复桌面歌词透明模式标题栏显示
- 修复逐字歌词字间距
- 修复远程控制设置无法保存
- 修复下载无损格式返回 HiRes 音质 - 感谢 [harenchi](https://github.com/souvenp) 的贡献
- 兼容 pnpm 包管理器 - 感谢 [Leko](https://github.com/lekoOwO) 的贡献

### 🎨 优化

- 音源解析缓存
- 完善多语言国际化
- 优化播放检测和错误处理
- FLAC 元数据和封面图片处理 - 感谢 [harenchi](https://github.com/souvenp) 的贡献
- 日推不感兴趣调用官方接口 - 感谢 [harenchi](https://github.com/souvenp) 的贡献
- 代码提交流程优化，添加 lint-staged

## 赞赏支持☕️

[赞赏列表](https://donate.alger.fun/donate)

<table>
  <tr>
    <th style="text-align:center">微信赞赏</th>
    <th style="width:100px"></th>
    <th style="text-align:center">支付宝赞赏</th>
  </tr>
  <tr>
    <td align="center">
      <img src="https://github.com/algerkong/algerkong/blob/main/wechat.jpg?raw=true" alt="WeChat QRcode" width="200"><br>
      <h6>☕️喝点咖啡继续干</h6>
    </td>
    <td></td>
    <td align="center">
      <img src="https://github.com/algerkong/algerkong/blob/main/alipay.jpg?raw=true" alt="Alipay QRcode" width="200"><br>
      <h6>🍔来个汉堡</h6>
    </td>
  </tr>
</table>
