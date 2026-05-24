"use client";

import { useState, useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useRouter } from "next/navigation";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"], "image/heic": [".heic"] };

export function UploadDropzone() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setError(null);
    if (rejected.length > 0) {
      setError(rejected[0]?.errors[0]?.message ?? "That file didn't work — try another.");
      return;
    }
    const f = accepted[0];
    if (!f) return;
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }, [previewUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_BYTES,
    multiple: false,
    disabled: submitting,
  });

  async function onSubmit() {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Upload failed (${res.status})`);
      }
      const { previewId } = (await res.json()) as { previewId: string };
      router.push(`/preview/${previewId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setError(msg);
      setSubmitting(false);
    }
  }

  if (file && previewUrl) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 items-start">
        <div className="rounded-lg overflow-hidden bg-cream/40 ring-1 ring-cream">
          { }
          <img src={previewUrl} alt="Your selected photo" className="w-full h-auto" />
        </div>
        <div>
          <p className="text-sm text-ink-soft">
            Looking good. Press the button and we&rsquo;ll paint your portrait — usually about a minute.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="rounded-full bg-frame px-6 py-3 text-paper hover:bg-frame-dark transition-colors disabled:opacity-50"
            >
              {submitting ? "Painting your portrait…" : "Paint my portrait"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setFile(null);
                setPreviewUrl(null);
              }}
              disabled={submitting}
              className="text-sm text-ink-soft hover:text-ink underline underline-offset-4"
            >
              Choose a different photo
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
          <p className="mt-8 text-xs text-ink-soft">
            By continuing you confirm you have the right to use this photo. Your upload
            is used only to make your portrait — see{" "}
            <a href="/privacy" className="underline">privacy</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={`rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-frame bg-cream/40" : "border-cream bg-cream/20 hover:bg-cream/40"
        }`}
      >
        <input {...getInputProps()} />
        <p className="font-display text-2xl text-ink">
          Drop your photo here
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          or click to choose — JPG, PNG, HEIC up to 10 MB
        </p>
      </div>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      <p className="mt-6 text-xs text-ink-soft">
        For the best results: a clear photo with good light, faces visible, taken outdoors
        or near a window. Phone photos are perfect.
      </p>
    </div>
  );
}
