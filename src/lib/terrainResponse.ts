const MAX_KICK_DEFORM = 0.75;
const KICK_IMPULSE_GAIN = 0.35;
const KICK_TARGET_DECAY_RATE = 10;
const KICK_CURRENT_RESPONSE_RATE = 18;
const MAX_SHADER_SUB_BASS = 1.2;
const MAX_SHADER_BASS = 1.15;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function clampAnimationBlend(value: number) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

export function applyKickImpulse(currentTarget: number, strength: number) {
  const safeTarget = Number.isFinite(currentTarget) ? currentTarget : 0;
  const safeStrength = Number.isFinite(strength) ? Math.max(0, strength) : 0;
  return clamp(safeTarget + safeStrength * KICK_IMPULSE_GAIN, 0, MAX_KICK_DEFORM);
}

export function stepKickDeform({
  current,
  target,
  delta,
}: {
  current: number;
  target: number;
  delta: number;
}) {
  const safeDelta = Math.max(0, Number.isFinite(delta) ? delta : 0);
  const targetBlend = clampAnimationBlend(KICK_TARGET_DECAY_RATE * safeDelta);
  const currentBlend = clampAnimationBlend(KICK_CURRENT_RESPONSE_RATE * safeDelta);
  const nextTarget = clamp(target + (0 - target) * targetBlend, 0, MAX_KICK_DEFORM);
  const nextCurrent = clamp(current + (nextTarget - current) * currentBlend, 0, MAX_KICK_DEFORM);

  return { current: nextCurrent, target: nextTarget };
}

export function mixKickIntoLowBands({
  subBass,
  bass,
  kickDeform,
}: {
  subBass: number;
  bass: number;
  kickDeform: number;
}) {
  const safeKick = clamp(Number.isFinite(kickDeform) ? kickDeform : 0, 0, MAX_KICK_DEFORM);

  return {
    subBass: clamp(subBass + safeKick * 0.55, 0, MAX_SHADER_SUB_BASS),
    bass: clamp(bass + safeKick * 0.35, 0, MAX_SHADER_BASS),
  };
}
