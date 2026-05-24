/**
 * Bootstrap the style-reference library used by GeminiGenerator.
 *
 * Calls Gemini with text-only prompts (no input photo) to produce 3 reference
 * paintings that capture the target Kinframe aesthetic. Saves them to
 * brand/references/style/. Once these exist, every production generation
 * uses them as style anchors via multi-image conditioning — which is far
 * more reliable than describing the style in prose.
 *
 * Re-run anytime you want to evolve the style direction. Outputs overwrite
 * existing files.
 *
 * Usage:
 *   pnpm gen-refs
 *
 * Caveat: we're bootstrapping style from the same model that's been
 * inconsistent at producing painterly output. The value isn't that the
 * references will be objectively "great" — it's that downstream requests
 * become DETERMINISTIC because they're anchored to a fixed visual target
 * instead of negotiating style from text every time.
 */

import { config as loadEnv } from "dotenv";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

type RefSpec = {
  /** Filename stem, e.g. "ref-01-family-group". */
  filename: string;
  /** Short description for the console log. */
  describe: string;
  /** Prompt for this specific reference. Should describe the STYLE strongly
   *  and the COMPOSITION loosely — we want style transfer, not subject transfer. */
  prompt: string;
};

/**
 * The references serve as the model's MEDIUM anchor on every production call.
 * Two failure modes have driven the choices below:
 *
 *   1. When all references were white-European, non-white subjects came back
 *      with Europeanized features. Fix: explicitly span skin tones across refs
 *      (East/South Asian, Black, mixed-race, white). The model averages toward
 *      whatever ethnicities are present in the anchors — so the anchors must
 *      themselves be diverse.
 *
 *   2. When references were dark/classical (ivory black backgrounds, baroque
 *      chiaroscuro), outputs preserved black studio backdrops verbatim and read
 *      somber. Fix: every reference now has a LIGHT, warm, contemporary
 *      background (cream wall, sage wash, soft daylight) — never a black
 *      backdrop, never candlelit.
 *
 * The references describe the MEDIUM (warm contemporary oil paint) and the
 * RANGE of skin tones the model should be comfortable painting — they do NOT
 * dictate composition or subjects of the customer's own painting.
 */
