import Replicate from "replicate";
import type { Generator, GenerateInput, GenerateResult } from "./generator";

/**
 * Real generator backed by Replicate. The exact model + LoRA combo lives in
 * REPLICATE_MODEL_VERSION so you can swap models via env, not code.
 *
 * Set REPLICATE_MODEL_VERSION to the version hash you've validated via the
 * bake-off (see scripts/model-bakeoff.ts and docs/model-picking.md).
 */
export class ReplicateGenerator implements Generator {
  readonly id = "replicate";
  private client: Replicate;

  constructor() {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN is required");
    }
    if (!process.env.REPLICATE_MODEL_VERSION) {
      throw new Error("REPLICATE_MODEL_VERSION is required");
    }
    this.client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }

  async generate({ imageUrl, preset, size = 1024 }: GenerateInput): Promise<GenerateResult> {
    const version = process.env.REPLICATE_MODEL_VERSION!;

    // Input shape is shared across the FLUX-family image-edit models we're
    // evaluating (flux-kontext-pro/max, flux-dev img2img with a LoRA). If we
    // settle on a model with a wildly different input schema, branch here.
    const input: Record<string, unknown> = {
      input_image: imageUrl,
      prompt: preset.prompt,
      negative_prompt: preset.negativePrompt,
      prompt_strength: preset.strength,
      guidance: preset.guidance,
      output_format: "jpg",
      output_quality: 90,
      aspect_ratio: "match_input_image",
      megapixels: size >= 2048 ? "1.5" : "1",
    };

    const output = await this.client.run(version as `${string}/${string}:${string}`, {
      input,
    });

    const url = Array.isArray(output) ? String(output[0]) : String(output);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Replicate output fetch failed: ${res.status}`);

    return {
      imageBytes: Buffer.from(await res.arrayBuffer()),
      contentType: "image/jpeg",
      predictionId: null,
    };
  }
}
