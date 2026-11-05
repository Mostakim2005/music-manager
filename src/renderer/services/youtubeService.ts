/**
 * Typed frontend service wrapper for the backend YouTube engine.
 * Supports searching YouTube/YouTube Music, inspecting formats, resolving stream URLs
 * (including progressive direct playback and local muxed proxy playback), managing downloads,
 * and reading/writing embedded YouTube link tags.
 */

import {
  extractVideoId,
  type YtAudioFormat,
  type YtFormatsResult,
  type YtSearchResult,
  type YtVideoFormat
} from '../../main/modules/youtubeFormats';

export type { YtAudioFormat, YtFormatsResult, YtSearchResult, YtVideoFormat };

export interface YtStreamUrlResult {
  videoUrl: string;
  audioUrl?: string;
  headers?: Record<string, string>;
  isMuxedProxy?: boolean;
}

export interface YtDownloadOptions {
  kind: 'audio' | 'video';
  height?: number;
  audioFormat?: 'm4a' | 'mp3' | 'opus';
  targetDir?: string;
  fileBaseName?: string;
  embedLink?: boolean;
}

export interface YtDownloadProgress {
  jobId: string;
  percent: number;
  speed: string;
  eta: string;
  state: 'queued' | 'downloading' | 'processing' | 'completed' | 'cancelled' | 'error';
  filePath?: string;
  error?: string;
}

export interface YtBinaryStatus {
  ytDlp: {
    installed: boolean;
    path: string;
    version: string | null;
  };
  ffmpeg: {
    installed: boolean;
    path: string;
    version: string | null;
  };
}

/**
 * Accesses the underlying YouTube bridge from window.youtube or window.api.youtube.
 */
function getBridge() {
  if (typeof window !== 'undefined') {
    if ((window as any).youtube) return (window as any).youtube;
    if ((window as any).api?.youtube) return (window as any).api.youtube;
    if ((window as any).ipcRenderer) {
      // Fallback direct IPC invoker
      const ipc = (window as any).ipcRenderer;
      return {
        search: (q: string, opt?: any) => ipc.invoke('yt:search', q, opt),
        formats: (id: string) => ipc.invoke('yt:formats', id),
        streamUrl: (id: string, opt?: any) => ipc.invoke('yt:streamUrl', id, opt),
        download: (id: string, opt: any) => ipc.invoke('yt:download', id, opt),
        cancelDownload: (jobId: string) => ipc.invoke('yt:cancelDownload', jobId),
        readLink: (path: string) => ipc.invoke('yt:readLink', path),
        writeLink: (path: string, url: string) => ipc.invoke('yt:writeLink', path, url),
        resolveDownloadDir: (ctx?: string) => ipc.invoke('yt:resolveDownloadDir', ctx),
        binaryStatus: () => ipc.invoke('yt:binaryStatus'),
        updateBinary: () => ipc.invoke('yt:updateBinary'),
        onDownloadProgress: (cb: (data: any) => void) => {
          return ipc.on('yt:download-progress', cb);
        }
      };
    }
  }
  throw new Error('YouTube bridge is not available in the current context');
}

