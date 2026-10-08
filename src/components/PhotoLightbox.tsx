"use client";

import { useCallback, useEffect, useState } from "react";
import { setProfilePhotoAction, deletePhotoAction } from "@/app/actions/animals";
import RecordActions from "./RecordActions";
import ConfirmSubmit from "./ConfirmSubmit";

type Photo = { id: string; caption: string | null; createdAt: string };

export default function PhotoLightbox({
  photos,
  animalId,
  profilePhotoId,
  canManage,
}: {
  photos: Photo[];
  animalId: string;
  profilePhotoId?: string | null;
  canManage: boolean;
}) {
  const [idx, setIdx] = useState<number | null>(null);

  const close = useCallback(() => setIdx(null), []);
  const prev = useCallback(() => setIdx((i) => (i !== null && i > 0 ? i - 1 : i)), []);
  const next = useCallback(() => setIdx((i) => (i !== null && i < photos.length - 1 ? i + 1 : i)), [photos.length]);

  useEffect(() => {
    if (idx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [idx, close, prev, next]);

  const photo = idx !== null ? photos[idx] : null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.id} className="card overflow-hidden">
            <button type="button" onClick={() => setIdx(i)} className="block w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${p.id}?v=thumb`}
                alt={p.caption ?? "Photo"}
                className="aspect-square w-full object-cover"
              />
            </button>
            <div className="flex items-center justify-between gap-2 px-2.5 py-2">
              <span className="truncate text-[12.5px] text-muted">{p.caption ?? p.createdAt}</span>
              <div className="flex shrink-0 items-center gap-1">
                {profilePhotoId === p.id ? (
                  <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">Profile</span>
                ) : (
                  <form action={setProfilePhotoAction}>
                    <input type="hidden" name="animalId" value={animalId} />
                    <input type="hidden" name="photoId" value={p.id} />
                    <button className="text-[12px] text-brand hover:underline">Set profile</button>
                  </form>
                )}
                {canManage && (
                  <RecordActions label="Photo actions"><form action={deletePhotoAction}>
                    <input type="hidden" name="animalId" value={animalId} />
                    <input type="hidden" name="photoId" value={p.id} />
                    <ConfirmSubmit className="record-delete-action" message="Delete this photo?">Delete photo</ConfirmSubmit>
                  </form></RecordActions>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {photo && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] text-white/60">
              {idx! + 1} / {photos.length}
            </span>
            <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-[14px] font-medium text-white/80 active:bg-white/10">
              Close
            </button>
          </div>

          <div
            className="relative flex flex-1 items-center justify-center"
            onClick={close}
          >
            {idx! > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm active:bg-white/20"
                aria-label="Previous"
              >
                <Chevron dir="left" />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={photo.id}
              src={`/api/photos/${photo.id}`}
              alt={photo.caption ?? "Photo"}
              className="max-h-[calc(100dvh-120px)] max-w-full object-contain px-12"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />

            {idx! < photos.length - 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm active:bg-white/20"
                aria-label="Next"
              >
                <Chevron dir="right" />
              </button>
            )}
          </div>

          {photo.caption && (
            <p className="px-4 pb-4 pt-2 text-center text-[13px] text-white/70">
              {photo.caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}
