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

**`google/nano-banana-2` (Gemini 3.1 Flash Image), via Replicate, PINNED. Picked 2026-09-03.**

```
REPLICATE_MODEL_VERSION=google/nano-banana-2:d1be8b5fc0931a253d417e12a484ac01ee9ccbc6daffd4792151377d5e5ff55f
```

Scored on `painterly-v6` across all four photos, six models, 24/24 generations
successful. Full outputs in `bakeoff/outputs/2026-09-03T09-27-50-843Z/`.

| Model | Median latency | $/image | Signatures forged | Fits 60s maxDuration |
|---|---|---|---|---|
| flux-2-pro | 18.1s | 0.050 | 3 of 4 | yes |
| **nano-banana-2** | **21.5s** | **0.101** | **1 of 4** | **yes** |
| nano-banana-pro *(prev. pick)* | 32.2s | 0.134 | 0 of 4 | yes |
| seedream-5-lite | 86.7s | 0.035 | 1 of 4 | no |
| gpt-image-2 | 145.1s | 0.211 | 1 of 4 | no |
| seedream-5-pro | 146.9s | 0.090 | 0 of 4 | no |

**Why it won.** It is the best model that actually fits the current
architecture. It beats the outgoing pick on every axis except signatures: 33%
faster, 25% cheaper, visibly more brushwork, and it was one of only three models
to keep all six people *plus* the foreground photographer in
`pexels-askar-abayev` - the hardest input. The outgoing `nano-banana-pro`
deleted the photographer entirely and returned a washed-out, near-bare
background on that photo.

**Why the two best models did not win.** `seedream-5-pro` and `gpt-image-2`
scored highest on paint quality and identity, and `seedream-5-pro` was one of
only two models with zero forged signatures. Both take ~145s. `/api/generate`
has a 60s `maxDuration`, so neither is selectable until generation moves off the
request thread. **This makes the M5 queue item the highest-leverage work on the
roadmap: it unlocks a model that is both better and 33% cheaper than what we
run today.**

**Runner-up: `bytedance/seedream-5-pro`** at $0.090 (33% below the outgoing
pick). Strong identity, genuine oil texture, and clean corners on all four
photos. Blocked on latency only. Re-test it the day the queue lands.

**Rejected:**

- **`gpt-image-2`** - the best paint of anything tested, and disqualified. It
  painted a fully legible fake painter's name, "L. Moreau", into the corner of
  `pexels-askar-abayev`. That is the brand guardrail against implying a named
  human painted the piece, broken in the most literal way possible. Also $0.211
  and 145s.
- **`flux-2-pro`** - forged signatures on 3 of 4 photos, degraded faces on group
  shots, and it lightened the skin tones of the Black family in
  `pexels-kindelmedia`. Fast and cheap, but wrong on the two axes that matter.
- **`seedream-5-lite`** - the flattest output of the six, closer to a smoothed
  photograph than a painting, and 86.7s. The $0.035 price is not a floor if the
  product is wrong.
- **`nano-banana-pro`** - see the regression note below.

**What this costs.** $0.101/preview against $0.134 - a 25% *reduction*. At
$99 and $25-40 CAC this was never the binding constraint, but the direction is
right and latency improved with it.

### The signature problem (and the likely cause)

Four of six models painted a fake painter's signature into at least one output.
This ships to the customer: `printReady.ts` upscales the **unwatermarked** file,
so a forged signature lands on the printed canvas.

The cause is probably ours. `painterly-v6` said *"Specific oil-paint
**signatures** that MUST be visible in the output... If any of these signatures
are missing the output is wrong."* It meant brushwork hallmarks. Models can read
it as an instruction to sign the painting.

`painterly-v7` fixes this: "signatures" renamed to "hallmarks" throughout, plus
an explicit unsigned-canvas clause. **The v7 preset has not yet been scored** -
re-run the bake-off on it and confirm the signature rate drops before trusting
this. If it does, `gpt-image-2` and `flux-2-pro` deserve reconsideration on
quality grounds, since signatures were their main disqualifier.

### negativePrompt is dead config

`AiPreset.negativePrompt` is declared on all seven presets and **read by
nothing** - confirm with `grep -rn negativePrompt lib/`. Worse, no model on the
2026-09 shortlist exposes a negative-prompt input at all, so wiring it up would
not help. Every constraint that matters must live in the positive prompt. This
likely explains why ethnicity drift survived V6 despite an extensive
anti-drift negative block.

### Pin your version hashes

The outgoing pick ran as the unpinned slug `google/nano-banana-pro`, and it
measurably regressed between 2026-08-01 and 2026-09-03: washed-out output, a
dropped person, flatter medium. We cannot prove Google changed the model behind
the slug, but an unpinned slug permits exactly that with no deploy on our side.
All picks are now pinned to a version hash. Get one with:

```bash
curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" https://api.replicate.com/v1/models/OWNER/NAME
```

### Caveats on this run

- **Scored against `painterly-v6`, but `ACTIVE_PRESET` is now `painterly-v7`.**
  The ranking above is valid for v6. V7 changes the prompt materially
  (unsigned-canvas clause, hair-colour and dropped-person clauses), so the
  shortlist should be re-scored on v7 before the next lock.
- **Ethnicity drift is not solved.** Several models lightened the Kazakh
  grandmother's hair in `pexels-21zere`, including the winner. `seedream-5-lite`
  held it best. This needs a human call, and it is the same failure class that
  disqualified Kontext in August.
- **Signature counts are per-photo presence**, judged from bottom-right corner
  crops at full resolution (`_sig_corners.jpg` in the run directory). A model
  scoring 0 of 4 is not guaranteed clean on unseen photos.
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
