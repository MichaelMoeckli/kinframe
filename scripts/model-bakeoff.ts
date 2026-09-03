/**
 * Bake-off: run every photo in bakeoff/inputs/ through a set of candidate
 * models using the *production* preset, save outputs, and produce a
 * side-by-side grid per photo for human ranking.
 *
 * Every candidate goes through the same generator code path the live API route
 * uses — so whatever you see here is what real customers would see.
 *
 * Usage:
 *   1. Drop 5–10 reference photos into ./bakeoff/inputs/ (jpg/png/webp)
 *   2. Set REPLICATE_API_TOKEN in .env.local
 *   3. pnpm bakeoff                      # the current candidate shortlist
 *      pnpm bakeoff -- nano-banana-pro seedream-4.5
 *                                        # a subset (short names or full slugs)
 *      pnpm bakeoff -- --active          # only the live generator (env-driven)
 *
 * Outputs land in ./bakeoff/outputs/<run-timestamp>/, alongside a results.json
 * and a summary.md you can paste into docs/model-picking.md.
 */

import { config as loadEnv } from "dotenv";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Type-only import — erased at compile time, so it can't disturb the
// env-before-generator import ordering enforced inside main().
import type { Generator } from "../lib/ai/generator";

// Match Next.js's env-loading order: .env.local wins, then .env.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * The candidate shortlist, current as of 2026-09-03. Rationale, scoring rubric
 * and the standing pick live in docs/model-picking.md — keep the two in sync.
 *
 * Ranks below are Elo on the Artificial Analysis image-*editing* arena, read
 * 2026-09-03. The whole 2026-08 shortlist except the incumbent is gone: FLUX.2
 * Pro and Qwen were disqualified on output (signature forging / dropped
 * people), Kontext Max is two generations back, and Seedream 4.5 is superseded
 * by 5.0. The top-ranked model overall (Microsoft MAI-Image-2.6, Elo 1329 at
 * ~$0.039) is deliberately absent: it is closed-weight and not on Replicate,
 * so running it means adding a second provider. See docs/model-picking.md.
 *
 * `approxCostUsd` is the published per-image price at the time of writing and
 * is only used for the run summary. Verify against the Replicate model page
 * before making a margin decision on it.
 */
type Candidate = {
  /** Short name used on the CLI and in output filenames. */
  name: string;
  /** Replicate slug, optionally pinned with :versionhash. */
  ref: string;
  approxCostUsd: number;
  note: string;
};

const CANDIDATES: Candidate[] = [
  {
    name: "nano-banana-2",
    ref: "google/nano-banana-2",
    approxCostUsd: 0.101,
    note: "Gemini 3.1 Flash Image — Elo 1312, beats the incumbent at 3/4 the price",
  },
  {
    name: "seedream-5-pro",
    ref: "bytedance/seedream-5-pro",
    approxCostUsd: 0.09,
    note: "Elo 1309, ~2/3 the incumbent's price; 4.5 was our runner-up last round",
  },
  {
    name: "nano-banana-pro",
    ref: "google/nano-banana-pro",
    approxCostUsd: 0.134,
    note: "Incumbent — won 2026-08-01, now Elo 1308 and the priciest of the leaders",
  },
  {
    name: "gpt-image-2",
    ref: "openai/gpt-image-2",
    approxCostUsd: 0.211,
    note: "Elo 1327 at quality=high — the ceiling reference, not a cost-viable pick",
  },
  {
    name: "flux-2-pro",
    ref: "black-forest-labs/flux-2-pro",
    approxCostUsd: 0.05,
    note: "Texture benchmark, not a candidate — richest brushwork tested in 2026-08, but smears faces on groups",
  },
  {
    name: "seedream-5-lite",
    ref: "bytedance/seedream-5-lite",
    approxCostUsd: 0.035,
    note: "Cost floor — Elo 1257 at ~1/4 the incumbent; the margin play if it lands",
  },
];

type RunResult = {
  input: string;
  model: string;
  ok: boolean;
  ms: number;
  error?: string;
};

