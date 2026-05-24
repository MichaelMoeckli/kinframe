import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const emailSignups = pgTable("email_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const previews = pgTable("previews", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email"),
  originalUrl: text("original_url").notNull(),
  watermarkedUrl: text("watermarked_url"),
  generatedUrl: text("generated_url"),
  status: text("status", {
    enum: ["pending", "generating", "ready", "failed"],
  })
    .notNull()
    .default("pending"),
  replicatePredictionId: text("replicate_prediction_id"),
  errorMessage: text("error_message"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  previewId: uuid("preview_id").notNull(),
  productId: text("product_id").notNull(),
  email: text("email").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  shippingAddress: jsonb("shipping_address"),
  printReadyUrl: text("print_ready_url"),
  printfulOrderId: text("printful_order_id"),
  trackingUrl: text("tracking_url"),
  status: text("status", {
    enum: [
      "pending_payment",
      "paid",
      "submitted",
      "in_production",
      "shipped",
      "delivered",
      "fulfillment_failed",
      "refunded",
    ],
  })
    .notNull()
    .default("pending_payment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmailSignup = typeof emailSignups.$inferSelect;
export type Preview = typeof previews.$inferSelect;
export type Order = typeof orders.$inferSelect;
