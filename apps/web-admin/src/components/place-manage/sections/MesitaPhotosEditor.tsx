"use client";

import { useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { ALLOWED_IMAGE_ACCEPT } from "@/lib/place-upload-utils";

export function MesitaPhotosEditor({
  placeId,
  photos,
  photosMax,
  pending,
  uploading,
  onUpload,
  onMove,
  onRemove,
  onInfo,
}: {
  placeId: string;
  photos: string[];
  photosMax: number;
  pending: boolean;
  uploading: boolean;
  onUpload: (file: File) => void | Promise<void>;
  onMove: (from: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
  onInfo: (url: string) => void;
}) {
  const inputId = `mesita-photo-upload-${placeId}`;
  const atCap = photos.length >= photosMax;
  const busy = pending || uploading;

  return (
    <div className="mt-5">
      <input
        id={inputId}
        type="file"
        accept={ALLOWED_IMAGE_ACCEPT}
        disabled={busy || atCap}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onUpload(file);
        }}
      />

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {photos.map((src, idx) => (
          <div
            key={`${src}-${idx}`}
            className="group relative overflow-hidden rounded-xl ring-1 ring-black/5"
          >
            <button
              type="button"
              onClick={() => onInfo(src)}
              className="block w-full cursor-pointer"
              aria-label={`Photo ${idx + 1} details`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Photo ${idx + 1}`}
                className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </button>
            {idx === 0 && (
              <span className="bg-pink-gradient absolute top-2 left-2 rounded-full px-2 py-0.5 type-meta font-semibold tracking-wide text-white uppercase shadow-card">
                Hero
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={busy || idx === 0}
                  onClick={() => onMove(idx, -1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 disabled:opacity-40"
                  aria-label="Move earlier"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy || idx === photos.length - 1}
                  onClick={() => onMove(idx, 1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 disabled:opacity-40"
                  aria-label="Move later"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(idx)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm transition hover:bg-destructive/70"
                  aria-label="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {!atCap && (
          <label
            htmlFor={inputId}
            className={
              "border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/[0.03] flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-center transition " +
              (busy ? "pointer-events-none opacity-50" : "")
            }
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="type-label font-medium">Uploading…</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="type-label font-medium">Add photo</span>
              </>
            )}
          </label>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          No Mesita photos yet — guests fall back to the Google catalog until Enrich or you add some here.
        </p>
      ) : (
        <p className="text-muted-foreground mt-3 type-label tabular-nums">
          {photos.length}/{photosMax} photos · JPG, PNG, WEBP, AVIF · max 8 MB · first photo is the hero
        </p>
      )}
    </div>
  );
}

export function MesitaPhotoMetaDialog({
  url,
  analysis,
  position,
  total,
  onClose,
}: {
  url: string;
  analysis: string | null;
  position: number;
  total: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mesita-photo-meta-title"
      onClick={onClose}
    >
      <div
        className="border-border bg-card shadow-card max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="mesita-photo-meta-title"
              className="font-display text-base font-semibold tracking-tight"
            >
              Photo {position} of {total}
              {position === 1 ? " · Hero" : ""}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs break-all">{url}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0 rounded-lg p-1"
            aria-label="Close"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
        {analysis ? (
          <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap">{analysis}</p>
        ) : (
          <p className="text-muted-foreground mt-4 text-xs italic">
            No vision caption for this URL yet — run Enrich to describe the gallery.
          </p>
        )}
      </div>
    </div>
  );
}

export function urlPhotoList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}
