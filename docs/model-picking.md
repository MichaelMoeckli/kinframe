# Picking the model

Kinframe's whole experience hinges on one thing: the painted portrait has to *look like the family*, painted by hand, warm and a little timeless. The wrong model output kills the business — not because the funnel breaks, but because the wow moment doesn't land.

This doc is how we pick (and re-pick) the model that drives the painting.

## What "right" means

In order of importance:

1. **Identity preservation** — the people in the painting are recognizably *themselves*. Face shape, hair, age, skin tone, the kid's smile. Get this wrong and the customer is hurt.
2. **Painterly warmth** — soft light, painterly brush texture, warm honey/terracotta palette. Not photoreal, not anime, not "AI plastic", not airbrushed.
3. **Group handling** — 2–5 people in frame stays coherent (right number of arms, hands aren't melted, people aren't fused). Group photos are *most* of our orders.
4. **Tonal range** — works on light skin, dark skin, mixed groups, indoor light, outdoor light, low light. We can't gate the funnel on "good lighting only."
5. **Cost** — under ~$0.10 per preview keeps free-preview economics healthy.
6. **Latency** — under 60 s end-to-end. Above that, conversion bleeds.

## The candidates

We're evaluating **image-to-image / instruction-edit** models on Replicate, not pure text-to-image. The photo isn't a reference — it's the subject. Identity preservation comes from the model being designed to *edit* a real photo, not invent a new scene.

| Candidate | Why it's on the list | Concerns |
|---|---|---|
| **`black-forest-labs/flux-kontext-pro`** | Purpose-built for instruction-driven image edits; strong subject identity preservation; well-documented Replicate availability. | Cost per call is higher than img2img; style range capped by base model. |
| **`black-forest-labs/flux-kontext-max`** | Higher-fidelity sibling of Kontext Pro. | More expensive; sometimes *too* faithful to the original (less painterly transformation). |
| **FLUX-dev img2img + painterly LoRA** (e.g. `lucataco/flux-dev-lora` with a hand-picked watercolor / storybook LoRA from Civitai/HuggingFace) | Cheapest per call; LoRAs let us dial in a *specific* painterly look that becomes our visual signature. | Requires real curation of the LoRA; risk of warping faces at higher strengths. |
| **SDXL img2img + Ghibli-adjacent checkpoint** | Mature ecosystem, many painterly checkpoints. | Older base model; visibly weaker faces and hands than FLUX; harder to keep on-brand. |

**Models we are NOT evaluating, and why:**

- *Pure text-to-image (Imagen, Midjourney, SDXL t2i)* — no input photo, no identity preservation. Wrong tool for this job.
- *Studio Ghibli–named LoRAs* — IP-unsafe positioning, even if the output is on-brand. We do not invoke Ghibli, in code or in marketing.
- *Google Gemini 2.5 Image / "Nano Banana"* — strong contender, but we committed to Replicate for the MVP to keep one provider. Re-evaluate later if Kontext falls short.

## How to run the bake-off

```bash
# 1. Drop 5–10 reference photos into bakeoff/inputs/
#    Cover: solo adult, couple, family-of-4, mixed skin tones,
#    indoor light, outdoor light, low light, group with a kid.

# 2. Set REPLICATE_API_TOKEN in .env.local
echo "REPLICATE_API_TOKEN=r8_..." >> .env.local

# 3. Run the bake-off
pnpm bakeoff
```

Outputs land in `bakeoff/outputs/<timestamp>/`, with one side-by-side grid per input photo (`<input>__grid.jpg`).

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

> _TBD — run the bake-off and fill this in. Include: model+version, why it won, runner-up, what you'd switch to if this breaks._

## When to re-pick

- A clearly better Replicate model lands (Kontext v2, new FLUX painterly fine-tune, etc.)
- Customer complaints cluster around a specific failure mode (e.g. group photos)
- Costs become a margin issue at scale
- Performance during peak ad spend windows degrades
