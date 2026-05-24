import { GoogleGenAI } from "@google/genai";
import type { Generator, GenerateInput, GenerateResult } from "./generator";

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

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [
            { text: preset.prompt },
            {
              inlineData: {
                mimeType,
                data: bytes.toString("base64"),
              },
            },
          ],
        },
      ],
    });

    const { imageBytes, contentType } = pickImagePart(response);
    return {
      imageBytes,
      contentType,
      predictionId: null,
    };
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

function pickImagePart(response: GenerateContentResponse): { imageBytes: Buffer; contentType: string } {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
    if (inline?.data) {
      return {
        imageBytes: Buffer.from(inline.data, "base64"),
        contentType: inline.mimeType || "image/png",
      };
    }
  }
  // If the model refused or returned only text, surface that as the error.
  const text = parts
    .map((p) => (p as { text?: string }).text)
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .join(" ")
    .slice(0, 300);
  throw new Error(`Gemini returned no image${text ? `: ${text}` : ""}`);
}
