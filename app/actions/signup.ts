"use server";

import { z } from "zod";
import { getDb, schema } from "@/lib/db/client";

export type SignupState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

const inputSchema = z.object({
  email: z.string().email("That doesn't look like an email."),
  source: z.string().max(64).optional(),
});

export async function submitEmailSignup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = inputSchema.safeParse({
    email: formData.get("email"),
    source: formData.get("source") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (!process.env.DATABASE_URL) {
    console.warn("[signup] DATABASE_URL not set — skipping persistence", parsed.data);
    return { status: "success" };
  }

  try {
    const db = getDb();
    await db
      .insert(schema.emailSignups)
      .values({ email: parsed.data.email.toLowerCase(), source: parsed.data.source })
      .onConflictDoNothing({ target: schema.emailSignups.email });
    return { status: "success" };
  } catch (err) {
    console.error("[signup] insert failed", err);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
