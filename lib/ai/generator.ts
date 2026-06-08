import type { AiPreset } from "./preset";

export type GenerateInput = {
  imageUrl: string;
  preset: AiPreset;
  /** Target longest-side in pixels. Previews ~1024, print ~6000. */
  size?: number;
  /**
   * Target output aspect ratio in "w:h" form (e.g. "4:5" for the 16×20"
   * framed canvas). Generators must crop or compose to this exact ratio so
   * what the customer previews is what Printful prints. Defaults to "4:5".
   */
  aspectRatio?: string;
};

export type GenerateResult = {
  imageBytes: Buffer;
  contentType: string;
  /** Provider-specific opaque identifier (Replicate prediction id, etc.) */
  predictionId: string | null;
};

export interface Generator {
  readonly id: string;
  generate(input: GenerateInput): Promise<GenerateResult>;
}

let cached: Generator | null = null;

/**
 * Returns the active generator. Preference order:
 *   1. Replicate (FLUX Kontext) — when REPLICATE_API_TOKEN + REPLICATE_MODEL_VERSION are set.
 *      Preferred because FLUX Kontext is purpose-built for identity-preserving
 *      stylistic edits — the exact problem our generator solves.
 *   2. Gemini ("nano-banana") — when GEMINI_API_KEY is set. Tested but has a hard
 *      ceiling between style commitment and identity preservation; kept as fallback.
 *   3. Mock (sharp-based) — so the funnel runs end-to-end with zero external services.
 */
export async function getGenerator(): Promise<Generator> {
  if (cached) return cached;
  if (process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_MODEL_VERSION) {
    const { ReplicateGenerator } = await import("./replicate");
    cached = new ReplicateGenerator();
  } else if (process.env.GEMINI_API_KEY) {
    const { GeminiGenerator } = await import("./gemini");
    cached = new GeminiGenerator();
  } else {
    const { MockGenerator } = await import("./mock");
    cached = new MockGenerator();
  }
  return cached;
}