const REFS: RefSpec[] = [
  {
    filename: "ref-01-family-group.jpg",
    describe: "Mixed-ethnicity contemporary family group oil portrait",
    prompt: [
      "A warm CONTEMPORARY OIL PAINTING on canvas — modern commissioned family portrait,",
      "NOT an Old Masters museum piece, NOT a classical European painting.",
      "Subject: a multi-ethnic family group of 4-5 people of mixed ages and varied skin tones",
      "(include at least one East Asian person, one Black person, one white person, and a child),",
      "standing close together, visible from waist up, natural relaxed poses.",
      "Each person's ethnic features are painted truthfully and specifically —",
      "no Europeanization, no generic faces.",
      "Unmistakable hallmarks of oil paint must be visible:",
      "directional brushwork across faces and clothing that follows the form,",
      "broken-color edges where adjacent tones meet,",
      "impasto highlights on cheekbones, the bridge of the nose, and fabric folds,",
      "softer scumbled blending in mid-tones,",
      "subtle canvas weave texture in the background.",
      "Warm MODERN palette: cream, soft sage, peach, warm ochre, dusty terracotta, light browns —",
      "lighter overall key than a classical portrait.",
      "Background: a soft warm cream or muted sage painted wall — NOT black, NOT dark studio.",
      "Soft even warm daylight, gentle painted shadows. NO heavy chiaroscuro. NO ivory black.",
      "Natural relaxed expressions with soft asymmetric smiles. Warm, gift-feeling.",
      "Quality of a beloved commissioned family oil portrait suitable for framed wall display.",
      "NOT a photograph. NOT a digital illustration. NOT flat vector art. NOT photorealistic.",
      "A real warm contemporary oil painting.",
    ].join(" "),
  },
  {
    filename: "ref-02-closeup-faces.jpg",
    describe: "Close-up oil portrait — Black parent + child",
    prompt: [
      "A warm CONTEMPORARY OIL PAINTING on canvas: close-up portrait of a Black parent and child",
      "cheek-to-cheek — modern commissioned portrait, NOT classical, NOT Old Masters.",
      "Both subjects' Black ethnic features are painted truthfully and specifically —",
      "warm rich brown skin tones rendered with painted highlights and glazed shadows that respect",
      "the actual undertones, hair painted as natural Black hair texture (coils, curls, or braids)",
      "as flowing oil-paint brushstrokes, not strand-level photographic detail.",
      "Unmistakable oil-paint hallmarks:",
      "directional brushwork across skin and hair,",
      "impasto highlights catching light on cheekbones and the bridge of the nose,",
      "softened scumbled edges, glazed warm shadows under the jaw,",
      "broken-color edges where adjacent tones meet,",
      "subtle canvas weave texture in the background.",
      "Background: soft warm cream or pale sage painted wall — NOT black, NOT dark.",
      "Soft warm directional daylight, gentle painted modeling — NO heavy chiaroscuro.",
      "Warm MODERN palette: cream, warm browns, soft peach, dusty terracotta, gentle ochre.",
      "Natural relaxed expressions with soft asymmetric smiles. Warm, intimate, gift-feeling.",
      "This reference defines how darker skin tones should be painted in this style —",
      "with respect, specificity, and visible oil-paint brushwork, not photographic detail.",
      "NOT a photograph. NOT photorealistic. NOT flat illustration. A real contemporary oil painting.",
    ].join(" "),
  },
  {
    filename: "ref-03-elder-portrait.jpg",
    describe: "Elder solo oil portrait — East Asian grandparent",
    prompt: [
      "A warm CONTEMPORARY OIL PAINTING on canvas: solo portrait of an East Asian grandparent",
      "(70-80 years old) — modern commissioned portrait, NOT classical, NOT Old Masters.",
      "Ethnic features painted truthfully and specifically: East Asian eye shape with epicanthic folds,",
      "nose and jaw structure characteristic of the subject's ethnicity, warm skin tone.",
      "Age painted honestly and warmly:",
      "visible wrinkles and age lines rendered as deliberate oil-paint brushwork,",
      "silver or grey hair painted as flowing brushstrokes,",
      "kind warm eyes painted with subtle glazes.",
      "Unmistakable oil-paint hallmarks: directional brushwork, impasto highlights, softened blended edges,",
      "broken-color edges, glazed warm shadows, canvas weave visible through thinner paint.",
      "Background: soft warm cream or muted sage painted wall — NOT black, NOT dark, NOT studio.",
      "Soft warm even daylight, gentle painted modeling — NO heavy chiaroscuro, NO candlelit drama.",
      "Warm MODERN palette: cream, warm taupe, soft ochre, gentle peach, light browns.",
      "This reference defines how elders should be painted in this style:",
      "aged honestly, never youthified, never Europeanized, with character rendered in",
      "oil-paint brushwork — not photographic detail, not somber museum gravity.",
      "Warm, kind, contemporary. Quality of a beloved commissioned family portrait.",
      "NOT a photograph. NOT photorealistic. NOT flat illustration. A real contemporary oil painting.",
    ].join(" "),
  },
  {
    filename: "ref-04-child-portrait.jpg",
    describe: "Solo child oil portrait — South Asian / mixed-race toddler",
    prompt: [
      "A warm CONTEMPORARY OIL PAINTING on canvas: solo portrait of a young child (2-4 years old)",
      "of South Asian or mixed-race heritage — modern commissioned portrait, NOT classical.",
      "The child's ethnic features are painted truthfully and specifically:",
      "warm brown skin, dark hair painted as its actual texture (straight, wavy, or curly — pick one",
      "and paint it specifically, not a generic toddler curl), eye shape and color faithful,",
      "individual face shape preserved — NOT idealized into a generic 'cute toddler' archetype.",
      "Unmistakable oil-paint hallmarks: directional brushwork on cheeks following the form,",
      "impasto highlights on the cheekbones and tip of the nose, soft scumbled blending,",
      "broken-color edges, subtle canvas texture in the background.",
      "Background: soft warm cream or pale sage painted wall — NOT dark.",
      "Soft warm daylight, gentle painted shadows — NO heavy chiaroscuro.",
      "Warm MODERN palette: cream, soft peach, warm ochre, gentle browns.",
      "Natural relaxed expression — soft asymmetric smile, lived-in face, NOT a frozen camera smile.",
      "This reference defines how children should be painted in this style:",
      "individual, specific, honest about apparent age and ethnicity, never generic, never idealized.",
      "NOT a photograph. NOT photorealistic. NOT flat illustration. A real contemporary oil painting.",
    ].join(" "),
  },
];

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is required. Set it in .env.local.");
    process.exit(1);
  }
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, "..");
  const outDir = path.join(root, "brand", "references", "style");
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Generating ${REFS.length} style references with ${model}`);
  console.log(`Output: ${outDir}`);

  for (const ref of REFS) {
    const t0 = Date.now();
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: ref.prompt }] }],
      });
      const bytes = extractImageBytes(response);
      const outFile = path.join(outDir, ref.filename);
      await fs.writeFile(outFile, bytes);
      console.log(`  ${ref.filename.padEnd(32)} ✓ ${Date.now() - t0}ms — ${ref.describe}`);
    } catch (err) {
      console.log(`  ${ref.filename.padEnd(32)} ✗ ${Date.now() - t0}ms — ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("\nReview the generated references and delete any that don't match the target aesthetic.");
  console.log("The Gemini generator will pick up whatever remains in the folder on the next request.");
}

function extractImageBytes(response: unknown): Buffer {
  const raw = response as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string }; text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };
  if (raw.promptFeedback?.blockReason) {
    throw new Error(`Blocked: ${raw.promptFeedback.blockReason}`);
  }
  const parts = raw.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }
  const finish = raw.candidates?.[0]?.finishReason;
  const text = parts.map((p) => p.text).filter(Boolean).join(" ").slice(0, 200);
  throw new Error(`No image returned (finishReason=${finish ?? "unknown"})${text ? `: ${text}` : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
