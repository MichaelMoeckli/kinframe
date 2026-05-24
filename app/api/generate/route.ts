import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { putImage, newImagePath } from "@/lib/storage";
import { rateLimit, LIMITS, hashIp } from "@/lib/rateLimit";
import { createPreview, updatePreview } from "@/lib/previews";
import { getGenerator } from "@/lib/ai/generator";
import { ACTIVE_PRESET } from "@/lib/ai/preset";
import { watermark } from "@/lib/watermark";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "0.0.0.0";
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const ipHash = hashIp(ip);

  const ipLimit = await rateLimit(
    `preview:ip:${ipHash}`,
    LIMITS.PREVIEWS_PER_IP_PER_DAY,
    LIMITS.DAY_MS,
  );
  if (!ipLimit.success) {
    return NextResponse.json(
      {
        error:
          "You've reached the free preview limit for today. Come back tomorrow, or order now to skip the limit.",
      },
      { status: 429 },
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("image");
  const email = (formData.get("email") as string | null)?.toLowerCase().trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 10 MB or smaller" }, { status: 413 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, WEBP, or HEIC photo" }, { status: 415 });
  }

  // Normalize: strip EXIF, re-encode as JPEG for consistency.
  const original = Buffer.from(await file.arrayBuffer());
  const normalized = await sharp(original)
    .rotate()
    .jpeg({ quality: 92 })
    .toBuffer();

  const originalStored = await putImage(normalized, {
    pathname: newImagePath("originals", "jpg"),
    contentType: "image/jpeg",
  });

  const preview = await createPreview({
    email,
    originalUrl: originalStored.url,
    ipHash,
  });

  // Run generation. In mock mode this is synchronous and fast. In real Replicate
  // mode it can take 20–60s; we still await here for the MVP. Move to a queue/
  // webhook once we hit concurrency limits.
  try {
    await updatePreview(preview.id, { status: "generating" });
    const generator = await getGenerator();
    const result = await generator.generate({
      imageUrl: absoluteUrl(req, originalStored.url),
      preset: ACTIVE_PRESET,
      size: 1024,
    });

    const watermarked = await watermark(result.imageBytes);

    const generatedStored = await putImage(result.imageBytes, {
      pathname: newImagePath("generated", "jpg"),
      contentType: result.contentType,
    });
    const watermarkedStored = await putImage(watermarked, {
      pathname: newImagePath("watermarked", "jpg"),
      contentType: "image/jpeg",
    });

    await updatePreview(preview.id, {
      status: "ready",
      generatedUrl: generatedStored.url,
      watermarkedUrl: watermarkedStored.url,
      replicatePredictionId: result.predictionId,
    });

    return NextResponse.json({ previewId: preview.id });
  } catch (err) {
    console.error("[generate] failed", err);
    await updatePreview(preview.id, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Generation failed",
    });
    // Safety / content blocks aren't server errors — they're a user-fixable
    // condition. Return 422 so the client can show a "try another photo"
    // message that doesn't sound like a crash.
    const isBlocked =
      err instanceof Error && err.name === "GeminiBlockedError";
    return NextResponse.json(
      {
        error: isBlocked
          ? "Our painter couldn't work with that photo — try a clearer family photo with everyone facing the camera."
          : "We couldn't paint that one — try a different photo.",
      },
      { status: isBlocked ? 422 : 500 },
    );
  }
}

function absoluteUrl(req: NextRequest, urlOrPath: string): string {
  if (urlOrPath.startsWith("http")) return urlOrPath;
  const origin = req.nextUrl.origin;
  return `${origin}${urlOrPath}`;
}
