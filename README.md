# Kinframe

Kinframe turns a family photo into a warm, hand-illustrated portrait and sells it as a framed canvas, delivered to the door. The customer uploads a photo, sees a painterly preview within seconds, checks out, and a print-on-demand partner prints, frames, and ships the finished piece. The whole journey — upload → preview → buy → fulfill → ship — lives in one seamless flow.

It's a direct-to-consumer keepsake brand, not an AI image tool. Customers pay for the object on their wall, not the technology that makes it.

## What the customer experiences

1. **Lands on the site** — a warm marketing page (hero, before/after, how-it-works, gallery, FAQ, email signup) sells the keepsake. Positioning is "hand-illustrated family heirloom," never "AI art."
2. **Uploads a photo** — drag-and-drop, accepts HEIC/JPG/PNG/WEBP up to 10 MB. EXIF is stripped on the server for privacy.
3. **Watches the preview render** — the page polls until a painterly portrait is ready, shown as a before/after slider with a watermark.
4. **Orders** — a single CTA opens Stripe Checkout for the framed canvas ($99, 16×20").
5. **Receives it** — on payment, an unwatermarked, print-resolution file is built and sent to the fulfillment partner; the customer gets an order-confirmation email, then a shipping email with a tracking link.

## Product

The core (and currently only) SKU is a **16×20" framed canvas portrait** at **$99 USD** — premium canvas, hand-finished wooden frame, ready to hang. Print files are produced at 4800×6000. The product's aspect ratio drives both the generated image framing and the on-screen preview container, so what the customer sees is what gets printed. The catalog is modeled to allow more sizes later (`lib/products.ts`).

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Drizzle ORM + Postgres · Vercel Blob (storage) · sharp (image processing) · Upstash Redis (rate limiting) · Stripe (checkout) · Printful (print-on-demand) · Resend (email).

**Pipeline:**

- **Upload & generate** — `POST /api/generate` validates the file, strips EXIF, stores the original, runs the AI generator, watermarks the result, and persists a preview record. Rate-limited to 3 previews per IP per day.
- **Generation** — a pluggable generator interface (`lib/ai/generator.ts`) backs onto **Gemini** ("nano-banana") or **Replicate** (FLUX Kontext), with a **mock** generator as fallback. A bake-off script scores candidate models (`scripts/model-bakeoff.ts`, `docs/model-picking.md`).
- **Preview** — `/preview/[id]` polls `GET /api/preview/[id]/status` until the portrait is `ready` or `failed`, then shows the before/after and the order CTA.
- **Checkout** — `POST /api/checkout` creates a Stripe Checkout Session from a preview. `POST /api/stripe/webhook` verifies the signature, handles `checkout.session.completed` idempotently (keyed on the Stripe session ID), creates the order, and kicks off fulfillment via Next's `after()` so Stripe gets its 200 immediately.
- **Fulfillment** — `lib/fulfillment/` upscales the unwatermarked image to print resolution, stores it in Blob, submits the order to Printful, and advances order status. `POST /api/printful/webhook` (HMAC-verified) handles `package_shipped` (writes the tracking URL, sends the shipping email) and failure events.
- **Email** — Resend sends order-confirmation and shipping notifications (`lib/email.ts`).

**Data model** (`lib/db/schema.ts`): `email_signups`, `previews` (status `pending` → `generating` → `ready`/`failed`), and `orders` (status `pending_payment` → `paid` → `submitted` → `in_production` → `shipped` → `delivered`, with `fulfillment_failed`/`refunded` branches).

**Dev fallbacks** — the app runs end-to-end with no external services: storage falls back to `public/uploads/`, rate limiting and the previews/orders stores fall back to in-memory, the generator falls back to the mock, and email/fulfillment log to the console. Add real keys to exercise each integration.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in values (all optional in dev — see fallbacks above)
pnpm dev
```

Open http://localhost:3000.

## Scripts

```bash
pnpm dev          # dev server
pnpm build        # production build
pnpm start        # serve production build
pnpm lint         # eslint
pnpm db:generate  # generate Drizzle migrations
pnpm db:migrate   # run migrations
pnpm db:push      # push schema to the database
pnpm db:studio    # Drizzle Studio
pnpm bakeoff      # run the AI model bake-off
pnpm gen-refs     # generate style reference images
```

## Environment

See `.env.example` for the full list. Keys group as: database (`DATABASE_URL`), storage (`BLOB_READ_WRITE_TOKEN`), rate limiting (`UPSTASH_*`), generation (`GEMINI_API_KEY` / `REPLICATE_API_TOKEN` + model version), Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`), Printful (`PRINTFUL_API_KEY`, `PRINTFUL_VARIANT_ID`, `PRINTFUL_WEBHOOK_SECRET`), and email (`RESEND_API_KEY`). Any unset key triggers its dev fallback.

## Project layout

```
app/         routes, API handlers (generate, checkout, webhooks, status), server actions
components/  Hero, BeforeAfter, HowItWorks, Gallery, FAQ, EmailSignup, UploadDropzone, header/footer
lib/         ai/ · db/ · fulfillment/ · storage, stripe, email, products, previews, orders, rateLimit, watermark, env
brand/       voice + palette guidelines
docs/        implementation-status.md, model-picking.md
scripts/     model bake-off, style-ref generation
```

## Brand guardrails

Kinframe is positioned as a warm, artisanal keepsake — "hand-illustrated family heirloom" or "storybook portrait." When writing copy, product, or marketing, never frame it as "AI art," never name a human as the painter, never reference Ghibli/anime, and avoid "cheap/fast/instant." The tone is a small atelier, not a tech startup. See `brand/voice.md` for the full do/don't list, and `docs/implementation-status.md` for current milestone status and roadmap.
