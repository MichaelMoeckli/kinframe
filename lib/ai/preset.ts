/**
 * The single source of truth for what a Kinframe portrait looks like.
 * Every generation — mock, real, bake-off — pulls from here.
 *
 * Locked decisions land here. A/B experiments override individual fields.
 */

export type AiPreset = {
  id: string;
  /** Human-facing label, e.g. "Painterly v1" */
  label: string;
  /**
   * Primary prompt. Describes the *outcome* of the painting, never references
   * AI, never invokes Ghibli or any specific IP, never uses the word "filter".
   */
  prompt: string;
  /** Negative prompt — things we never want in the output. */
  negativePrompt: string;
  /**
   * Strength of the painterly transformation (img2img / kontext models).
   * Higher = more painterly, lower = closer to the original photo.
   * Sweet spot for face-preserving painterly looks: 0.55–0.75.
   */
  strength: number;
  /** Guidance scale (text-prompt adherence). FLUX models: 2.5–4 is typical. */
  guidance: number;
};

export const PAINTERLY_V1: AiPreset = {
  id: "painterly-v1",
  label: "Painterly v1",
  prompt: [
    "a warm hand-illustrated family portrait, painterly storybook style,",
    "soft golden afternoon light, painterly brushwork with visible texture,",
    "warm muted palette of honey, amber, terracotta and soft cream,",
    "tender expressions, gentle eyes, naturalistic skin tones preserved exactly,",
    "compositions feels like an oil-on-canvas portrait commissioned by the family,",
    "subtle painterly background suggesting home or outdoors, not photographic,",
    "frame-worthy, heirloom quality, dignified, quiet, intimate",
  ].join(" "),
  negativePrompt: [
    "photo, photograph, photorealistic, hdr, glossy, plastic skin,",
    "anime, manga, cel-shaded, chibi, cartoon network,",
    "ai art, smooth airbrushed, oversaturated, neon,",
    "extra fingers, distorted faces, missing limbs, blurry, low quality, watermark, text, signature",
  ].join(" "),
  strength: 0.68,
  guidance: 3.0,
};

export const ACTIVE_PRESET = PAINTERLY_V1;
