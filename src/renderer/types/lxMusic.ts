/**
 *
 */

/**
 */
export type LxScriptInfo = {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  homepage?: string;
  rawScript: string;
};

/**
 */
export type LxQuality = '128k' | '320k' | 'flac' | 'flac24bit';

/**
 */
export type LxSourceKey = 'kw' | 'kg' | 'tx' | 'wy' | 'mg' | 'local';

/**
 */
export type LxSourceConfig = {
  name: string;
  type: 'music';
  actions: ('musicUrl' | 'lyric' | 'pic')[];
  qualitys: LxQuality[];
};

/**
 */
export type LxInitedData = {
  openDevTools?: boolean;
  sources: Partial<Record<LxSourceKey, LxSourceConfig>>;
};

/**
 */
export type LxRequestData = {
  source: LxSourceKey;
  action: 'musicUrl' | 'lyric' | 'pic';
  info: {
    type: LxQuality | null;
    musicInfo: LxMusicInfo;
  };
};

/**
 */
export type LxMusicInfo = {
  songmid: string | number;
  name: string;
  singer: string;
  album?: string;
  albumId?: string | number;
  source?: string;
  interval?: string;
  img?: string;
  types?: { type: LxQuality; size?: string }[];
};

/**
 */
export type LxLyricResult = {
  lyric: string;
  tlyric?: string | null;
  rlyric?: string | null;
  lxlyric?: string | null;
};

/**
 */
export type LxMusicScriptConfig = {
  id: string;
  name: string;
  script: string;
  info: LxScriptInfo;
  sources: LxSourceKey[];
  enabled: boolean;
  createdAt: number;
};

/**
 */
export type LxMusicApiList = {
  apis: LxMusicScriptConfig[];
  activeId: string | null;
};

/**
 */
export const LX_EVENT_NAMES = {
  inited: 'inited',
  request: 'request',
  updateAlert: 'updateAlert'
} as const;

/**
 */
export const LX_SOURCE_NAMES: Record<LxSourceKey, string> = {
  kw: 'kw',
  kg: 'kg',
  tx: 'tx',
  wy: 'wy',
  mg: 'mg',
  local: 'local'
};

/**
 */
export const QUALITY_TO_LX: Record<string, LxQuality> = {
  standard: '128k',
  higher: '320k',
  exhigh: '320k',
  lossless: 'flac',
  hires: 'flac24bit',
  jyeffect: 'flac',
  sky: 'flac',
  dolby: 'flac',
  jymaster: 'flac24bit'
};
