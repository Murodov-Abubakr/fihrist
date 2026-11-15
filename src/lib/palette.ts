import type { RotationId } from '../engine/rotation.ts';

/**
 * Rotation identity colours, used everywhere a rotation appears (cards, timeline, charts).
 * Fixed order baseline → waterSaving → regenerative. Validated against the dark panel surface #1E2126
 * with the dataviz skill's palette validator (OKLCH lightness band, chroma floor, adjacent-pair CVD
 * separation ΔE ≥ 8, normal-vision ΔE ≥ 15, contrast ≥ 3:1): all checks pass.
 * Rotations are always also named in text (labels, legend), so identity is never colour-alone.
 */
export const ROTATION_COLOR: Record<RotationId, string> = {
  baseline: '#CF7A4C', // copper
  waterSaving: '#6890DE', // blue
  regenerative: '#23A383', // green
};
