export type LyricsPosition = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type LyricsTriggerBand = 'subBass' | 'bass' | 'lowMid' | 'mid' | 'highMid' | 'presence' | 'brilliance' | 'air';
export type LyricsFontFamily = 'serif' | 'sans-serif';
export type LyricsStyleType = 'songyancai' | 'dynamic-bounce';

export interface LyricStyleConfig {
  activeFontSize: number;
  inactiveFontSize: number;
  fontColor: string;
  glowColor: string;
  followThemeGlow: boolean;
  karaokeColor: string;
  followThemeKaraoke: boolean;
  position: LyricsPosition;
  triggerBand: LyricsTriggerBand;
  fontFamily: LyricsFontFamily;
}

export interface LyricsSettings {
  style: LyricsStyleType;
  songyancai: LyricStyleConfig;
  'dynamic-bounce': LyricStyleConfig;
}

export const DEFAULT_STYLE_CONFIG: LyricStyleConfig = {
  activeFontSize: 32,
  inactiveFontSize: 18,
  fontColor: '#ffffff',
  glowColor: '#00ffff',
  followThemeGlow: true,
  karaokeColor: '#00ffff',
  followThemeKaraoke: true,
  position: 'center',
  triggerBand: 'subBass',
  fontFamily: 'serif',
};

export const DEFAULT_LYRICS_SETTINGS: LyricsSettings = {
  style: 'songyancai',
  songyancai: { ...DEFAULT_STYLE_CONFIG },
  'dynamic-bounce': { ...DEFAULT_STYLE_CONFIG },
};

const STORAGE_KEY = 'sonic_topography_lyrics_settings';

export function readLyricsSettingsStorage(): LyricsSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migration from old flat structure to nested structure
      if (parsed.activeFontSize !== undefined) {
         const oldConfig: LyricStyleConfig = {
           activeFontSize: parsed.activeFontSize ?? DEFAULT_STYLE_CONFIG.activeFontSize,
           inactiveFontSize: parsed.inactiveFontSize ?? DEFAULT_STYLE_CONFIG.inactiveFontSize,
           fontColor: parsed.fontColor ?? DEFAULT_STYLE_CONFIG.fontColor,
           glowColor: parsed.glowColor ?? DEFAULT_STYLE_CONFIG.glowColor,
           followThemeGlow: parsed.followThemeGlow ?? DEFAULT_STYLE_CONFIG.followThemeGlow,
           karaokeColor: parsed.karaokeColor ?? DEFAULT_STYLE_CONFIG.karaokeColor,
           followThemeKaraoke: parsed.followThemeKaraoke ?? DEFAULT_STYLE_CONFIG.followThemeKaraoke,
           position: parsed.position ?? DEFAULT_STYLE_CONFIG.position,
           triggerBand: parsed.triggerBand ?? DEFAULT_STYLE_CONFIG.triggerBand,
           fontFamily: parsed.fontFamily ?? DEFAULT_STYLE_CONFIG.fontFamily,
         };
         return {
           style: (parsed.style as LyricsStyleType) ?? 'songyancai',
           songyancai: { ...oldConfig },
           'dynamic-bounce': { ...oldConfig }
         };
      }
      return { ...DEFAULT_LYRICS_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to read lyrics settings from storage', e);
  }
  return DEFAULT_LYRICS_SETTINGS;
}

export function writeLyricsSettingsStorage(settings: LyricsSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to write lyrics settings to storage', e);
  }
}
