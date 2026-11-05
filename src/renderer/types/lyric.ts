export interface LyricConfig {
  hideCover: boolean;
  centerLyrics: boolean;
  fontSize: number;
  letterSpacing: number;
  fontWeight: number;
  lineHeight: number;
  showTranslation: boolean;
  showRomanization?: boolean;
  /** Show each lyric line's start time (mm:ss,ms) beside the line. */
  showLineTimes?: boolean;
  theme: 'default' | 'light' | 'dark';
  hidePlayBar: boolean;
  translationEngine?: 'none' | 'opencc';
  pureModeEnabled: boolean;
  hideMiniPlayBar: boolean;
  hideLyrics: boolean;
  focusCurrentLyric: boolean;
  contentWidth: number;
  mobileLayout: 'default' | 'ios' | 'android';
  mobileCoverStyle: 'record' | 'square' | 'full';
  mobileShowLyricLines: number;
  useCustomBackground: boolean;
  backgroundMode: 'solid' | 'gradient' | 'image' | 'css';
  solidColor: string;
  gradientColors: {
    colors: string[];
    direction: string;
  };
  backgroundImage?: string;
  imageBlur: number;
  imageBrightness: number;
  customCss?: string;
  // C5 Layouts (Side-by-side vs Stacked Namida-style)
  layoutMode?: 'side-by-side' | 'stacked';
  compactLyrics?: boolean;
  lyricsUnderArtwork?: boolean;
}

export const DEFAULT_LYRIC_CONFIG: LyricConfig = {
  hideCover: false,
  centerLyrics: false,
  fontSize: 22,
  letterSpacing: 0,
  fontWeight: 500,
  lineHeight: 2,
  showTranslation: true,
  showRomanization: true,
  showLineTimes: true,
  theme: 'default',
  hidePlayBar: true,
  hideMiniPlayBar: false,
  pureModeEnabled: false,
  hideLyrics: false,
  focusCurrentLyric: false,
  contentWidth: 75,
  mobileLayout: 'ios',
  mobileCoverStyle: 'full',
  mobileShowLyricLines: 3,
  translationEngine: 'none',
  useCustomBackground: false,
  backgroundMode: 'solid',
  solidColor: '#1a1a1a',
  gradientColors: {
    colors: ['#1a1a1a', '#000000'],
    direction: 'to bottom'
  },
  backgroundImage: undefined,
  imageBlur: 0,
  imageBrightness: 100,
  customCss: undefined,
  layoutMode: 'side-by-side',
  compactLyrics: false,
  lyricsUnderArtwork: false
};

export interface ILyric {
  sgc: boolean;
  sfy: boolean;
  qfy: boolean;
  lrc: Lrc;
  klyric: Lrc;
  tlyric: Lrc;
  romalrc?: Lrc;
  yrc?: Lrc;
  ytlrc?: Lrc;
  yromalrc?: Lrc;
  lyricUser?: unknown;
  transUser?: unknown;
  code: number;
}

interface Lrc {
  version: number;
  lyric: string;
}
