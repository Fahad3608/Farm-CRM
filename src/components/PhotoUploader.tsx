"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { uploadPhotoAction } from "@/app/actions/animals";
import { Icon } from "./icons";
import PhotoCropper from "./PhotoCropper";

type Mode = "face" | "body";

const MAX_FULL = 2400;
const QUALITY_FULL = 0.92;
const MAX_THUMB = 600;
const QUALITY_THUMB = 0.80;

async function resize(blob: Blob, maxSize: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(blob);
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("face");

  function openPicker(m: Mode) {
    setMode(m);
    setErr(null);
    fileRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRawSrc(url);
    e.target.value = "";
  }

  async function onCropped(blob: Blob) {
    setRawSrc(null);
    setBusy(true);
    try {
      const [full, thumb] = await Promise.all([
        resize(blob, MAX_FULL, QUALITY_FULL),
        resize(blob, MAX_THUMB, QUALITY_THUMB),
      ]);
      if (fullRef.current) fullRef.current.value = full;
      if (thumbRef.current) thumbRef.current.value = thumb;
      setPreview(thumb);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not process that image.");
    } finally {
      setBusy(false);
    }
  }

  function onCancelCrop() {
    if (rawSrc) URL.revokeObjectURL(rawSrc);
    setRawSrc(null);
  }

  useEffect(() => {
    if (!state?.ok) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <>
      {rawSrc && (
        <PhotoCropper
          imageSrc={rawSrc}
          aspect={mode === "face" ? 1 : 4 / 3}
          cropShape={mode === "face" ? "round" : "rect"}
          onCrop={onCropped}
          onCancel={onCancelCrop}
          label={mode === "face" ? "Crop face photo" : "Crop body photo"}
        />
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="hidden" name="animalId" value={animalId} />
        <input type="hidden" name="full" ref={fullRef} />
        <input type="hidden" name="thumb" ref={thumbRef} />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          onChange={onFileChange}
        />

        {!preview && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => openPicker("face")} className="btn-ghost flex flex-col items-center gap-1.5 py-4">
              <FaceIcon className="h-7 w-7 text-brand" />
              <span className="text-[13px] font-medium">Face photo</span>
              <span className="text-[11px] text-muted">Profile picture</span>
            </button>
            <button type="button" onClick={() => openPicker("body")} className="btn-ghost flex flex-col items-center gap-1.5 py-4">
              <Icon.camera className="h-7 w-7 text-brand" />
              <span className="text-[13px] font-medium">Body photo</span>
              <span className="text-[11px] text-muted">Full body, markings</span>
            </button>
          </div>
        )}

        {preview && (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className={`border border-line object-cover ${
                mode === "face"
                  ? "h-20 w-20 rounded-full"
                  : "h-20 w-[107px] rounded-xl"
              }`}
            />
            <div className="flex flex-col gap-1 pt-1">
              <span className="text-[12px] font-medium text-muted">
                {mode === "face" ? "Face photo" : "Body photo"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  if (fullRef.current) fullRef.current.value = "";
                  if (thumbRef.current) thumbRef.current.value = "";
                }}
                className="text-[12px] text-brand hover:underline"
              >
                Choose another
              </button>
            </div>
          </div>
        )}

        {busy && <span className="text-[13px] text-muted">Preparing high-quality image…</span>}

        {preview && (
          <>
            <input name="caption" className="input" placeholder="Caption (optional) — e.g. left flank marking" />

            <label className="flex items-center gap-2 text-[13.5px]">
              <input
                type="checkbox"
                name="makeProfile"
                defaultChecked={isFirst || mode === "face"}
                className="h-4 w-4 accent-[rgb(var(--brand))]"
              />
              Use as profile photo
            </label>
          </>
        )}

        {err && <p className="text-[13px] text-bad">{err}</p>}
        {state?.error && <p className="text-[13px] text-bad">{state.error}</p>}
        {state?.ok && <p className="text-[13px] text-good">{state.ok}</p>}

        {preview && (
          <div>
            <button className="btn-primary btn-sm" disabled={busy || isPending}>
              {isPending ? "Uploading…" : "Upload photo"}
            </button>
          </div>
        )}
      </form>
    </>
  );
}

function FaceIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="7" />
      <path d="M9.5 9a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM14.5 9a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z" fill="currentColor" />
      <path d="M10 12.5c.5.8 1.3 1 2 1s1.5-.2 2-1" />
      <path d="M7 17c1.3 2 3 3 5 3s3.7-1 5-3" />
    </svg>
  );
}
