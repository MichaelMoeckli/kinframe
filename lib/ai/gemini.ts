import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import type { Generator, GenerateInput, GenerateResult } from "./generator";

/** Longest side (px) we send to Gemini. Keeps base64 payload reasonable and
 *  reduces IMAGE_OTHER failures we've seen on full-resolution phone photos. */
const MAX_INPUT_DIMENSION = 1280;

/** Directory of style-reference images, relative to project root. Any
 *  .jpg/.jpeg/.png/.webp in here is included as a style anchor on every
 *  request. Empty directory => text-only behavior (no anchoring). */
const STYLE_REFS_DIR = "brand/references/style";

/** System instruction grounds the model in the task. Keeps the per-request
 *  user prompt focused on *this* photo's specifics.
 *
 *  Critical wording note: nano-banana defaults to *minimal* edits when given
 *  a photo. We must explicitly frame the task as a full repaint into a
 *  specific medium (oil paint), or the output comes back looking like the
 *  original photo with a soft filter. */
const SYSTEM_INSTRUCTION = [
  "You are a contemporary portrait painter producing warm hand-painted oil paintings on canvas",
  "for framed family wall art commissions — modern keepsake portraits, not Old Masters museum pieces.",
  "The customer uploads a reference photograph. You DO NOT return the photograph.",
  "You return a fully painted oil portrait that shows unmistakable hallmarks of oil paint:",
  "visible directional brushwork, impasto highlights, canvas texture, softened blended edges,",
  "broken-color edges, glazed warm shadows.",
  "Identity is sacred: every person must be unmistakably the same individual as in the photo, including",
  "their exact ETHNICITY and ethnic facial features — never Europeanize, Westernize, or shift features.",
  "Identity preservation is a constraint on the painting, not the goal: the result must look like a",
  "hand-painted oil portrait, not a photograph with effects. Always return a painted image, never a photo.",
].join(" ");

/**
 * Generator backed by Google's Gemini image model ("nano-banana" —
 * gemini-2.5-flash-image). Takes an input photo + our painterly prompt and
 * returns a transformed image.
 *
 * Model name is configurable via GEMINI_IMAGE_MODEL so we can move between
 * preview and GA releases without a code change. Defaults to the GA name;
 * fall back to "gemini-2.5-flash-image-preview" if your project isn't yet
 * on the GA endpoint.
 */
