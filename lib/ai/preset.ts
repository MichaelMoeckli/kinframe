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
    "Warm hand-illustrated family portrait in the style of a contemporary storybook illustration —",
    "soft painterly brushwork, visible texture, slightly graphic shapes, dreamy and inviting.",
    "Preserve every person's exact facial structure, skin tone, hair, and identifying features",
    "including eyeglasses, jewelry, watches, and distinctive accessories.",
    "Preserve exact clothing colors, garment styles, body positions, gestures, and relative scale.",
    "Keep the original group composition and pose.",
    "Warm golden-hour light raking from the left, soft directional shadows on faces and clothing,",
    "gentle rim light catching hair edges.",
    "Background: simplified painterly interpretation of horizontal wood slat fencing with soft foliage behind,",
    "kept graphic and uncluttered.",
    "Natural relaxed expressions with soft asymmetric smiles, lived-in faces.",
    "Warm ochre, sage, terracotta, and cream palette.",
    "Quality of a fine illustrated keepsake suitable for framed wall art.",
  ].join(" "),
  negativePrompt: [
    "photorealistic, 3D render, CGI, plastic skin, mask-like faces,",
    "frozen symmetrical smiles, dental grin,",
    "anime, manga, Disney character style, chibi, cartoon merchandise look,",
    "missing glasses, missing accessories, identity drift, generic faces,",
    "stock photo aesthetic, flat lighting, uniform diffuse light,",
    "distorted hands, extra fingers, blurry features, oversaturated",
  ].join(" "),
  strength: 0.68,
  guidance: 3.0,
};

export const ACTIVE_PRESET = PAINTERLY_V1;
