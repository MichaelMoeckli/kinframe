import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { Preview } from "@/lib/db/schema";

export type PreviewCreate = {
  email?: string | null;
  originalUrl: string;
  ipHash?: string | null;
};

export type PreviewPatch = Partial<
  Pick<Preview, "watermarkedUrl" | "generatedUrl" | "status" | "errorMessage" | "replicatePredictionId">
>;

const memory = new Map<string, Preview>();

function hasDb(): boolean {
  return !!process.env.DATABASE_URL;
}

function newId(): string {

  return globalThis.crypto.randomUUID();
}

function nowISO(): Date {
  return new Date();
}

export async function createPreview(input: PreviewCreate): Promise<Preview> {
  if (hasDb()) {
    const [row] = await getDb()
      .insert(schema.previews)
      .values({
        email: input.email ?? null,
        originalUrl: input.originalUrl,
        ipHash: input.ipHash ?? null,
        status: "pending",
      })
      .returning();
    return row;
  }
  const id = newId();
  const row: Preview = {
    id,
    email: input.email ?? null,
    originalUrl: input.originalUrl,
    watermarkedUrl: null,
    generatedUrl: null,
    status: "pending",
    replicatePredictionId: null,
    errorMessage: null,
    ipHash: input.ipHash ?? null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  memory.set(id, row);
  return row;
}

export async function getPreview(id: string): Promise<Preview | null> {
  if (hasDb()) {
    const [row] = await getDb().select().from(schema.previews).where(eq(schema.previews.id, id));
    return row ?? null;
  }
  return memory.get(id) ?? null;
}

export async function updatePreview(id: string, patch: PreviewPatch): Promise<Preview | null> {
  if (hasDb()) {
    const [row] = await getDb()
      .update(schema.previews)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.previews.id, id))
      .returning();
    return row ?? null;
  }
  const existing = memory.get(id);
  if (!existing) return null;
  const next: Preview = { ...existing, ...patch, updatedAt: nowISO() };
  memory.set(id, next);
  return next;
}
