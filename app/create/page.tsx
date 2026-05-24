import type { Metadata } from "next";
import { UploadDropzone } from "@/components/UploadDropzone";

export const metadata: Metadata = {
  title: "Make your portrait — Kinframe",
};

export default function CreatePage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <div className="text-center max-w-xl mx-auto">
        <p className="text-sm uppercase tracking-[0.18em] text-frame">Step 1 of 3</p>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
          Pick a photo that feels like home
        </h1>
        <p className="mt-4 text-ink-soft">
          We&rsquo;ll paint it for you, then frame it on premium canvas and ship it to your
          door. Most portraits ship within 7&ndash;10 days.
        </p>
      </div>
      <div className="mt-12">
        <UploadDropzone />
      </div>
    </section>
  );
}