async function main() {
  // Dynamic import AFTER env loads so the generator factory picks up the
  // right keys. tsx transpiles to CJS so top-level await isn't available;
  // doing this inside main() achieves the same ordering guarantee.
  const { getGenerator } = await import("../lib/ai/generator");
  const { ReplicateGenerator } = await import("../lib/ai/replicate");
  const { ACTIVE_PRESET } = await import("../lib/ai/preset");

  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, "..");
  const inputsDir = path.join(root, "bakeoff", "inputs");
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(root, "bakeoff", "outputs", runStamp);
  await fs.mkdir(runDir, { recursive: true });

  const inputs = (await fs.readdir(inputsDir).catch(() => [])).filter((f) =>
    /\.(jpe?g|png|webp|heic)$/i.test(f),
  );
  if (inputs.length === 0) {
    console.error(`No inputs found. Drop reference photos into ${inputsDir}/`);
    process.exit(1);
  }

  // Build the list of (label, generator) pairs to run.
  const args = process.argv.slice(2).filter((a) => a !== "--");
  let entries: Array<{ label: string; generator: Generator; costUsd: number }>;

  if (args.includes("--active")) {
    const generator = await getGenerator();
    entries = [{ label: generator.id.replace(/^replicate:/, "").split("/").pop()!, generator, costUsd: 0 }];
  } else {
    const selected = args.length > 0 ? resolveCandidates(args) : CANDIDATES;
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error("REPLICATE_API_TOKEN is required for a multi-model bake-off (or pass --active).");
      process.exit(1);
    }
    entries = selected.map((c) => ({
      label: c.name,
      generator: new ReplicateGenerator(c.ref),
      costUsd: c.approxCostUsd,
    }));
  }

  const estCost = entries.reduce((a, e) => a + e.costUsd, 0) * inputs.length;
  console.log(
    `Bake-off: ${inputs.length} photo(s) × ${entries.length} model(s) ` +
      `(preset: ${ACTIVE_PRESET.id}) — est. $${estCost.toFixed(2)}`,
  );
  console.log(`Outputs: ${runDir}\n`);

  const results: RunResult[] = [];

  for (const input of inputs) {
    const inputPath = path.join(inputsDir, input);
    const stem = path.parse(input).name;
    console.log(`${input}`);

    // Read the bytes ourselves so we can pass a data: URL — the generator
    // resolves localhost/relative URLs but we're not running through Next here.
    const originalBytes = await fs.readFile(inputPath);
    const dataUrl = `data:${mimeFromName(input)};base64,${originalBytes.toString("base64")}`;

    const tiles: Array<{ bytes: Buffer; label: string }> = [
      { bytes: originalBytes, label: "original" },
    ];

    for (const { label, generator } of entries) {
      const t0 = Date.now();
      try {
        const result = await generator.generate({
          imageUrl: dataUrl,
          preset: ACTIVE_PRESET,
          size: 1024,
        });
        const ms = Date.now() - t0;
        await fs.writeFile(path.join(runDir, `${stem}__${label}.jpg`), result.imageBytes);
        tiles.push({ bytes: result.imageBytes, label });
        results.push({ input, model: label, ok: true, ms });
        console.log(`  ${label.padEnd(24)} ✓ ${(ms / 1000).toFixed(1)}s`);
      } catch (err) {
        const ms = Date.now() - t0;
        const message = err instanceof Error ? err.message : String(err);
        results.push({ input, model: label, ok: false, ms, error: message });
        console.log(`  ${label.padEnd(24)} ✗ ${(ms / 1000).toFixed(1)}s — ${message.slice(0, 120)}`);
      }
    }

    if (tiles.length > 1) {
      await composeGrid(tiles, path.join(runDir, `${stem}__grid.jpg`));
    }
    console.log("");
  }

  await fs.writeFile(
    path.join(runDir, "results.json"),
    JSON.stringify({ preset: ACTIVE_PRESET.id, runStamp, results }, null, 2),
  );
  const summary = renderSummary(entries.map((e) => e.label), results, ACTIVE_PRESET.id, runStamp);
  await fs.writeFile(path.join(runDir, "summary.md"), summary);

  console.log(summary);
  console.log(`Open ${runDir} and review *__grid.jpg for side-by-side comparison.`);
}

