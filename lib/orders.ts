import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { Order } from "@/lib/db/schema";

export type OrderCreate = {
  previewId: string;
  productId: string;
  email: string;
  amountCents: number;
  currency: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  shippingAddress?: unknown;
};

export type OrderPatch = Partial<
  Pick<
    Order,
    | "status"
    | "stripePaymentIntentId"
    | "shippingAddress"
    | "printReadyUrl"
    | "printfulOrderId"
    | "trackingUrl"
  >
>;

type OrderStore = Map<string, Order>;

declare global {

  var __kinframeOrderStore: OrderStore | undefined;
}

const memory: OrderStore = globalThis.__kinframeOrderStore ?? new Map();
globalThis.__kinframeOrderStore = memory;

function hasDb(): boolean {
  return !!process.env.DATABASE_URL;
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

function nowISO(): Date {
  return new Date();
}

/**
 * Insert an order, treating a duplicate stripeSessionId as an idempotent no-op.
 * Returns the resulting Order row (either the new insert or the pre-existing one).
 */
export async function createOrderIdempotent(input: OrderCreate): Promise<Order> {
  if (hasDb()) {
    const db = getDb();
    const [row] = await db
      .insert(schema.orders)
      .values({
        previewId: input.previewId,
        productId: input.productId,
        email: input.email,
        amountCents: input.amountCents,
        currency: input.currency,
        stripeSessionId: input.stripeSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        shippingAddress: input.shippingAddress ?? null,
        status: "paid",
      })
      .onConflictDoNothing({ target: schema.orders.stripeSessionId })
      .returning();
    if (row) return row;
    // Already existed — fetch and return it so the caller can rely on a non-null result.
    const [existing] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.stripeSessionId, input.stripeSessionId));
    if (!existing) throw new Error("createOrderIdempotent: conflict but no row found");
    return existing;
  }

  const existing = [...memory.values()].find(
    (o) => o.stripeSessionId === input.stripeSessionId,
  );
  if (existing) return existing;

  const id = newId();
  const row: Order = {
    id,
    previewId: input.previewId,
    productId: input.productId,
    email: input.email,
    amountCents: input.amountCents,
    currency: input.currency,
    stripeSessionId: input.stripeSessionId,
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    shippingAddress: (input.shippingAddress ?? null) as Order["shippingAddress"],
    printReadyUrl: null,
    printfulOrderId: null,
    trackingUrl: null,
    status: "paid",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  memory.set(id, row);
  return row;
}

export async function getOrder(id: string): Promise<Order | null> {
  if (hasDb()) {
    const [row] = await getDb()
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id));
    return row ?? null;
  }
  return memory.get(id) ?? null;
}

export async function getOrderByStripeSessionId(
  sessionId: string,
): Promise<Order | null> {
  if (hasDb()) {
    const [row] = await getDb()
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.stripeSessionId, sessionId));
    return row ?? null;
  }
  return (
    [...memory.values()].find((o) => o.stripeSessionId === sessionId) ?? null
  );
}

export async function updateOrder(id: string, patch: OrderPatch): Promise<Order | null> {
  if (hasDb()) {
    const [row] = await getDb()
      .update(schema.orders)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.orders.id, id))
      .returning();
    return row ?? null;
  }
  const existing = memory.get(id);
  if (!existing) return null;
  const next: Order = { ...existing, ...patch, updatedAt: nowISO() };
  memory.set(id, next);
  return next;
}
