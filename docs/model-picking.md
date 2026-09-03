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

**`google/nano-banana-pro` (Gemini Pro Image), via Replicate. Picked 2026-08-01.**

```
REPLICATE_MODEL_VERSION=google/nano-banana-pro
```

Scored on `painterly-v6` across three photos: a Central Asian family of four on a black studio backdrop, a Black family of three outdoors in hard sun, and a six-person white family group with a photographer in the foreground.

**Why it won.** It is the only candidate that held *both* halves of the problem at once on every photo. Everything else traded one for the other:

- On the six-person group — the hardest input — it kept all six people, all six recognizable, and rendered them in loose confident brushwork that reads as an actual painting. Kontext turned the same photo into flat cel-shaded vector art. Qwen deleted two of the six.
- It's the most reliable at the oil-paint medium. Impasto, directional strokes, canvas texture, softened edges — the specific signatures `painterly-v6` asks for — show up consistently rather than on one photo in three.
- Backgrounds resolve the way V6's dark-backdrop rescue clause intends: the black studio backdrop became a warm cream wash without dragging the subjects with it.

**Runner-up: `bytedance/seedream-4.5`** at a third of the price ($0.04 vs $0.134). Identity preservation is genuinely competitive — arguably the best of any candidate on the studio-backdrop photo, where it alone kept the grandmother's black hair and Kazakh features intact. It loses on medium: two of three outputs read as flat digital illustration, no brushwork. If preview volume ever makes $0.134 hurt, this is the fallback — and it's worth a preset tuned specifically at pushing it toward paint before writing it off.

**Why the incumbent lost.** `flux-kontext-max` is now beaten on quality by a cheaper model and on quality-per-dollar by two. Worse, it's *inconsistent*: credible oil on the outdoor family, flat vector on the group shot, and visible ethnicity drift on the studio photo — it Europeanized the grandmother's features and hair colour, which is precisely the failure mode `painterly-v6` was written to fix. One preset shouldn't have to fight the model that hard.

**Rejected outright:**

- **`flux-2-pro`** has the richest paint texture of anything tested, but faces smear on group shots — several were unusable at print size — and it **forges a painter's signature** into the bottom corner of its output. That breaks the brand guardrail against implying a named human painted the piece, and it would need masking out on every order. Not worth it.
- **`qwen-image-edit-plus`** is disqualified on composition, not style. It cropped the father's head off one photo and dropped two people entirely from the group shot. It also barely paints — output is close to the original photo with a soft filter. The cost floor isn't a floor if the product is wrong.

**What this costs.** $0.134/preview against $0.08 today — a $0.054 increase, or about $0.16 per order at three previews. Against a $99 sale and $25–40 CAC that is noise, and it stays inside the ~$0.50 generation budget in `CLAUDE.md`.

**What to watch.** Median latency is ~31s, versus ~13s for Kontext. The `/api/generate` route has a 60s `maxDuration`, so a slow tail now has real headroom risk. This makes the M5 "move generation off the request thread" item more urgent than it was — see `docs/implementation-status.md`.

**If this breaks**, in order: (1) `bytedance/seedream-4.5` for cost or availability pressure, (2) back to `black-forest-labs/flux-kontext-max`, which is a known-good if uneven quantity, (3) the direct Gemini SDK path in `lib/ai/gemini.ts`, which adds style-reference anchoring the Replicate path doesn't have.

### Caveats on this run

- **Three photos, not four.** The Replicate account ran out of credit partway through `pexels-seljansalim-33769388.jpg`, so all five candidates failed on it. That photo is unscored — re-run it after topping up to confirm the pick holds.
- The three scored photos cover mixed ethnicities, group sizes 3–6, studio and outdoor light. They do **not** cover low light or a solo subject.
- Nano Banana Pro ran prompt-only here. The Gemini SDK path additionally anchors on `brand/references/style/`, so this result is a floor for that model, not a ceiling.

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
