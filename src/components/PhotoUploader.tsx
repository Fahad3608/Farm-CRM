"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { uploadPhotoAction } from "@/app/actions/animals";
import { Icon } from "./icons";

/**
 * Resizes the picture in the browser before upload — a phone camera photo is
 * 4–8 MB, and we only need 1600px + a 400px thumbnail. Keeps uploads fast on
 * a farm's mobile connection and keeps the database small.
 */
async function resize(file: File, maxSize: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser cannot process this image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

export default function PhotoUploader({ animalId, isFirst }: { animalId: string; isFirst: boolean }) {
  const [state, action, isPending] = useActionState(uploadPhotoAction, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fullRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const [full, thumb] = await Promise.all([resize(file, 1600, 0.82), resize(file, 400, 0.75)]);
      if (fullRef.current) fullRef.current.value = full;
      if (thumbRef.current) thumbRef.current.value = thumb;
      setPreview(thumb);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  }

  // Clear the picked image once it is safely stored, but keep it on failure so
  // the photo can be re-submitted without choosing it again.
  useEffect(() => {
    if (!state?.ok) return;
    setPreview(null);
    if (fullRef.current) fullRef.current.value = "";
    if (thumbRef.current) thumbRef.current.value = "";
    formRef.current?.reset();
  }, [state]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="animalId" value={animalId} />
      <input type="hidden" name="full" ref={fullRef} />
      <input type="hidden" name="thumb" ref={thumbRef} />

      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-ghost btn-sm cursor-pointer">
          <Icon.camera className="h-4 w-4" />
          {preview ? "Choose another" : "Take / choose photo"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPick} />
        </label>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-14 w-14 rounded-xl border border-line object-cover" />
        )}
        {busy && <span className="text-[13px] text-muted">Preparing image…</span>}
      </div>

      <input name="caption" className="input" placeholder="Caption (optional) — e.g. left flank marking" />

      <label className="flex items-center gap-2 text-[13.5px]">
        <input type="checkbox" name="makeProfile" defaultChecked={isFirst} className="h-4 w-4 accent-[rgb(var(--brand))]" />
        Use as profile photo
      </label>

      {err && <p className="text-[13px] text-bad">{err}</p>}
      {state?.error && <p className="text-[13px] text-bad">{state.error}</p>}
      {state?.ok && <p className="text-[13px] text-good">{state.ok}</p>}

      <div>
        <button className="btn-primary btn-sm" disabled={!preview || busy || isPending}>
          {isPending ? "Uploading…" : "Upload photo"}
        </button>
      </div>
    </form>
  );
}
