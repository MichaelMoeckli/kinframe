/**
 * Bake-off: run every photo in bakeoff/inputs/ through the *production*
 * generator + active preset, save outputs, and produce side-by-side grids
 * for human ranking.
 *
 * Uses the same getGenerator() factory as the live API route — so whatever
 * you see here is what real customers will see.
 *
 * Usage:
 *   1. Drop 5–10 reference photos into ./bakeoff/inputs/ (jpg/png/webp)
 *   2. Set GEMINI_API_KEY (preferred) or REPLICATE_API_TOKEN + REPLICATE_MODEL_VERSION in .env.local
 *   3. pnpm bakeoff
 *
 * Outputs land in ./bakeoff/outputs/<run-timestamp>/.
 */

import { config as loadEnv } from "dotenv";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Match Next.js's env-loading order: .env.local wins, then .env.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main() {
  // Dynamic import AFTER env loads so the generator factory picks up the
  // right keys. tsx transpiles to CJS so top-level await isn't available;
  // doing this inside main() achieves the same ordering guarantee.
  const { getGenerator } = await import("../lib/ai/generator");
  const { ACTIVE_PRESET } = await import("../lib/ai/preset");

  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, "..");
  const inputsDir = path.join(root, "bakeoff", "inputs");
  const runDir = path.join(root, "bakeoff", "outputs", new Date().toISOString().replace(/[:.]/g, "-"));
  await fs.mkdir(runDir, { recursive: true });

  const inputs = (await fs.readdir(inputsDir).catch(() => [])).filter((f) =>
    /\.(jpe?g|png|webp|heic)$/i.test(f),
  );
  if (inputs.length === 0) {
    console.error(`No inputs found. Drop reference photos into ${inputsDir}/`);
    process.exit(1);
  }

  const generator = await getGenerator();
  console.log(`Bake-off: ${inputs.length} photo(s) through ${generator.id} (preset: ${ACTIVE_PRESET.id})`);
  console.log(`Outputs: ${runDir}\n`);

  for (const input of inputs) {
    const inputPath = path.join(inputsDir, input);
    const stem = path.parse(input).name;
    const t0 = Date.now();

    try {
      // Read the bytes ourselves so we can pass a file:// URL — the generator
      // resolves localhost/relative URLs but we're not running through Next here.
      const originalBytes = await fs.readFile(inputPath);
      const dataUrl = `data:${mimeFromName(input)};base64,${originalBytes.toString("base64")}`;

      const result = await generator.generate({
        imageUrl: dataUrl,
        preset: ACTIVE_PRESET,
        size: 1024,
      });

      const outFile = path.join(runDir, `${stem}__generated.jpg`);
      await fs.writeFile(outFile, result.imageBytes);

      const gridFile = path.join(runDir, `${stem}__grid.jpg`);
      await composeGrid(originalBytes, result.imageBytes, gridFile, ACTIVE_PRESET.id);

      console.log(`  ${input.padEnd(40)} ✓ ${Date.now() - t0}ms`);
    } catch (err) {
      console.log(`  ${input.padEnd(40)} ✗ ${Date.now() - t0}ms — ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nDone. Open ${runDir} and review *__grid.jpg for side-by-side comparison.`);
}

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  return "image/jpeg";
}

async function composeGrid(
  originalBytes: Buffer,
  generatedBytes: Buffer,
  outPath: string,
  presetLabel: string,
) {
  const TILE = 700;
  const LABEL_H = 40;

  const renderTile = async (bytes: Buffer, label: string) => {
    const resized = await sharp(bytes).rotate().resize(TILE, TILE, { fit: "inside" }).toBuffer();
    const meta = await sharp(resized).metadata();
    const w = meta.width ?? TILE;
    const h = meta.height ?? TILE;
    const labeled = await sharp(resized)
      .extend({ top: LABEL_H, bottom: 0, left: 0, right: 0, background: "#1F1A14" })
      .composite([
        {
          input: Buffer.from(
            `<svg width="${w}" height="${LABEL_H}"><text x="12" y="28" fill="#FBF7F0" font-family="serif" font-size="22">${label}</text></svg>`,
          ),
          top: 0,
          left: 0,
        },
      ])
      .toBuffer();
    return { bytes: labeled, w, h: h + LABEL_H };
  };

  const tiles = [
    await renderTile(originalBytes, "original"),
    await renderTile(generatedBytes, presetLabel),
  ];
  const W = tiles.reduce((a, t) => a + t.w, 0);
  const H = Math.max(...tiles.map((t) => t.h));
  let x = 0;
  const composites = tiles.map((t) => {
    const c = { input: t.bytes, top: 0, left: x };
    x += t.w;
    return c;
  });
  await sharp({
    create: { width: W, height: H, channels: 3, background: "#FBF7F0" },
  })
    .composite(composites)
    .jpeg({ quality: 88 })
    .toFile(outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
