import type { AiPreset } from "./preset";

export type GenerateInput = {
  imageUrl: string;
  preset: AiPreset;
  /** Target longest-side in pixels. Previews ~1024, print ~6000. */
  size?: number;
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
 *   1. Gemini ("nano-banana")  — when GEMINI_API_KEY is set
 *   2. Replicate (FLUX Kontext) — when REPLICATE_API_TOKEN + REPLICATE_MODEL_VERSION are set
 *   3. Mock (sharp-based)       — so the funnel runs end-to-end with zero external services
 */
export async function getGenerator(): Promise<Generator> {
  if (cached) return cached;
  if (process.env.GEMINI_API_KEY) {
    const { GeminiGenerator } = await import("./gemini");
    cached = new GeminiGenerator();
  } else if (process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_MODEL_VERSION) {
    const { ReplicateGenerator } = await import("./replicate");
    cached = new ReplicateGenerator();
  } else {
    const { MockGenerator } = await import("./mock");
    cached = new MockGenerator();
  }
  return cached;
}