/** Map CLI args (short names or full slugs) onto candidates. */
function resolveCandidates(args: string[]): Candidate[] {
  return args.map((a) => {
    const hit = CANDIDATES.find((c) => c.name === a || c.ref === a || c.ref.split("/").pop() === a);
    if (hit) return hit;
    // Not on the shortlist — allow an ad-hoc slug so you can try something new
    // without editing this file.
    if (!a.includes("/")) {
      console.error(`Unknown candidate "${a}". Use a shortlist name or a full owner/model slug.`);
      process.exit(1);
    }
    return { name: a.split("/").pop()!, ref: a, approxCostUsd: 0, note: "ad-hoc" };
  });
}

/** Median latency per model, plus a pass/fail count. */
function renderSummary(labels: string[], results: RunResult[], presetId: string, runStamp: string): string {
  const lines = [
    `# Bake-off ${runStamp}`,
    ``,
    `Preset: \`${presetId}\``,
    ``,
    `| Model | OK | Failed | Median latency |`,
    `|---|---|---|---|`,
  ];
  for (const label of labels) {
    const mine = results.filter((r) => r.model === label);
    const ok = mine.filter((r) => r.ok);
    const times = ok.map((r) => r.ms).sort((a, b) => a - b);
    const median = times.length > 0 ? times[Math.floor(times.length / 2)] : 0;
    lines.push(
      `| ${label} | ${ok.length} | ${mine.length - ok.length} | ${median ? `${(median / 1000).toFixed(1)}s` : "—"} |`,
    );
  }
  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    lines.push(``, `## Failures`, ``);
    for (const f of failures) lines.push(`- \`${f.model}\` on \`${f.input}\`: ${f.error}`);
  }
  lines.push(
    ``,
    `Latency and cost are the easy columns. Score identity preservation, painterly`,
    `warmth, group coherence and tonal range by eye from the \`__grid.jpg\` files —`,
    `see the rubric in docs/model-picking.md.`,
    ``,
  );
  return lines.join("\n");
}

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  return "image/jpeg";
}

/**
 * Compose the tiles into a grid, wrapping at MAX_COLS so a five-way comparison
 * stays viewable on a laptop instead of becoming one very wide strip.
 */
async function composeGrid(tiles: Array<{ bytes: Buffer; label: string }>, outPath: string) {
  const TILE = 620;
  const LABEL_H = 40;
  const MAX_COLS = 3;

  const rendered = await Promise.all(
    tiles.map(async ({ bytes, label }) => {
      const resized = await sharp(bytes).rotate().resize(TILE, TILE, { fit: "inside" }).toBuffer();
      const meta = await sharp(resized).metadata();
      const w = meta.width ?? TILE;
      const h = meta.height ?? TILE;
      const labeled = await sharp(resized)
        .extend({ top: LABEL_H, bottom: 0, left: 0, right: 0, background: "#1F1A14" })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${w}" height="${LABEL_H}"><text x="12" y="28" fill="#FBF7F0" font-family="serif" font-size="22">${escapeXml(label)}</text></svg>`,
            ),
            top: 0,
            left: 0,
          },
        ])
        .toBuffer();
      return { bytes: labeled, w, h: h + LABEL_H };
    }),
  );

  const rows: (typeof rendered)[] = [];
  for (let i = 0; i < rendered.length; i += MAX_COLS) rows.push(rendered.slice(i, i + MAX_COLS));

  const W = Math.max(...rows.map((r) => r.reduce((a, t) => a + t.w, 0)));
  const rowHeights = rows.map((r) => Math.max(...r.map((t) => t.h)));
  const H = rowHeights.reduce((a, h) => a + h, 0);

  const composites: sharp.OverlayOptions[] = [];
  let y = 0;
  rows.forEach((row, ri) => {
    let x = 0;
    for (const tile of row) {
      composites.push({ input: tile.bytes, top: y, left: x });
      x += tile.w;
    }
    y += rowHeights[ri];
  });

  await sharp({ create: { width: W, height: H, channels: 3, background: "#FBF7F0" } })
    .composite(composites)
    .jpeg({ quality: 88 })
    .toFile(outPath);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