export class GeminiGenerator implements Generator {
  readonly id = "gemini";
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required");
    }
    this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  }

  async generate({ imageUrl, preset }: GenerateInput): Promise<GenerateResult> {
    const { bytes, mimeType } = await fetchImageBytes(imageUrl);
    // Downscale before sending. Large phone photos round-tripped as base64
    // are the most common trigger of IMAGE_OTHER and just cost latency.
    const downscaled = await downscaleForInput(bytes, mimeType);
    const styleRefs = await loadStyleReferences();

    const styleRefParts = styleRefs.map((ref) => ({
      inlineData: { mimeType: ref.mimeType, data: ref.bytes.toString("base64") },
    }));
    const customerPhotoPart = {
      inlineData: {
        mimeType: downscaled.mimeType,
        data: downscaled.bytes.toString("base64"),
      },
    };

    // Three-part structure for nano-banana:
    //   1. IDENTITY anchor — the customer photo, framed strongly enough that
    //      Gemini doesn't invent new people who merely resemble them.
    //   2. STYLE anchor   — the reference paintings, framed as the visual medium
    //      target so the model commits to oil paint, not "photo with filter".
    //   3. PAINT imperative — final instruction tying the two together.
    //
    // Earlier versions failed at one or the other extreme: insufficient style
    // commitment (V1-V3, output = photo with filter) or insufficient identity
    // anchor (V4 Hail Mary, output = different family painted well). The text
    // below is calibrated to hold both simultaneously.
    const parts = styleRefs.length > 0
      ? [
          {
            text: [
              "You are painting a commissioned oil portrait of a SPECIFIC FAMILY. The next image",
              "shows that exact family. Your painting must depict these SAME individuals — not",
              "similar-looking people, not idealized versions, not a re-cast family of the same",
              "demographic.",
              "",
              "IDENTITY RULES (non-negotiable):",
              "• Count every person in the photo. Your painting must include EXACTLY the same number",
              "  of people. Do not add or omit anyone.",
              "• Preserve each person's ETHNICITY exactly. Match ethnic facial features as they appear:",
              "  eye shape and epicanthic folds, nose shape and bridge width, lip shape and thickness,",
              "  cheekbone structure, jawline width, brow shape, skin tone. NEVER Europeanize, Westernize,",
              "  or shift any person's features toward a different ethnicity. This is the single most",
              "  important rule — a portrait that depicts the wrong-looking family is worthless.",
              "• Each person in the painting must be recognizable as the same individual in the photo —",
              "  same face shape, same eyes, same nose, same mouth, same jawline, same hairline,",
              "  same apparent age (do not de-age elders, do not age children up).",
              "• Preserve every accessory: eyeglasses on the exact same person, jewelry, watches,",
              "  facial hair (beards stay, clean-shaven stays clean-shaven), hair color and length.",
              "• Preserve every person's clothing colors and garment styles.",
              "• Preserve poses, positions, and who is standing where.",
              "",
              "Reference photo of the family:",
            ].join(" "),
          },
          customerPhotoPart,
          {
            text: [
              "MEDIUM RULES (non-negotiable): the output must be a WARM CONTEMPORARY OIL PAINTING on",
              "canvas — not a photograph, not a filtered photograph, not a flat illustration, not vector",
              "art, not cel-shaded cartoon. The next " + styleRefs.length,
              "image(s) are oil paintings showing the EXACT medium and finish you must match:",
              "directional visible brushwork on every surface that follows the form,",
              "broken-color edges where adjacent tones meet, impasto highlights catching light on",
              "cheekbones and fabric ridges, softened scumbled blending in mid-tones,",
              "canvas weave texture visible in flat background areas, warm modern palette.",
              "Your output must be visually indistinguishable from these reference paintings as a medium.",
              "Warm, soft, contemporary — NOT museum-piece classical, NOT dark moody Old Masters.",
              "",
              "Style reference paintings:",
            ].join(" "),
          },
          ...styleRefParts,
          {
            text: [
              "Now paint an oil portrait that satisfies BOTH constraints simultaneously:",
              "depicting THE EXACT FAMILY from the reference photo (correct headcount, correct",
              "identities, correct accessories, correct clothing, correct poses) rendered fully",
              "in the OIL PAINT MEDIUM from the style references (visible brushwork, impasto,",
              "softened edges, canvas texture). The output is not a photo with a filter — it is",
              "a real oil painting depicting these specific people.",
              "",
              preset.prompt,
            ].join(" "),
          },
        ]
      : [
          { text: preset.prompt },
          customerPhotoPart,
        ];

    const callOnce = async () => {
      const response = await this.client.models.generateContent({
        model: this.model,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        contents: [{ role: "user", parts }],
      });
      return pickImagePart(response);
    };

    // IMAGE_OTHER is documented as a transient failure mode — retry once
    // before surfacing the error. Safety blocks (IMAGE_SAFETY, PROHIBITED_CONTENT,
    // etc.) re-throw immediately so we don't waste a quota call on a guaranteed fail.
    let result;
    try {
      result = await callOnce();
    } catch (err) {
      if (err instanceof GeminiBlockedError && err.reason === "IMAGE_OTHER") {
        console.warn("[gemini] IMAGE_OTHER on first attempt, retrying once");
        result = await callOnce();
      } else {
        throw err;
      }
    }

    return {
      imageBytes: result.imageBytes,
      contentType: result.contentType,
      predictionId: null,
    };
  }
}

/**
 * Load any style-reference images from STYLE_REFS_DIR. Returns an empty
 * array (and warns once) if the directory is missing or empty, so the
 * generator stays usable until references are added.
 */
type StyleRef = { bytes: Buffer; mimeType: string; filename: string };

let cachedRefs: StyleRef[] | null = null;
let refDirMissingWarned = false;

async function loadStyleReferences(): Promise<StyleRef[]> {
  if (cachedRefs) return cachedRefs;
  const { promises: fs } = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), STYLE_REFS_DIR);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    if (!refDirMissingWarned) {
      console.warn(`[gemini] No style references in ${STYLE_REFS_DIR}/ — running text-only.`);
      refDirMissingWarned = true;
    }
    cachedRefs = [];
    return cachedRefs;
  }
  const imageFiles = entries.filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const refs: StyleRef[] = [];
  for (const f of imageFiles) {
    const raw = await fs.readFile(path.join(dir, f));
    // Downscale references too — same payload-size reasoning as the input photo.
    const downscaled = await sharp(raw)
      .rotate()
      .resize(MAX_INPUT_DIMENSION, MAX_INPUT_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer();
    refs.push({ bytes: downscaled, mimeType: "image/jpeg", filename: f });
  }
  if (refs.length > 0) {
    console.log(`[gemini] Loaded ${refs.length} style reference(s): ${refs.map((r) => r.filename).join(", ")}`);
  }
  cachedRefs = refs;
  return cachedRefs;
}

