/**
 * One-off latency probe. Answers three questions the 2026-09-03 bake-offs
 * raised but could not settle:
 *
 *   1. Is seedream-5-pro's 62s-vs-130s spread a cold start, or real compute?
 *      Fired back-to-back N times: if run 1 is slow and runs 2..N are fast,
 *      it is a cold start and a warm Replicate Deployment fixes it.
 *   2. How much latency does dropping `size` (seedream) actually buy?
 *   3. Is gpt-image-2 `quality: medium` acceptable, and how much faster?
 *
 * Outputs land in ./bakeoff/latency/<stamp>/ with a summary table.
 * Disposable — delete once the queue architecture is decided.
 *
 *   pnpm tsx scripts/latency-probe.ts
 */

import { config as loadEnv } from "dotenv";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Replicate from "replicate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: [path.join(root, ".env.local"), path.join(root, ".env")] });

const PHOTO = "pexels-kindelmedia-7457504.jpg";

type Probe = {
  label: string;
  ref: string;
  costUsd: number;
  input: (image: string, prompt: string) => Record<string, unknown>;
  /** Times to repeat back-to-back. >1 is how we detect a cold start. */
  reps: number;
};

const seedream = (size: string, reps = 1): Probe => ({
  label: `seedream-5-pro @ ${size}`,
  ref: "bytedance/seedream-5-pro",
  costUsd: 0.09,
  reps,
  input: (image, prompt) => ({
    image_input: [image],
    prompt,
    aspect_ratio: "3:4",
    size,
    output_format: "jpeg",
  }),
});

const gptImage = (quality: string): Probe => ({
  label: `gpt-image-2 @ ${quality}`,
  ref: "openai/gpt-image-2",
  costUsd: quality === "high" ? 0.211 : 0.05,
  reps: 1,
  input: (image, prompt) => ({
    input_images: [image],
    prompt,
    aspect_ratio: "3:4",
    quality,
    number_of_images: 1,
    output_format: "jpeg",
    output_compression: 92,
  }),
});

// The cold-start question is settled: a 4x back-to-back block on 2026-09-03
// ran 59.1 / 132.0 / 69.1 / 53.7s — fast first, slow second, so the ~60s vs
// ~130s split is scheduling variance, not a warmable container. Pooled with
// the two bake-offs it is bimodal: 5 runs at 53-69s, 7 at 125-154s.
// What remains open is whether a cheaper tier is visually acceptable.
const PROBES: Probe[] = [
  seedream("2K"), // same-session baseline for the comparison below
  seedream("1.5K"),
  seedream("1K"),
  gptImage("medium"),
  gptImage("high"),
];

async function main() {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error("REPLICATE_API_TOKEN is required.");
    process.exit(1);
  }
  const { ACTIVE_PRESET } = await import("../lib/ai/preset");
  const prompt = ACTIVE_PRESET.prompt;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(root, "bakeoff", "latency", stamp);
  await fs.mkdir(outDir, { recursive: true });

  const bytes = await fs.readFile(path.join(root, "bakeoff", "inputs", PHOTO));
  const image = `data:image/jpeg;base64,${bytes.toString("base64")}`;

  const client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const est = PROBES.reduce((a, p) => a + p.costUsd * p.reps, 0);
  console.log(`Latency probe on ${PHOTO} (preset: ${ACTIVE_PRESET.id}) — est. $${est.toFixed(2)}`);
  console.log(`Outputs: ${outDir}\n`);

  const rows: Array<{ label: string; rep: number; ms: number; ok: boolean; err?: string }> = [];
  let first = true;

  for (const probe of PROBES) {
    for (let rep = 1; rep <= probe.reps; rep++) {
      const tag = probe.reps > 1 ? `${probe.label}  (rep ${rep}/${probe.reps})` : probe.label;
      // Replicate throttles prediction *creation* to 6/min with a burst of 1
      // while the account balance is under $5. Long generations space
      // themselves out, but fast failures do not — without this gap the
      // remaining probes 429 and look like model errors. Skipped before the
      // first call so the run starts immediately.
      if (!first) await sleep(12_000);
      first = false;
      // Reset on each attempt so a 429 retry's wait never inflates the
      // measured latency — we time the attempt that actually ran.
      let t0 = Date.now();
      try {
        const out = await withRetry(
          () =>
            client.run(probe.ref as `${string}/${string}`, {
              input: probe.input(image, prompt),
            }),
          () => {
            t0 = Date.now();
          },
        );
        const url = pickUrl(out);
        const res = await fetch(url);
        const buf = Buffer.from(await res.arrayBuffer());
        const ms = Date.now() - t0;
        const safe = probe.label.replace(/[^a-z0-9]+/gi, "-");
        await fs.writeFile(path.join(outDir, `${safe}__rep${rep}.jpg`), buf);
        rows.push({ label: probe.label, rep, ms, ok: true });
        console.log(`  ${tag.padEnd(38)} ✓ ${(ms / 1000).toFixed(1)}s`);
      } catch (e) {
        const ms = Date.now() - t0;
        const err = e instanceof Error ? e.message : String(e);
        rows.push({ label: probe.label, rep, ms, ok: false, err });
        console.log(`  ${tag.padEnd(38)} ✗ ${(ms / 1000).toFixed(1)}s — ${err.slice(0, 90)}`);
      }
    }
  }

  const lines = [
    `# Latency probe ${stamp}`,
    ``,
    `Photo: \`${PHOTO}\` · preset: \`${ACTIVE_PRESET.id}\``,
    ``,
    `| Config | Rep | Latency | OK |`,
    `|---|---|---|---|`,
    ...rows.map((r) => `| ${r.label} | ${r.rep} | ${(r.ms / 1000).toFixed(1)}s | ${r.ok ? "yes" : "no"} |`),
  ];
  await fs.writeFile(path.join(outDir, "summary.md"), lines.join("\n"), "utf8");
  console.log(`\n${lines.join("\n")}`);
  console.log(`\nCompare quality by eye in ${outDir}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retries only on 429. Replicate's throttle message carries a `retry_after`
 * in seconds; we honour it when present and fall back to a widening wait.
 * `onAttemptStart` fires immediately before each real attempt so the caller
 * can restart its stopwatch and keep throttle waits out of the measurement.
 */
async function withRetry<T>(fn: () => Promise<T>, onAttemptStart: () => void, tries = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    onAttemptStart();
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const throttled = msg.includes("429") || /throttl/i.test(msg);
      if (!throttled || attempt === tries) throw e;
      const m = /retry_after"?\s*:\s*(\d+)/.exec(msg);
      const waitMs = m ? (Number(m[1]) + 2) * 1000 : attempt * 15_000;
      console.log(`      throttled — waiting ${(waitMs / 1000).toFixed(0)}s (attempt ${attempt}/${tries})`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

function pickUrl(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length) return pickUrl(output[0]);
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (typeof o.url === "function") return String((o.url as () => unknown)());
    if (typeof o.url === "string") return o.url;
  }
  throw new Error(`Unexpected Replicate output shape: ${JSON.stringify(output).slice(0, 200)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
