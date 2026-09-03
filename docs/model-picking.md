# Picking the model

Kinframe's whole experience hinges on one thing: the painted portrait has to *look like the family*, painted by hand, warm and a little timeless. The wrong model output kills the business — not because the funnel breaks, but because the wow moment doesn't land.

This doc is how we pick (and re-pick) the model that drives the painting.

## What "right" means

In order of importance:

1. **Identity preservation** — the people in the painting are recognizably *themselves*. Face shape, hair, age, skin tone, the kid's smile. Get this wrong and the customer is hurt.
2. **Painterly warmth** — soft light, painterly brush texture, warm honey/terracotta palette. Not photoreal, not anime, not "AI plastic", not airbrushed.
3. **Group handling** — 2–5 people in frame stays coherent (right number of arms, hands aren't melted, people aren't fused). Group photos are *most* of our orders.
4. **Tonal range** — works on light skin, dark skin, mixed groups, indoor light, outdoor light, low light. We can't gate the funnel on "good lighting only."
5. **Cost** — under ~$0.10 per preview keeps free-preview economics healthy. Treat this as a tiebreaker, not a gate: the 2026-08 pick costs $0.134 and still won, because at a $99 sale price and $25–40 CAC, five cents of generation is not where the margin is decided. It becomes a real constraint only if preview-to-order ratio blows out.
6. **Latency** — under 60 s end-to-end. Above that, conversion bleeds.

## The candidates

We're evaluating **instruction-edit** models, not pure text-to-image. The photo isn't a reference — it's the subject. Identity preservation comes from the model being designed to *edit* a real photo, not invent a new scene.

### Shortlist as of 2026-08-01

The May 2026 shortlist (Kontext pro/max, FLUX-dev + painterly LoRA, SDXL img2img) is obsolete. Two things changed: the whole LoRA/SDXL tier fell out of contention as the frontier instruction-edit models got cheap enough to use per-preview, and three new families landed that beat Kontext on the Image Arena editing leaderboard. Prices below are the published per-image rate at time of writing — re-check the model page before treating one as a margin decision.

| Candidate | Replicate slug | ~$/image | Why it's on the list | Concerns |
|---|---|---|---|---|
| **FLUX Kontext Max** *(incumbent)* | `black-forest-labs/flux-kontext-max` | 0.08 | What production runs today. Known-good with `painterly-v6`: solved both the identity and the true-oil-paint problem. | Now a generation behind; second-priciest on the list. |
| **Nano Banana Pro** | `google/nano-banana-pro` | 0.13 (2K) | Gemini Pro Image — currently #1 for image editing on the Artificial Analysis arena. Best-in-class instruction following, which is what a 400-word preservation prompt needs. | Most expensive by ~1.7×. At $0.13 the "AI is a rounding error" cost story starts to wobble on preview-heavy traffic. |
| **Seedream 4.5** | `bytedance/seedream-4.5` | 0.04 | #2 on editing, at **half** the incumbent's price. Strong at targeted edits that hold detail consistency. | ByteDance provenance — worth a look at data/licensing terms before it touches customer photos. |
| **FLUX.2 Pro** | `black-forest-labs/flux-2-pro` | 0.05 | Kontext's successor line, cheaper than Kontext Max, strongest photoreal texture. Takes up to 8 reference images — a path to few-shot style anchoring later. | Photoreal strength can cut against us; we want paint, not fidelity. |
| **Qwen Image Edit Plus** | `qwen/qwen-image-edit-plus` | 0.03 | The cost floor. Only interesting if quality lands close to the leaders. | Weakest of the five on paper; `aspect_ratio` enum has no 4:5 (we crop instead). |

**Models we are NOT evaluating, and why:**

- *Pure text-to-image (Imagen, Midjourney, SDXL t2i)* — no input photo, no identity preservation. Wrong tool for this job.
- *Studio Ghibli–named LoRAs* — IP-unsafe positioning, even if the output is on-brand. We do not invoke Ghibli, in code or in marketing.
- *FLUX-dev + painterly LoRA, SDXL img2img* — dropped. The frontier edit models now cost $0.03–0.13, so the "cheap but needs LoRA curation" tier no longer buys enough to justify the face-warping risk and the curation work.
- *Seedream 5 Lite, FLUX.2 Max, GPT Image* — deliberately parked. Five candidates is already at the limit of what one person can rank honestly in a sitting; add these only if the shortlist disappoints.

### Two paths to Gemini

Note that Gemini is reachable two ways and they are **not** equivalent:

- `lib/ai/gemini.ts` — the direct Google SDK path. Sends a system instruction *plus* the four style-reference paintings in `brand/references/style/` as visual anchors. This is the more sophisticated integration.
- `google/nano-banana-pro` via Replicate — prompt-only, no style anchoring, and it's the newer Pro model rather than 2.5 Flash Image.

