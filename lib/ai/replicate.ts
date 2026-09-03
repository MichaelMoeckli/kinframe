import Replicate from "replicate";
import type { Generator, GenerateInput, GenerateResult } from "./generator";
import { cropToAspect } from "./aspect";

/**
 * Real generator backed by Replicate. The exact model lives in
 * REPLICATE_MODEL_VERSION so you can swap models via env, not code.
 *
 * REPLICATE_MODEL_VERSION can be either:
 *   - "owner/model"              (uses latest published version)
 *   - "owner/model:versionhash"  (pinned — recommended for production)
 *
 * Input schemas differ per model family — see buildInput() below. The families
 * we support are the ones on the 2026-08 candidate list in docs/model-picking.md.
 */
export class ReplicateGenerator implements Generator {
  readonly id: string;
  private client: Replicate;
  private modelRef: string;

  /**
   * @param modelRef Overrides REPLICATE_MODEL_VERSION. Used by the bake-off to
   *   run several candidates in one pass without touching env.
   */
  constructor(modelRef?: string) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN is required");
    }
    const ref = modelRef ?? process.env.REPLICATE_MODEL_VERSION;
    if (!ref) {
      throw new Error("REPLICATE_MODEL_VERSION is required");
    }
    this.modelRef = ref;
    this.id = `replicate:${ref}`;
    this.client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }

  async generate({ imageUrl, preset, aspectRatio = "4:5" }: GenerateInput): Promise<GenerateResult> {
    const modelRef = this.modelRef;

    // Replicate's servers can't fetch http://localhost — inline as base64
    // when we're running against a local upload store.
    const inputImage = await toPubliclyFetchableImage(imageUrl);

    const input = buildInput({
      modelRef,
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

/**
 * Model families we know how to talk to, and how to recognise them from the
 * Replicate slug. Order matters — first match wins.
 *
 * These shapes were read off the live Replicate OpenAPI schemas on 2026-08-01.
 * The big split: FLUX Kontext takes a single `input_image` string, while every
 * newer family takes an *array* of reference images under its own field name.
 * Sending the Kontext shape to FLUX.2 or Seedream silently drops the photo and
 * you get a generated family that isn't the customer's — so this mapping is
 * load-bearing, not cosmetic.
 */
type ModelFamily =
  | "kontext"
  | "flux2"
  | "nano-banana"
  | "nano-banana-pro"
  | "nano-banana-2"
  | "seedream"
  | "seedream-5"
  | "seedream-5-lite"
  | "gpt-image"
  | "qwen-edit";

function detectFamily(modelRef: string): ModelFamily {
  const slug = modelRef.split(":")[0].toLowerCase();
  if (slug.includes("flux-kontext")) return "kontext";
  if (slug.includes("flux-2")) return "flux2";
  if (slug.includes("nano-banana-pro")) return "nano-banana-pro";
  if (slug.includes("nano-banana-2")) return "nano-banana-2";
  if (slug.includes("nano-banana")) return "nano-banana";
  if (slug.includes("seedream-5-lite")) return "seedream-5-lite";
  if (slug.includes("seedream-5")) return "seedream-5";
  if (slug.includes("seedream")) return "seedream";
  if (slug.includes("gpt-image")) return "gpt-image";
  if (slug.includes("qwen-image-edit")) return "qwen-edit";
  // Unknown model: assume the Kontext shape (what we shipped with) and let
  // Replicate's own validation surface the mismatch.
  console.warn(`[replicate] Unknown model family for "${modelRef}" — assuming FLUX Kontext input shape`);
  return "kontext";
}

function buildInput({
  modelRef,
  imageUrl,
  prompt,
  aspectRatio,
}: {
  modelRef: string;
  imageUrl: string;
  prompt: string;
  aspectRatio: string;
}): Record<string, unknown> {
  switch (detectFamily(modelRef)) {
    // black-forest-labs/flux-kontext-pro | -max | -dev
    case "kontext":
      return {
        input_image: imageUrl,
        prompt,
        aspect_ratio: aspectRatio,
        output_format: "jpg",
        safety_tolerance: 2,
        prompt_upsampling: false,
      };

    // black-forest-labs/flux-2-pro | -max. Accepts up to 8 reference images;
    // we send one. `resolution` is megapixels, not a "2K"-style label.
    case "flux2":
      return {
        input_images: [imageUrl],
        prompt,
        aspect_ratio: aspectRatio,
        resolution: "2 MP",
        output_format: "jpg",
        output_quality: 92,
        safety_tolerance: 2,
      };

    // google/nano-banana-pro (Gemini Pro Image). `resolution` is 1K/2K/4K.
    // safety_filter_level stays at Replicate's default posture; family photos
    // occasionally trip stricter settings.
    case "nano-banana-pro":
      return {
        image_input: [imageUrl],
        prompt,
        aspect_ratio: aspectRatio,
        resolution: "2K",
        output_format: "jpg",
        safety_filter_level: "block_only_high",
      };

    // google/nano-banana (Gemini 2.5 Flash Image). Minimal schema — no
    // resolution control.
    case "nano-banana":
      return {
        image_input: [imageUrl],
        prompt,
        aspect_ratio: aspectRatio,
        output_format: "jpg",
      };

    // bytedance/seedream-4.5 | seedream-5-lite. `size` is the resolution tier;
    // sequential_image_generation must stay disabled or we get a set, not one.
    case "seedream":
      return {
        image_input: [imageUrl],
        prompt,
        aspect_ratio: aspectRatio,
        size: "2K",
        max_images: 1,
        sequential_image_generation: "disabled",
      };

    // google/nano-banana-2 (Gemini 3.1 Flash Image). Same array-input shape as
    // the Pro model but no safety_filter_level knob, and `resolution` drives
    // price: 1K $0.067 / 2K $0.101 / 4K $0.151. We run 2K to match what the
    // incumbent generates, so print upscaling starts from the same place.
    case "nano-banana-2":
      return {
        image_input: [imageUrl],
        prompt,
        aspect_ratio: aspectRatio,
        resolution: "2K",
        output_format: "jpg",
      };

    // bytedance/seedream-5-pro. Note the differences from 4.5: no
    // sequential_image_generation / max_images fields at all, `size` tops out
    // at 2K, and the aspect_ratio enum has **no 4:5** — we ask for the closest
    // portrait ratio (3:4) and let cropToAspect() finish the framing. Asking
    // for match_input_image instead would hand back a landscape photo's ratio
    // and force a destructive crop.
    case "seedream-5":
      return {
        image_input: [imageUrl],
        prompt,
        aspect_ratio: nearestSupported(aspectRatio, SEEDREAM_5_RATIOS),
        size: "2K",
        output_format: "jpeg",
      };

    // bytedance/seedream-5-lite. As above, but it *does* take the sequential
    // fields, and its `size` enum starts at 2K.
    case "seedream-5-lite":
      return {
        image_input: [imageUrl],
        prompt,
        aspect_ratio: nearestSupported(aspectRatio, SEEDREAM_5_RATIOS),
        size: "2K",
        max_images: 1,
        sequential_image_generation: "disabled",
        output_format: "jpeg",
      };

    // openai/gpt-image-2. `quality` is the price dial — "high" is what the
    // editing leaderboard scores and costs ~$0.21/image, vs ~$0.05 at medium.
    // aspect_ratio enum has no 4:5; 3:4 is the closest portrait.
    case "gpt-image":
      return {
        input_images: [imageUrl],
        prompt,
        aspect_ratio: nearestSupported(aspectRatio, GPT_IMAGE_RATIOS),
        quality: "high",
        number_of_images: 1,
        output_format: "jpeg",
        output_compression: 92,
      };

    // qwen/qwen-image-edit-plus. Note: its aspect_ratio enum has no 4:5, so we
    // ask it to match the input and let cropToAspect() do the framing.
    case "qwen-edit":
      return {
        image: [imageUrl],
        prompt,
        aspect_ratio: "match_input_image",
        output_format: "jpg",
        output_quality: 92,
        go_fast: false,
      };
  }
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

/**
 * Ratio enums for models whose aspect_ratio list omits our 4:5 product ratio.
 * Read off the live Replicate schemas on 2026-09-03.
 */
const SEEDREAM_5_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"];
const GPT_IMAGE_RATIOS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"];

/**
 * Picks the supported aspect ratio closest to what we actually want, so the
 * model composes into roughly the right canvas and cropToAspect() only has to
 * shave rather than gouge. Falls back to the first option if `want` is unparseable.
 */
function nearestSupported(want: string, supported: string[]): string {
  const ratio = (label: string) => {
    const [w, h] = label.split(":").map(Number);
    return w / h;
  };
  const target = ratio(want);
  if (!Number.isFinite(target)) return supported[0];
  return supported.reduce((best, cur) =>
    Math.abs(ratio(cur) - target) < Math.abs(ratio(best) - target) ? cur : best,
  );
}
