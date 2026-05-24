import sharp from "sharp";

/**
 * Crops an image to the given "w:h" aspect ratio using sharp's attention-based
 * smart crop so faces stay in frame. Used to force generator outputs into the
 * product's print ratio (e.g. "4:5" for a 16×20" canvas) — the preview the
 * customer sees is then identical to what Printful prints.
 */
export async function cropToAspect(input: Buffer, aspectRatio: string): Promise<Buffer> {
  const target = parseAspect(aspectRatio);
  const img = sharp(input).rotate();
  const meta = await img.metadata();
  const srcW = meta.width;
  const srcH = meta.height;
  if (!srcW || !srcH) return input;

  const targetRatio = target.w / target.h;
  const srcRatio = srcW / srcH;
  if (Math.abs(srcRatio - targetRatio) < 0.005) return input;

  let cropW: number;
  let cropH: number;
  if (srcRatio > targetRatio) {
    cropH = srcH;
    cropW = Math.round(srcH * targetRatio);
  } else {
    cropW = srcW;
    cropH = Math.round(srcW / targetRatio);
  }

  return sharp(input)
    .rotate()
    .resize(cropW, cropH, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 92 })
    .toBuffer();
}

export function parseAspect(label: string): { w: number; h: number } {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(label.trim());
  if (!m) throw new Error(`Invalid aspect ratio: ${label}`);
  return { w: Number(m[1]), h: Number(m[2]) };
}
