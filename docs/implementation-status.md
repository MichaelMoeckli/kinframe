# Kinframe — Implementation Status & Roadmap

_Last updated: 2026-05-24_

Based on a walk through the codebase. M2 is done and M3 (Stripe checkout) is freshly landed; **fulfillment → ops** is the next big chunk.

## ✅ Done

**M1 — Scaffold & brand**
- Next.js 16 + React 19 + Tailwind v4, App Router, TS strict (`app/layout.tsx`)
- Fonts (Fraunces display, Inter body), `paper`/`ink`/`frame`/`cream` palette
- Landing page with Hero, HowItWorks, Gallery, FAQ, EmailSignup (`app/page.tsx`)
- Policy pages: about, privacy, terms, shipping
- Site header/footer, BeforeAfter component
- Brand voice + palette docs (`brand/voice.md`, `brand/palette.md`)
- Drizzle schema for `email_signups`, `previews`, `orders` (`lib/db/schema.ts`)
- Email signup server action with Drizzle + dev-mode fallback (`app/actions/signup.ts`)
- Env validation via zod (`lib/env.ts`)

**M2 — Upload + preview pipeline**
- Drag-and-drop upload with HEIC/JPG/PNG/WEBP, 10 MB cap (`components/UploadDropzone.tsx`)
- `POST /api/generate`: validates, strips EXIF via sharp, stores original, runs generator, watermarks, persists (`app/api/generate/route.ts`)
- Storage abstraction: Vercel Blob in prod, `public/uploads/` in dev (`lib/storage.ts`)
- Watermarking via sharp+SVG overlay (`lib/watermark.ts`)
- Rate limiting: Upstash in prod, in-memory in dev, 3 previews/IP/day (`lib/rateLimit.ts`)
- Preview store with DB + in-memory fallback (`lib/previews.ts`)
- Generator interface with **Gemini** ("nano-banana"), **Replicate** (FLUX Kontext), **Mock** fallback (`lib/ai/generator.ts`)
- Preview page with polling status, before/after, "Order" CTA (`app/preview/[id]/PreviewClient.tsx`)
- Model bake-off script + scoring rubric (`scripts/model-bakeoff.ts`, `docs/model-picking.md`)

**M3 — Checkout (Stripe)**
- `POST /api/checkout` creates a Stripe Checkout Session from `previewId`, prefers `STRIPE_PRICE_ID` and falls back to inline `price_data` (`app/api/checkout/route.ts`)
- `POST /api/stripe/webhook` verifies signature, handles `checkout.session.completed`, idempotent on `stripeSessionId` (`app/api/stripe/webhook/route.ts`)
- `lib/orders.ts` mirrors the previews-store pattern (DB + in-memory fallback) with `createOrderIdempotent`
- `/order/success?session_id=…` polls `/api/order` until the webhook lands; `/order/cancel?previewId=…` routes back to the preview
- Resend order-confirmation email with dev-mode console fallback (`lib/email.ts`)
- Shared `lib/stripe.ts` SDK client pinned to API version `2026-04-22.dahlia`
- Env loader (`lib/env.ts`) now tolerates blank `.env.local` entries (treats empty strings as undefined)

## 🔧 In progress / partial

- **`docs/model-picking.md` "Current pick"** section is still TBD — bake-off hasn't been scored and a model locked in
- **Email signups** persist but no Resend confirmation/double-opt-in wired up despite `RESEND_API_KEY` being in env
- **Previews polling** runs every 2.5s indefinitely while not `ready`/`failed` — no max-attempts/backoff
- **Stripe price** still defaults to inline `price_data` until a real `STRIPE_PRICE_ID` is created in the Stripe dashboard

## 📋 To do — by milestone

### M3 — Checkout (Stripe) — shipped, follow-ups

