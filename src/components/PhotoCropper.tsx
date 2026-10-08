"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

type Props = {
  imageSrc: string;
  aspect: number;
  cropShape: "rect" | "round";
  onCrop: (croppedBlob: Blob) => void;
  onCancel: () => void;
  label: string;
};

export default function PhotoCropper({ imageSrc, aspect, cropShape, onCrop, onCancel, label }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  async function handleSave() {
    if (!area) return;
    setBusy(true);
    try {
      const blob = await cropImage(imageSrc, area);
      onCrop(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <button type="button" onClick={onCancel} className="text-[14px] font-medium text-white/80">
          Cancel
        </button>
        <span className="text-[14px] font-medium text-white">{label}</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !area}
          className="text-[14px] font-semibold text-[rgb(var(--brand))] disabled:opacity-40"
        >
          {busy ? "Cropping…" : "Done"}
        </button>
      </div>

      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape={cropShape}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="flex items-center gap-3 px-6 py-4">
        <ZoomOut className="h-4 w-4 shrink-0 text-white/50" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="zoom-slider flex-1"
          aria-label="Zoom"
        />
        <ZoomIn className="h-5 w-5 shrink-0 text-white/50" />
      </div>
    </div>
  );
}

function ZoomOut(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6" />
    </svg>
  );
}

function ZoomIn(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6M11 8v6" />
    </svg>
  );
}

async function cropImage(src: string, pixelCrop: Area): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      "image/jpeg",
      0.95,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