/** Drop the cached references — used by the gen-refs script after writing new ones. */
export function clearStyleReferenceCache(): void {
  cachedRefs = null;
}

async function downscaleForInput(
  bytes: Buffer,
  mimeType: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
  // HEIC isn't universally accepted as inline_data; re-encode to JPEG too.
  const needsReencode = mimeType === "image/heic";
  try {
    const out = await sharp(bytes)
      .rotate() // honor EXIF orientation
      .resize(MAX_INPUT_DIMENSION, MAX_INPUT_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer();
    return { bytes: out, mimeType: "image/jpeg" };
  } catch (err) {
    if (needsReencode) throw err; // can't recover
    // sharp failed on a format it should handle — fall back to original.
    console.warn("[gemini] downscale failed, sending original:", err);
    return { bytes, mimeType };
  }
}

/**
 * Read the input image into raw bytes. Accepts local paths, localhost URLs,
 * and public https URLs — Gemini ingests via base64 so we don't care which.
 */
async function fetchImageBytes(url: string): Promise<{ bytes: Buffer; mimeType: string }> {
  if (url.startsWith("/")) {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const bytes = await fs.readFile(path.join(process.cwd(), "public", url.slice(1)));
    return { bytes, mimeType: guessMimeFromPath(url) };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't fetch input image: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type")?.split(";")[0] || guessMimeFromPath(url);
  return { bytes, mimeType };
}

function guessMimeFromPath(p: string): string {
  const ext = p.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  return "image/jpeg";
}

type GenerateContentResponse = Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;

/**
 * Thrown when Gemini blocks a request — safety filter, prohibited content, etc.
 * We use this so the API route can map it to a user-facing 422 with a
 * "try a different photo" message, distinct from real 500s.
 */
export class GeminiBlockedError extends Error {
  constructor(
    message: string,
    public readonly reason: string,
    public readonly stage: "prompt" | "response",
  ) {
    super(message);
    this.name = "GeminiBlockedError";
  }
}

function pickImagePart(response: GenerateContentResponse): { imageBytes: Buffer; contentType: string } {
  // The SDK's TS types are loose around feedback/safety fields, so cast to
  // a permissive shape and read defensively.
  const raw = response as unknown as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; inlineData?: { data?: string; mimeType?: string } }> };
      finishReason?: string;
      finishMessage?: string;
      safetyRatings?: Array<{ category?: string; probability?: string; blocked?: boolean }>;
    }>;
    promptFeedback?: {
      blockReason?: string;
      blockReasonMessage?: string;
      safetyRatings?: Array<{ category?: string; probability?: string; blocked?: boolean }>;
    };
  };

  // 1. Prompt-level block (Gemini refused before even attempting generation).
  if (raw.promptFeedback?.blockReason) {
    const reason = raw.promptFeedback.blockReason;
    const msg = raw.promptFeedback.blockReasonMessage || "";
    throw new GeminiBlockedError(
      `Gemini blocked the prompt (${reason})${msg ? `: ${msg}` : ""}`,
      reason,
      "prompt",
    );
  }

  const candidate = raw.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  // 2. Happy path — find the inline image part.
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        imageBytes: Buffer.from(part.inlineData.data, "base64"),
        contentType: part.inlineData.mimeType || "image/png",
      };
    }
  }

  // 3. Candidate-level block (Gemini started but stopped for safety/recitation).
  const finishReason = candidate?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    const blockedRatings = (candidate?.safetyRatings ?? [])
      .filter((r) => r.blocked || r.probability === "HIGH" || r.probability === "MEDIUM")
      .map((r) => `${r.category}=${r.probability}`)
      .join(", ");
    const msg = candidate?.finishMessage ? `: ${candidate.finishMessage}` : "";
    throw new GeminiBlockedError(
      `Gemini stopped without an image (${finishReason})${msg}${blockedRatings ? ` [${blockedRatings}]` : ""}`,
      finishReason,
      "response",
    );
  }

  // 4. Model returned only text (e.g. "I can't help with that"). Surface it.
  const text = parts
    .map((p) => p.text)
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .join(" ")
    .slice(0, 300);
  if (text) {
    throw new GeminiBlockedError(`Gemini returned text instead of an image: ${text}`, "TEXT_ONLY", "response");
  }

  // 5. Truly unknown — dump the shape so we can debug.
  const shape = JSON.stringify(
    {
      hasCandidates: !!raw.candidates?.length,
      candidateKeys: candidate ? Object.keys(candidate) : [],
      promptFeedback: raw.promptFeedback ?? null,
    },
    null,
    2,
  ).slice(0, 500);
  throw new Error(`Gemini returned no image and no diagnostic info. Response shape: ${shape}`);
}
