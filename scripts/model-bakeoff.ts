/**
 * Model bake-off: run a set of reference photos through several candidate
 * Replicate models and save the outputs side-by-side for human scoring.
 *
 * Usage:
 *   1. Drop 5–10 reference photos into ./bakeoff/inputs/ (jpg/png)
 *   2. Set REPLICATE_API_TOKEN in .env.local
 *   3. pnpm bakeoff
 *
 * Outputs land in ./bakeoff/outputs/<run-timestamp>/.
 *
 * Score the results against the rubric in docs/model-picking.md and pick the
 * winner. Lock the chosen model+version into REPLICATE_MODEL_VERSION.
 */

import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Replicate from "replicate";
import sharp from "sharp";
import { ACTIVE_PRESET } from "../lib/ai/preset";

type Candidate = {
  /** Short id used in filenames. */
  id: string;
  /** Full Replicate model ref, e.g. "black-forest-labs/flux-kontext-pro". */
  model: string;
  /** Optional pinned version hash. If null, uses the model's latest. */
  version: string | null;
  /** Maps our preset to this model's input schema. */
  buildInput: (params: { imageUrl: string; prompt: string; negative: string }) => Record<string, unknown>;
};

const CANDIDATES: Candidate[] = [
  {
    id: "kontext-pro",
    model: "black-forest-labs/flux-kontext-pro",
    version: null,
    buildInput: ({ imageUrl, prompt }) => ({
      input_image: imageUrl,
      prompt,
      output_format: "jpg",
      aspect_ratio: "match_input_image",
      safety_tolerance: 2,
    }),
  },
  {
    id: "kontext-max",
    model: "black-forest-labs/flux-kontext-max",
    version: null,
    buildInput: ({ imageUrl, prompt }) => ({
      input_image: imageUrl,
      prompt,
      output_format: "jpg",
      aspect_ratio: "match_input_image",
      safety_tolerance: 2,
    }),
  },
  // Add a FLUX-dev + painterly LoRA candidate here once you've picked a LoRA
  // from Replicate / Civitai. Example (replace with real model + version):
  // {
  //   id: "flux-dev-painterly",
  //   model: "lucataco/flux-dev-lora",
  //   version: "<paste version hash here>",
  //   buildInput: ({ imageUrl, prompt }) => ({
  //     image: imageUrl,
  //     prompt: `${prompt} <painterly_lora:0.8>`,
  //     prompt_strength: 0.7,
  //     hf_lora: "<huggingface lora repo>",
  //   }),
  // },
];

async function main() {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error("REPLICATE_API_TOKEN is required. Set it in .env.local.");
    process.exit(1);
  }
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, "..");
  const inputsDir = path.join(root, "bakeoff", "inputs");
  const runDir = path.join(root, "bakeoff", "outputs", new Date().toISOString().replace(/[:.]/g, "-"));
  await fs.mkdir(runDir, { recursive: true });

  const inputs = (await fs.readdir(inputsDir).catch(() => [])).filter((f) =>
    /\.(jpe?g|png|webp)$/i.test(f),
  );
  if (inputs.length === 0) {
    console.error(`No inputs found. Drop reference photos into ${inputsDir}/`);
    process.exit(1);
  }

  console.log(`Bake-off: ${inputs.length} inputs × ${CANDIDATES.length} candidates`);
  console.log(`Outputs: ${runDir}`);

  for (const input of inputs) {
    const inputPath = path.join(inputsDir, input);
    const stem = path.parse(input).name;
    console.log(`\n${input}`);

    const bytes = await fs.readFile(inputPath);
    const dataUrl = `data:image/${path.extname(input).slice(1) || "jpeg"};base64,${bytes.toString("base64")}`;
    const generated: { id: string; bytes: Buffer }[] = [];

    for (const c of CANDIDATES) {
      const t0 = Date.now();
      try {
        const ref = (c.version ? `${c.model}:${c.version}` : c.model) as `${string}/${string}`;
        const output = await replicate.run(ref, {
          input: c.buildInput({
            imageUrl: dataUrl,
            prompt: ACTIVE_PRESET.prompt,
            negative: ACTIVE_PRESET.negativePrompt,
          }),
        });
        const url = Array.isArray(output) ? String(output[0]) : String(output);
        const res = await fetch(url);
        const outBytes = Buffer.from(await res.arrayBuffer());
        const outFile = path.join(runDir, `${stem}__${c.id}.jpg`);
        await fs.writeFile(outFile, outBytes);
        const ms = Date.now() - t0;
        console.log(`  ${c.id.padEnd(20)} ✓ ${ms}ms`);
        generated.push({ id: c.id, bytes: outBytes });
      } catch (e) {
        const ms = Date.now() - t0;
        console.log(`  ${c.id.padEnd(20)} ✗ ${ms}ms — ${e instanceof Error ? e.message : e}`);
      }
    }

    if (generated.length > 0) {
      const gridPath = path.join(runDir, `${stem}__grid.jpg`);
      await composeGrid(bytes, generated, gridPath);
    }
  }

  console.log(`\nDone. Open ${runDir} and rank the *__grid.jpg files using the rubric in docs/model-picking.md.`);
}

async function composeGrid(
  original: Buffer,
  candidates: { id: string; bytes: Buffer }[],
  outPath: string,
) {
  const TILE = 600;
  const tiles = [{ id: "original", bytes: original }, ...candidates];
  const rendered = await Promise.all(
    tiles.map(async (t) => {
      const labeled = await sharp(t.bytes)
        .resize(TILE, TILE, { fit: "inside" })
        .extend({ top: 40, bottom: 0, left: 0, right: 0, background: "#1F1A14" })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${TILE}" height="40"><text x="12" y="28" fill="#FBF7F0" font-family="serif" font-size="22">${t.id}</text></svg>`,
            ),
            top: 0,
            left: 0,
          },
        ])
        .toBuffer();
      const m = await sharp(labeled).metadata();
      return { bytes: labeled, w: m.width ?? TILE, h: m.height ?? TILE };
    }),
  );
  const W = rendered.reduce((a, t) => a + t.w, 0);
  const H = Math.max(...rendered.map((t) => t.h));
  let x = 0;
  const composites = rendered.map((t) => {
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
