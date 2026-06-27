export const GROUND_EQ_STORAGE_KEY = 'sonic-topography-ground-eq-v1';
export const GROUND_EQ_BAND_COUNT = 8;
export const DEFAULT_GROUND_EQ_VALUE = 50;
export const DEFAULT_GROUND_MOTION_SPEED = 50;

export type GroundEqBandId =
  | 'subBass'
  | 'bass'
  | 'lowMid'
  | 'mid'
  | 'highMid'
  | 'presence'
  | 'brilliance'
  | 'air';

export interface StoredGroundEqSettings {
  bands: number[];
  motionSpeed: number;
}

export const GROUND_EQ_BAND_IDS: GroundEqBandId[] = [
  'subBass',
  'bass',
  'lowMid',
  'mid',
  'highMid',
  'presence',
  'brilliance',
  'air',
];

export const defaultGroundEqBands = new Array(GROUND_EQ_BAND_COUNT).fill(DEFAULT_GROUND_EQ_VALUE);

const LEGACY_CURVE_BAND_INDEXES = [0, 2, 4, 6, 8, 11, 12, 15];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeBandValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(Math.round(numeric), 0, 100) : DEFAULT_GROUND_EQ_VALUE;
}

function normalizeMotionSpeed(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(Math.round(numeric), 0, 100) : DEFAULT_GROUND_MOTION_SPEED;
}

function bandsFromLegacyCurve(curve: unknown[]) {
  return LEGACY_CURVE_BAND_INDEXES.map((index) => normalizeBandValue(curve[index]));
}

export function normalizeGroundEqSettings(value: Partial<StoredGroundEqSettings> & { curve?: unknown[] } | null | undefined): StoredGroundEqSettings {
  const source = Array.isArray(value?.bands)
    ? value.bands
    : (Array.isArray(value?.curve) ? bandsFromLegacyCurve(value.curve) : defaultGroundEqBands);
  const bands = Array.from({ length: GROUND_EQ_BAND_COUNT }, (_, index) => normalizeBandValue(source[index]));
  return { bands, motionSpeed: normalizeMotionSpeed(value?.motionSpeed) };
}

export function readGroundEqSettingsStorage(): StoredGroundEqSettings {
  if (typeof window === 'undefined') return { bands: defaultGroundEqBands, motionSpeed: DEFAULT_GROUND_MOTION_SPEED };

  try {
    const raw = window.localStorage.getItem(GROUND_EQ_STORAGE_KEY);
    return normalizeGroundEqSettings(raw ? JSON.parse(raw) : undefined);
  } catch (error) {
    console.warn('Unable to read ground EQ settings:', error);
    return { bands: defaultGroundEqBands, motionSpeed: DEFAULT_GROUND_MOTION_SPEED };
  }
}

export function writeGroundEqSettingsStorage(settings: StoredGroundEqSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GROUND_EQ_STORAGE_KEY, JSON.stringify(normalizeGroundEqSettings(settings)));
}

export function readGroundEqBandValue(bands: number[], band: GroundEqBandId) {
  const normalized = normalizeGroundEqSettings({ bands }).bands;
  const index = GROUND_EQ_BAND_IDS.indexOf(band);
  return normalized[index >= 0 ? index : 0];
}

export function applyGroundEqBandValue(value: number, bands: number[], band: GroundEqBandId) {
  const eq = readGroundEqBandValue(bands, band);
  const delta = (eq - DEFAULT_GROUND_EQ_VALUE) / DEFAULT_GROUND_EQ_VALUE;

  if (delta >= 0) {
    return clamp(value * (1 + delta * 1.8), 0, 1);
  }

  const dullness = Math.abs(delta);
  return clamp(Math.max(0, value - dullness * 0.35) * (1 - dullness * 0.35), 0, 1);
}
