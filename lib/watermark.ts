import sharp from "sharp";

/**
 * Composites a discreet "kinframe · preview" watermark across the bottom of
 * the image. Used for unpaid previews — the print-ready render skips this step.
 */
export async function watermark(input: Buffer): Promise<Buffer> {
  const image = sharp(input);
  const meta = await image.metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const fontSize = Math.round(width * 0.045);
  const padding = Math.round(width * 0.04);
  const text = "kinframe · preview";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <pattern id="diag" patternUnits="userSpaceOnUse" width="240" height="240" patternTransform="rotate(-30)">
          <text x="0" y="40" fill="rgba(255,255,255,0.18)" font-family="serif" font-size="${fontSize}" font-style="italic">
            ${text}
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#diag)" />
      <text
        x="${padding}"
        y="${height - padding}"
        fill="rgba(255,255,255,0.85)"
        font-family="serif"
        font-style="italic"
        font-size="${fontSize}"
      >
        ${text}
      </text>
    </svg>
  `;

  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