The bake-off runs the Replicate path, so a nano-banana-pro result is a *floor*, not a ceiling: if it wins on prompt alone, wiring style refs through would only help. Keep that in mind when scoring.

## How to run the bake-off

```bash
# 1. Drop 5–10 reference photos into bakeoff/inputs/
#    Cover: solo adult, couple, family-of-4, mixed skin tones,
#    indoor light, outdoor light, low light, group with a kid.

# 2. Set REPLICATE_API_TOKEN in .env.local
echo "REPLICATE_API_TOKEN=r8_..." >> .env.local

# 3. Run the bake-off
pnpm bakeoff                                  # the full shortlist above
pnpm bakeoff -- seedream-4.5 nano-banana-pro  # a subset
pnpm bakeoff -- --active                      # only the live env-configured generator
```

Every candidate runs through the production generator and the active preset, so what you see is what a customer would get. Outputs land in `bakeoff/outputs/<timestamp>/`:

- `<input>__grid.jpg` — original + every candidate, side by side. **This is the file you score.**
- `<input>__<model>.jpg` — the individual full-size outputs
- `summary.md` / `results.json` — latency and pass/fail per model

The script prints an estimated spend before it starts. A five-model run over four photos is about $1.30.

### Adding a model to the shortlist

Two places, both required:

1. `CANDIDATES` in `scripts/model-bakeoff.ts` — name, slug, price.
2. `detectFamily()` + `buildInput()` in `lib/ai/replicate.ts` — the per-family input schema.

Step 2 is the one that bites. The families have genuinely different schemas: Kontext takes a single `input_image` string, while FLUX.2 takes `input_images[]`, Nano Banana and Seedream take `image_input[]`, and Qwen takes `image[]`. Send the wrong shape and the model **silently ignores the photo** and generates a family from the prompt alone — plausible-looking output, wrong people. Verify against the live schema:

```bash
curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" https://api.replicate.com/v1/models/OWNER/NAME
```

## Scoring rubric

For each candidate, rate each of the 6 inputs on a 1–5 scale across the dimensions below. Sum the columns.

| Dimension | Weight | What 5 looks like | What 1 looks like |
|---|---|---|---|
| Identity preservation | ×3 | Family members are unmistakable | Faces are generic, kids look like different kids |
| Painterly warmth | ×2 | Looks like a small-studio commissioned painting | "AI gloss", airbrushed plastic, anime |
| Group coherence | ×2 | Hands, limbs, eye contact all natural | Melted hands, missing/extra people |
| Tonal range | ×1 | Holds up across skin tones and lighting | Only works on one type of photo |
| Cost (per gen) | ×1 | < $0.03 | > $0.10 |
| Latency (per gen) | ×1 | < 20 s | > 60 s |

Pick the highest total. If two are close, pick the one with higher identity-preservation — the rest can be tuned via prompt and strength, that one cannot.

## Locking the winner

Once you've picked:

1. Note the exact model + version hash from the Replicate model page.
2. Set in `.env.local` and Vercel env:
   ```
   REPLICATE_MODEL_VERSION=owner/model:hash
   ```
3. If the model's input schema differs from our default (`input_image`, `prompt`, `prompt_strength`, `guidance`), update `lib/ai/replicate.ts` to map our preset to the model's schema.
4. Commit the decision in `docs/model-picking.md` under "Current pick" below.

## Current pick

**`openai/gpt-image-2` at `quality: "medium"`, via Replicate, PINNED. Picked 2026-09-03.**

```
REPLICATE_MODEL_VERSION=openai/gpt-image-2:225c978a7f938acc350564c4548ddc2476bfb33364bec6b5422227f55ce56bd3
```

The quality tier is set in `lib/ai/replicate.ts`, not in env - see the
`gpt-image` case in `buildInput()`.

| | style | all people kept | signatures | hair fidelity | $/img | latency |
|---|---|---|---|---|---|---|
| **gpt-image-2 @ medium** | best | yes | 0 of 4 | brown, not grey | **$0.050** | **46.7s** |
| gpt-image-2 @ high | best | yes | 0 of 4 | brown, not grey | $0.211 | 135s |
| seedream-5-pro @ 2K | close | yes | 0 of 4 | best of any model | $0.090 | ~60s **or** ~130s |
| nano-banana-2 | flattest | **no - dropped one** | 1 of 4 | greyed her hair | $0.101 | 21s |

**Why it won.** It is the style the brand wants, at the lowest cost of anything
tested, inside the existing latency budget. Latency across the four photos was
42.9 / 48.3 / 46.7 / 44.9s - a median of 46.7s at +/-6%, which fits the 60s
`maxDuration` on `/api/generate` **without** requiring the queue first.