export const youtubeService = {
  /**
   * Extracts an 11-character YouTube video ID from any URL (watch, shorts, youtu.be, embed, music.youtube.com)
   * or returns the direct 11-char ID. Runs purely client-side without IPC.
   */
  extractVideoId(urlOrId: string | null | undefined): string | null {
    return extractVideoId(urlOrId);
  },

  /**
   * Searches YouTube or YouTube Music with flat playlist extraction.
   */
  async search(
    query: string,
    options?: { limit?: number; type?: 'video' | 'music' }
  ): Promise<YtSearchResult[]> {
    return getBridge().search(query, options);
  },

  /**
   * Retrieves grouped and mapped video/audio formats for a video ID or URL.
   */
  async getFormats(idOrUrl: string): Promise<YtFormatsResult> {
    return getBridge().formats(idOrUrl);
  },

  /**
   * Resolves a playable stream URL.
   * If a matching progressive format (e.g. 720p or 360p) exists, returns direct progressive URL.
   * For DASH streams (e.g. 1080p), spins up the local muxing proxy and returns local streaming URL.
   */
  async getStreamUrl(
    idOrUrl: string,
    options?: { kind?: 'audio' | 'video'; height?: number; preferProgressive?: boolean }
  ): Promise<YtStreamUrlResult> {
    return getBridge().streamUrl(idOrUrl, options);
  },

  /**
   * Initiates media download in the background.
   * Returns the unique jobId.
   */
  async download(idOrUrl: string, options: YtDownloadOptions): Promise<string> {
    return getBridge().download(idOrUrl, options);
  },

  /**
   * Subscribes to download progress events for all downloads.
   * Returns an unsubscribe function.
   */
  onDownloadProgress(callback: (progress: YtDownloadProgress) => void): () => void {
    return getBridge().onDownloadProgress(callback);
  },

  /**
   * Starts a download and subscribes to progress events for this specific job.
   * Returns the jobId and an unsubscribe function.
   */
  async downloadWithProgress(
    idOrUrl: string,
    options: YtDownloadOptions,
    onProgress: (progress: YtDownloadProgress) => void
  ): Promise<{ jobId: string; unsubscribe: () => void }> {
    const bridge = getBridge();
    const jobId = await bridge.download(idOrUrl, options);

    const unsubscribe = bridge.onDownloadProgress((data: YtDownloadProgress) => {
      if (data && data.jobId === jobId) {
        onProgress(data);
      }
    });

    return { jobId, unsubscribe };
  },

  /**
   * Cancels a running download job.
   */
  async cancelDownload(jobId: string): Promise<boolean> {
    return getBridge().cancelDownload(jobId);
  },

  /**
   * Reads an embedded YouTube link/ID from an audio or video file's metadata tags.
   */
  async readLink(filePath: string): Promise<string | null> {
    return getBridge().readLink(filePath);
  },

  /**
   * Writes an embedded YouTube link into an audio or video file's metadata tags.
   */
  async writeLink(filePath: string, youtubeUrl: string): Promise<{ ok: boolean; error?: string }> {
    return getBridge().writeLink(filePath, youtubeUrl);
  },

  /**
   * Resolves the target download directory using `mediaDownloadDir` setting or context file.
   */
  async resolveDownloadDir(contextFilePath?: string): Promise<string> {
    return getBridge().resolveDownloadDir(contextFilePath);
  },

  /**
   * Checks the status and version of yt-dlp and ffmpeg binaries.
   */
  async getBinaryStatus(): Promise<YtBinaryStatus> {
    return getBridge().binaryStatus();
  },

  /**
   * Runs self-update on the yt-dlp binary (`yt-dlp -U`).
   */
  async updateBinary(): Promise<{ success: boolean; output: string; version: string | null }> {
    return getBridge().updateBinary();
  },

  /**
   * Initializes global download listener to automatically ingest completed downloads into songLibrary
   */
  initGlobalDownloadWatcher(): () => void {
    try {
      return this.onDownloadProgress(async (data: YtDownloadProgress) => {
        if (data.state === 'completed' && data.filePath) {
          try {
            const filePath = data.filePath;
            const ext = filePath.split('.').pop()?.toLowerCase();
            const isVideo = ['mp4', 'mkv', 'webm', 'mov'].includes(ext || '');
            const basename =
              filePath
                .replace(/\\/g, '/')
                .split('/')
                .pop()
                ?.replace(/\.[^.]+$/, '') || '';
            let [title, artist] = basename.split(' - ').map((s) => s.trim());
            if (!artist) {
              artist = 'YouTube';
            }

            const { ingestLocalTrack, linkVariant } = await import('@/services/songLibrary');
            const ingestRes = await ingestLocalTrack({
              path: filePath,
              title: title || basename,
              artist,
              durationSec: 0,
              container: ext,
              hasVideo: isVideo
            });

            if (ingestRes.songId) {
              await linkVariant(ingestRes.songId, {
                kind: isVideo ? 'video' : 'audio',
                source: 'download',
                path: filePath,
                container: ext,
                addedAt: Date.now()
              });
            }
          } catch (err) {
            console.error('[youtubeService] Failed to ingest completed download:', err);
          }
        }
      });
    } catch {
      return () => {};
    }
  }
};

// Start watching download completions in renderer context
if (typeof window !== 'undefined') {
  try {
    youtubeService.initGlobalDownloadWatcher();
  } catch {
    // Ignore in SSR / testing environments
  }
}

export default youtubeService;