- [ ] Create the live Stripe Price in dashboard and set `STRIPE_PRICE_ID` in Vercel (the inline `price_data` fallback works but breaks Stripe reporting/analytics)
- [ ] End-to-end smoke test against a real Stripe test-mode account once webhooks are wired (`stripe listen --forward-to localhost:3000/api/stripe/webhook`)
- [ ] Handle `checkout.session.async_payment_succeeded` for delayed payment methods (today we early-return on non-`paid` sessions)

### M4 — Print fulfillment (Printful or Gelato)

- [ ] Decide Printful vs Gelato (margins + 16×20 framed canvas variant availability)
- [ ] Re-render print-ready image: re-run generator at `printResolution` (4800×6000), unwatermarked, upscale if needed
- [ ] Upload print-ready file to Blob with signed/long-lived URL
- [ ] `submitToFulfillment(orderId)`: create order in POD, store `printfulOrderId`, transition `orders.status` to `submitted`
- [ ] Fulfillment webhook → update status (`in_production` → `shipped` → `delivered`), store `trackingUrl`
- [ ] Shipping notification email with tracking link
- [ ] Failure path: `fulfillment_failed` triggers ops alert + auto-refund flow

### M5 — Generation hardening

- [ ] Lock the model: complete bake-off, write up "Current pick" in `docs/model-picking.md`, set `REPLICATE_MODEL_VERSION` in Vercel
- [ ] Move generation off the request thread → queue + status webhook (Inngest/Trigger.dev/Vercel Queue) — currently a 60s `maxDuration` Node request
- [ ] Bound the preview polling (max attempts, exponential backoff, "still painting" copy after 90s)
- [ ] Add face-detection sanity check before generation (reject blurry/no-face photos with friendly copy)
- [ ] Add `previewId`-scoped rate limit so polling doesn't accidentally limit other users
- [ ] Per-email rate limit (`PREVIEWS_PER_EMAIL_PER_DAY` is defined but unused)

### M6 — Growth instrumentation (this is the moat)

- [ ] PostHog client + server install, identify by email post-checkout
- [ ] Meta Pixel + Conversions API (`META_CAPI_TOKEN` env exists) — events: `ViewContent`, `InitiateUpload`, `PreviewReady`, `InitiateCheckout`, `Purchase`
- [ ] Funnel dashboard: landing → upload → preview-ready → checkout-started → paid
- [ ] UTM capture → persisted on `previews` and `orders` rows (needs a column add)
- [ ] A/B framework on hero copy + CTA (simple flag, no Optimizely needed)

### M7 — Ops & admin

- [ ] Password-protected `/admin` (use `ADMIN_PASSWORD`) — list recent orders, status, links to Stripe + Printful
- [ ] Manual "resubmit fulfillment" button
- [ ] Manual refund button
- [ ] Sentry wiring (`SENTRY_DSN` env exists, no init code)
- [ ] Structured logs around generation + payment + fulfillment (currently `console.error` only)

### M8 — Polish for ad spend

- [ ] Real before/after assets in `Gallery` (currently placeholders)
- [ ] OG image generation (per-route)
- [ ] `sitemap.xml`, `robots.txt`, structured product data
- [ ] Mobile pass on preview page (the `lg:grid-cols-[1.4fr_1fr]` collapses but the CTA needs to be sticky on mobile for conversion)
- [ ] Loading skeletons on the preview page (current spinner is minimal)
- [ ] Convert raw `<img>` to `next/image` where it doesn't break the blob URLs

### Cross-cutting / smaller

- [ ] Update `README.md` — still the create-next-app default
- [ ] DB migration files: only `drizzle.config.ts` exists; no `drizzle/` migrations checked in — run `pnpm db:generate` and commit
- [ ] CI: lint + typecheck on PR (no `.github/workflows/`)
- [ ] Decide hosting (Vercel implied) and set up preview deploys per branch

## Recommended next step

Lock the model (M5 first task — it gates everything else's perceived quality), then ship M3 Stripe checkout. M4 fulfillment can be manually bridged for the first ~20 orders so you can start running paid traffic before the integration is fully automated.