**The medium-vs-high finding is the important one.** The tier gap is bigger
than most model-to-model swaps in this exercise: ~4x the price and ~3x the
latency for a modest gain (slightly more articulated background, marginally
more facial modelling). Everything above `medium` in this table is paying a
lot for a little. `high` is scored as its own bake-off candidate via
`inputOverrides` so the comparison stays reproducible.

**Rejected:**

- **`nano-banana-2`** - was the pick for about half a day on the strength of
  speed, price and leaderboard Elo. Then, on `pexels-askar-abayev`, it
  **deleted the grandmother**: six people in, five out, with v7 explicitly
  instructing "Do NOT remove, merge, add or reposition any person". It also
  turned the Kazakh grandmother's dark hair silver, ageing her ~15 years, and
  beautified other faces into different-looking people. For a product whose
  entire value is "this is *my* family", that is disqualifying regardless of
  the numbers. **Leaderboard rank did not predict this**; only looking at the
  photos did.
- **`seedream-5-pro`** - genuinely good, best hair fidelity of any model, and
  $0.09. Blocked on latency, which is bimodal rather than merely variable:
  pooled across 12 observations it clusters at 53-69s (5 runs) or 125-154s
  (7 runs), with nothing between. Against a 60s ceiling roughly 60% of previews
  would time out. Revisit it if a queue lands.

### Things that turned out not to be levers

- **Resolution does not affect seedream latency.** 2K took 112.2s and 1K took
  117.5s on the same photo - the lower tier was *slower*. Consistent with the
  bimodal-scheduling read: this is queue placement, not compute. `1.5K` returns
  a genuine `ModelError: The input was invalid` on both attempts; that tier
  appears broken.
- **Warm containers would not have helped.** A 4x back-to-back block ran
  59.1 / 132.0 / 69.1 / 53.7s. Fast first, slow second - the opposite of a cold
  start, so pinning `min_instances` on a Replicate Deployment would not fix it.

### Operational note: fund the account above $5

Replicate throttles prediction *creation* to 6/min with a burst of 1 while the
account balance is under $5. This silently 429s concurrent generation and
surfaces as opaque model errors. It broke a probe run on 2026-09-03. Under ad
traffic it would break checkout previews at exactly the wrong moment.

### Caveats on this run

- **The 6-way comparison table elsewhere in this doc was scored on
  `painterly-v6`.** Only `gpt-image-2 @ medium` has been scored on
  `painterly-v7` across all four photos. The other models deserve a v7 re-score
  before the next lock.
- **Ethnicity drift is reduced, not solved.** Every model lightened the Kazakh
  grandmother's near-black hair to some degree; the winner renders it warm
  brown rather than grey, which is better but not right. `seedream-5-pro` held
  it closest. This is the most likely subject of a v8 preset pass.
- **Signature counts are per-photo presence**, judged from bottom-right corner
  crops at full resolution. 0 of 4 is not proof of 0 on unseen photos.
- Four photos still do not cover low light or a solo subject.

## When to re-pick

- A clearly better instruction-edit model lands. The field moved three times between May and August 2026 — assume a quarterly re-check, not an annual one.
- Customer complaints cluster around a specific failure mode (e.g. group photos, one ethnicity, dark backdrops)
- Costs become a margin issue at scale
- Performance during peak ad spend windows degrades

Re-picking is cheap (~$1.30 and 15 minutes). Re-picking *and rewriting the preset* is not — `painterly-v6` is tuned against Kontext's behaviour, so a model swap should be scored on the current preset first, then re-tuned only if the winner is close but wrong in a fixable way.

## Run log

| Date | Preset | Models | Outcome |
|---|---|---|---|
| 2026-05-24 | `painterly-v6` | flux-kontext-max only | Surfaced the three V5 failure modes (ethnicity drift, dark backdrops, flat illustration) that produced `painterly-v6`. Never scored across models. |
| 2026-08-01 | `painterly-v6` | 5-way shortlist | Locked `google/nano-banana-pro`. Incumbent Kontext Max placed 3rd. 3 of 4 photos scored — ran out of Replicate credit on the 4th. |
| 2026-09-03 | `painterly-v6` | 6-way shortlist | Locked `google/nano-banana-2` (pinned). All 4 photos x 6 models, 24/24 succeeded. Surfaced forged painter signatures in 4 of 6 models, a regression in the unpinned outgoing pick, and `negativePrompt` being dead config. Produced `painterly-v7`. |
| 2026-09-03 (pm) | `painterly-v7` | gpt-image-2 medium vs high, seedream tiers | Locked `openai/gpt-image-2` at `quality: medium` (pinned). v7 cleared signatures (0/12 across the 3-way run). Disproved the cold-start theory and the resolution lever. Reverted the `nano-banana-2` pick after it dropped a person. |
