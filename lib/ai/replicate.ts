import Replicate from "replicate";
import type { Generator, GenerateInput, GenerateResult } from "./generator";
import { cropToAspect } from "./aspect";

/**
 * Real generator backed by Replicate. The exact model + LoRA combo lives in
 * REPLICATE_MODEL_VERSION so you can swap models via env, not code.
 *
 * The input shape below targets the FLUX Kontext family (flux-kontext-pro,
 * flux-kontext-max). If you swap in flux-dev + a painterly LoRA or any model
 * with a different schema, update buildInput() to match.
 *
 * REPLICATE_MODEL_VERSION can be either:
 *   - "owner/model"              (uses latest published version)
 *   - "owner/model:versionhash"  (pinned — recommended for production)
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

  async generate({ imageUrl, preset, aspectRatio = "4:5" }: GenerateInput): Promise<GenerateResult> {
    const modelRef = process.env.REPLICATE_MODEL_VERSION!;

    // Replicate's servers can't fetch http://localhost — inline as base64
    // when we're running against a local upload store.
    const inputImage = await toPubliclyFetchableImage(imageUrl);

    const input = buildKontextInput({
      imageUrl: inputImage,
      prompt: preset.prompt,
      aspectRatio,
    });

    // The SDK accepts both "owner/model" and "owner/model:hash". The cast
    // here just satisfies TypeScript's template-literal type.
    const output = await this.client.run(
      modelRef as `${string}/${string}` | `${string}/${string}:${string}`,
      { input },
    );

    const url = pickOutputUrl(output);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Replicate output fetch failed: ${res.status}`);

    // Even though we asked for aspectRatio, defensively crop the output so
    // the preview is byte-for-byte the print framing — no surprises if a
    // model returns a slightly different ratio.
    const raw = Buffer.from(await res.arrayBuffer());
    const imageBytes = await cropToAspect(raw, aspectRatio);

    return {
      imageBytes,
      contentType: "image/jpeg",
      predictionId: null,
    };
  }
}

/** Input shape for FLUX Kontext (pro / max). */
function buildKontextInput({
  imageUrl,
  prompt,
  aspectRatio,
}: {
  imageUrl: string;
  prompt: string;
  aspectRatio: string;
}) {
  return {
    input_image: imageUrl,
    prompt,
    aspect_ratio: aspectRatio,
    output_format: "jpg",
    safety_tolerance: 2,
    prompt_upsampling: false,
  };
}

/**
 * If `url` is local (file path or localhost), fetch the bytes and return a
 * base64 data URL so Replicate can ingest it. Public https URLs pass through.
 */
async function toPubliclyFetchableImage(url: string): Promise<string> {
  const isLocalHttp = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(url);
  const isLocalPath = url.startsWith("/");
  if (!isLocalHttp && !isLocalPath) return url;

  let bytes: Buffer;
  if (isLocalPath) {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    bytes = await fs.readFile(path.join(process.cwd(), "public", url.slice(1)));
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Couldn't fetch local image: ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
  }
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

function pickOutputUrl(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length > 0) return String(output[0]);
  // Some Replicate SDK versions return a FileOutput object with a .url() method.
  if (output && typeof output === "object" && "url" in output) {
    const u = (output as { url: unknown }).url;
    if (typeof u === "function") return String((u as () => unknown)());
    if (typeof u === "string") return u;
  }
  throw new Error(`Unexpected Replicate output shape: ${JSON.stringify(output).slice(0, 200)}`);
}
