export type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: "usd";
  dimensions: { widthIn: number; heightIn: number };
  printResolution: { width: number; height: number };
  printfulVariantId: string | null;
  stripePriceEnv: string;
};

export const FRAMED_CANVAS_16X20: Product = {
  id: "framed-canvas-16x20",
  name: "Framed Canvas Portrait — 16×20\"",
  description:
    "A hand-illustrated family portrait, painted from your photo and printed on premium canvas with a hand-finished wooden frame. Ready to hang.",
  priceCents: 9900,
  currency: "usd",
  dimensions: { widthIn: 16, heightIn: 20 },
  printResolution: { width: 4800, height: 6000 },
  printfulVariantId: null,
  stripePriceEnv: "STRIPE_PRICE_ID",
};

export const DEFAULT_PRODUCT = FRAMED_CANVAS_16X20;
