import sharp from "sharp";
import { putImage, newImagePath } from "@/lib/storage";
import type { Product } from "@/lib/products";

export async function buildPrintReady(
  generatedUrl: string,
  product: Product,
): Promise<{ url: string }> {
  const sourceUrl = absolutize(generatedUrl);
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`buildPrintReady: source fetch failed (${res.status}) ${sourceUrl}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  const upscaled = await sharp(buf)
    .resize(product.printResolution.width, product.printResolution.height, {
      kernel: "lanczos3",
      fit: "cover",
    })
    .jpeg({ quality: 95 })
    .toBuffer();

  const stored = await putImage(upscaled, {
    pathname: newImagePath("print-ready", "jpg"),
    contentType: "image/jpeg",
  });
  return { url: stored.url };
}

function absolutize(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}
