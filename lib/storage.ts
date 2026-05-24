import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

export type StoredImage = {
  url: string;
  pathname: string;
  contentType: string;
};

/**
 * Saves bytes to either Vercel Blob (when BLOB_READ_WRITE_TOKEN is set) or to
 * a local public/uploads/ directory for dev. The returned URL is browser-fetchable
 * in both modes — local storage is served by Next's static handler from /uploads.
 */
export async function putImage(
  bytes: Buffer,
  opts: { pathname: string; contentType: string },
): Promise<StoredImage> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const result = await put(opts.pathname, bytes, {
      access: "public",
      contentType: opts.contentType,
      addRandomSuffix: false,
    });
    return {
      url: result.url,
      pathname: result.pathname,
      contentType: opts.contentType,
    };
  }

  const cleanPath = opts.pathname.replace(/^\/+/, "");
  const localDir = path.join(process.cwd(), "public", "uploads");
  const fullPath = path.join(localDir, cleanPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, bytes);
  return {
    url: `/uploads/${cleanPath}`,
    pathname: cleanPath,
    contentType: opts.contentType,
  };
}

export function newImagePath(prefix: string, ext: string): string {
  return `${prefix}/${randomUUID()}.${ext}`;
}
