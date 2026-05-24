import sharp from "sharp";
import type { Generator, GenerateInput, GenerateResult } from "./generator";

/**
 * Local stand-in for the real model. Applies a warm-tinted, softened look
 * so the upload → preview → checkout pipeline is testable without API keys.
 * The output is intentionally not as good as the real model — it just needs
 * to be visually distinguishable from the original.
 */
export class MockGenerator implements Generator {
  readonly id = "mock-painterly";

  async generate({ imageUrl, size = 1024 }: GenerateInput): Promise<GenerateResult> {
    const buffer = await fetchBytes(imageUrl);

    const imageBytes = await sharp(buffer)
      .resize(size, size, { fit: "inside", withoutEnlargement: false })
      .modulate({ brightness: 1.05, saturation: 1.25, hue: 12 })
      .gamma(1.1)
      .blur(0.6)
      .median(3)
      .sharpen({ sigma: 1.2 })
      .tint({ r: 252, g: 232, b: 200 })
      .jpeg({ quality: 90 })
      .toBuffer();

    return {
      imageBytes,
      contentType: "image/jpeg",
      predictionId: null,
    };
  }
}

async function fetchBytes(url: string): Promise<Buffer> {
  if (url.startsWith("/")) {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    return fs.readFile(path.join(process.cwd(), "public", url.slice(1)));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
