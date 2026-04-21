import type { Viseme } from "../hooks/useVisemeTrack";

/**
 * Map our 10 visemes to ARKit-style blendshape targets.
 *
 * The target object is a partial dict of blendshape-name → weight in [0, 1].
 * Keys that are not supported by the currently loaded model are silently
 * ignored by the runtime, so we over-specify for robustness.
 *
 * Values are hand-tuned to read as the matching English phoneme. Tweak in
 * concert with `BLEND_LERP_PER_SECOND` in AvatarStage3D to balance
 * responsiveness vs. smoothness.
 */
export type BlendTarget = Partial<Record<string, number>>;

export const VISEME_BLENDSHAPES: Record<Viseme, BlendTarget> = {
  rest: {},

  // /æ/ cat — wide open mouth, slight horizontal stretch
  ae: {
    jawOpen: 0.45,
    mouthStretchLeft: 0.3,
    mouthStretchRight: 0.3,
    mouthSmileLeft: 0.15,
    mouthSmileRight: 0.15,
  },

  // /ɑː/ father — deep open, dropped jaw
  ah: {
    jawOpen: 0.65,
    mouthShrugLower: 0.2,
    mouthFunnel: 0.1,
  },

  // /iː/ see — wide smile, teeth showing
  ee: {
    mouthSmileLeft: 0.75,
    mouthSmileRight: 0.75,
    jawOpen: 0.08,
    mouthStretchLeft: 0.1,
    mouthStretchRight: 0.1,
  },

  // /ɪ/ bit — soft wide
  ih: {
    mouthSmileLeft: 0.35,
    mouthSmileRight: 0.35,
    jawOpen: 0.15,
  },

  // /uː/ boot — round, puckered
  oo: {
    mouthPucker: 0.8,
    jawOpen: 0.12,
    mouthFunnel: 0.2,
  },

  // /aɪ/ my — smile-ish with jaw drop
  ai: {
    mouthSmileLeft: 0.5,
    mouthSmileRight: 0.5,
    jawOpen: 0.3,
  },

  // /aʊ/ now — open funnel
  ow: {
    mouthFunnel: 0.55,
    mouthPucker: 0.3,
    jawOpen: 0.4,
  },

  // /p, b, m/ — closed, pressed lips
  mbp: {
    mouthClose: 0.7,
    mouthPressLeft: 0.4,
    mouthPressRight: 0.4,
    mouthRollLower: 0.2,
    mouthRollUpper: 0.2,
  },

  // /s, z, ʃ/ — teeth together, minimal opening
  sz: {
    mouthSmileLeft: 0.35,
    mouthSmileRight: 0.35,
    jawOpen: 0.05,
    mouthShrugUpper: 0.1,
  },
};

/**
 * Some GLB exports use naming variants. Try `name`, then underscore-
 * separated, then lowercase; return the first one that exists in the
 * model's morph target dictionary, or null.
 */
export function resolveBlendshapeName(
  name: string,
  dictionary: Record<string, number>,
): string | null {
  if (name in dictionary) return name;
  const snake = name.replace(/([A-Z])/g, "_$1").toLowerCase();
  if (snake in dictionary) return snake;
  // ARKit "mouthSmileLeft" → "mouthSmile_L" on some exports.
  const short = name
    .replace(/Left$/, "_L")
    .replace(/Right$/, "_R");
  if (short in dictionary) return short;
  const lower = name.toLowerCase();
  if (lower in dictionary) return lower;
  return null;
}
