"use client";

// Profile's Photos box (MESITA-3504, Pato 2026-11-08: "where is the box to
// configure Photos? Return it."). The gallery a guest swipes, hero first:
// add, reorder, remove. An added photo is stored at once
// (business-web-upload-place-photo) but reaches the gallery only when the
// page's one Save sends `photos` (business-web-update-place), so Discard
// drops it like any other edit.
//
// A saved gallery sticks (MESITA-3513, Pato: "make them stick"): it is an
// operator field, so every Enrich and Google Update writes around it until
// the card's Reset hands it back to Enrich.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagesIcon } from "@phosphor-icons/react/dist/ssr";
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Loader2, X } from "lucide-react";
import { photoUrl } from "@mesita/place-profile";
import { SectionCard } from "@/components/ui/manage";
import { resizeImageFile } from "@/lib/image-resize";
import { type AdminPlace, updatePlace, uploadPlacePhoto } from "../actions";
import { usePlaceContext } from "../PlaceContext";
import { useSectionSaver } from "../useSectionDirty";

const ACCEPT = "image/jpeg,image/png,image/webp";
/** The server action's body cap is 4 MB; the shrunk JPEG is far below it. */
const MAX_SEND_BYTES = 3.8 * 1024 * 1024;
const MAX_EDGE = 2048;

const galleryOf = (place: AdminPlace): string[] =>
  (Array.isArray(place.photos) ? place.photos : []).filter(
    (u): u is string => typeof u === "string" && u.trim() !== "",
  );

/** `staff`: the dialog also shows the Images step's two prompts. */
export function PhotosCard({ place, staff = false }: { place: AdminPlace; staff?: boolean }) {
  const { savePending, profile, setPlace } = usePlaceContext();
  const owned = (place.operator_fields ?? []).includes("photos");
  const [resetting, setResetting] = useState(false);
  const reset = async () => {
    setResetting(true);
    const r = await updatePlace({ id: place.id, reset_fields: ["photos"] });
    setResetting(false);
    if (r.ok) setPlace((prev) => ({ ...prev, operator_fields: r.data.place.operator_fields ?? [] }));
    else setError(r.error);
  };
  const max = profile.fieldLimits.photosMax;
  const [photos, setPhotos] = useState<string[]>(() => galleryOf(place));
  const [saved, setSaved] = useState<string[]>(photos);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const dirty = photos.join("\n") !== saved.join("\n");
  useSectionSaver(
    "photos",
    dirty,
    () => (dirty ? { kind: "patch" as const, patch: { id: place.id, photos } } : { kind: "clean" as const }),
    (fresh) => {
      const next = galleryOf(fresh);
      setPhotos(next);
      setSaved(next);
    },
    () => {
      setPhotos(saved);
      setError(null);
    },
  );

  const busy = savePending || uploading > 0;
  const room = max - photos.length;

  const add = async (files: File[]) => {
    setError(null);
    const take = files.slice(0, Math.max(0, room));
    if (files.length > take.length) setError(`A gallery holds up to ${max} photos.`);
    for (const original of take) {
      setUploading((n) => n + 1);
      try {
        const file = await resizeImageFile(original, { maxEdge: MAX_EDGE });
        if (!ACCEPT.split(",").includes(file.type)) {
          setError("Use a JPG, PNG or WEBP photo.");
          continue;
        }
        if (file.size > MAX_SEND_BYTES) {
          setError("That photo is too large. Try a smaller one.");
          continue;
        }
        const form = new FormData();
        form.set("place_id", place.id);
        form.set("file", file);
        const r = await uploadPlacePhoto(form);
        if (!r.ok) {
          setError(r.error);
          continue;
        }
        setPhotos((prev) => (prev.length < max && !prev.includes(r.data.url) ? [...prev, r.data.url] : prev));
      } catch {
        setError("The photo did not upload. Try again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const move = (from: number, dir: -1 | 1) =>
    setPhotos((prev) => {
      const to = from + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  /** Drag and drop: the dragged photo lands where it was dropped. */
  const moveTo = (from: number, to: number) =>
    setPhotos((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  const makeHero = (from: number) =>
    setPhotos((prev) => [prev[from], ...prev.filter((_, i) => i !== from)]);
  const remove = (at: number) => setPhotos((prev) => prev.filter((_, i) => i !== at));

  const iconButton =
    "inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-40";

  return (
    <SectionCard
      icon={<ImagesIcon size={20} />}
      title="Photos"
      subtitle={`What guests swipe through, in this order. The first is the cover. Drag or use the arrows to reorder; tap a photo to see it big. Up to ${max}.`}
      action={
        <span className="inline-flex items-center gap-3">
          {owned ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-muted-foreground type-meta">Enrich keeps it</span>
              <button
                type="button"
                className="text-primary type-meta font-medium underline-offset-4 hover:underline disabled:opacity-50"
                disabled={busy || resetting || dirty}
                onClick={() => void reset()}
              >
                {resetting ? "Resetting…" : "Reset"}
              </button>
            </span>
          ) : null}
          <span className="text-muted-foreground type-label tabular-nums">
            {photos.length} / {max}
          </span>
        </span>
      }
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        disabled={busy || room <= 0}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length > 0) void add(files);
        }}
      />

      <div className="mt-5 grid grid-cols-3 gap-3">
        {photos.map((src, i) => (
          <div
            key={src}
            draggable={!busy && photos.length > 1}
            onDragStart={(e) => {
              setDragFrom(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragFrom === null) return;
              e.preventDefault();
              if (dragOver !== i) setDragOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null) moveTo(dragFrom, i);
              setDragFrom(null);
              setDragOver(null);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDragOver(null);
            }}
            className={
              "bg-muted group border-border/60 relative aspect-square overflow-hidden rounded-xl border transition " +
              (dragFrom === i ? "opacity-40 " : "") +
              (dragOver === i && dragFrom !== i ? "ring-foreground ring-2 " : "") +
              (photos.length > 1 ? "cursor-grab active:cursor-grabbing" : "")
            }
          >
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open photo ${i + 1}`}
              className="block h-full w-full cursor-zoom-in"
            >
              {/* Stored photos load their 640px size (MESITA-2966). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(src, "card")}
                onError={(e) => {
                  if (e.currentTarget.src !== src) e.currentTarget.src = src;
                }}
                alt={`Photo ${i + 1}`}
                draggable={false}
                className="h-full w-full object-cover"
              />
            </button>
            <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 type-label font-semibold text-white tabular-nums">
              {i + 1}
            </span>
            {i === 0 ? (
              <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 type-label font-semibold text-white">
                Cover
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makeHero(i)}
                disabled={busy}
                className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 type-label font-semibold text-white opacity-100 transition hover:bg-black/80 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                Make cover
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={busy}
              aria-label={`Remove photo ${i + 1}`}
              className={`${iconButton} absolute top-2 right-2`}
            >
              <X className="size-4" />
            </button>
            {photos.length > 1 ? (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-between [&>button]:pointer-events-auto">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={busy || i === 0}
                aria-label={`Move photo ${i + 1} earlier`}
                className={iconButton}
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={busy || i === photos.length - 1}
                aria-label={`Move photo ${i + 1} later`}
                className={iconButton}
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
            ) : null}
            {photos.length > 1 ? (
              <GripVertical
                aria-hidden
                className="pointer-events-none absolute top-2 left-1/2 size-4 -translate-x-1/2 text-white drop-shadow sm:opacity-0 sm:group-hover:opacity-100"
              />
            ) : null}
          </div>
        ))}

        {room > 0 || uploading > 0 ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy || room <= 0}
            className="border-border text-muted-foreground hover:bg-muted/60 flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium transition disabled:opacity-60"
          >
            {uploading > 0 ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            {uploading > 0 ? "Uploading…" : "Add photos"}
          </button>
        ) : null}
      </div>

      {photos.length === 0 && uploading === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">No photos yet. Guests see a plain card until you add one.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      ) : null}
      {open !== null && photos[open] ? (
        <PhotoDialog
          place={place}
          url={photos[open]}
          index={open}
          count={photos.length}
          staff={staff}
          onStep={(dir) => setOpen((o) => (o === null ? o : Math.min(photos.length - 1, Math.max(0, o + dir))))}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </SectionCard>
  );
}

/** Where a photo came from, in words. */
function sourceLabel(place: AdminPlace, url: string): string {
  const source = place.photo_source?.[url];
  if (source === "google") return "Google";
  if (source === "instagram") return "Instagram";
  if (url.includes("/place-images/business/")) return "Uploaded here";
  return "Google (from Create)";
}

/**
 * The big view (MESITA-3519, Pato: "when you click an image it must be open
 * big and you must be able to see its metadata"). The photo at full size,
 * its place in the gallery, where it came from, and what the Images step's
 * Analysis prompt wrote about it. Staff also see both prompts: Enrich
 * describes every photo with the Analysis prompt, then one Sorting call reads
 * all the descriptions and returns the order.
 */
function PhotoDialog({
  place,
  url,
  index,
  count,
  staff,
  onStep,
  onClose,
}: {
  place: AdminPlace;
  url: string;
  index: number;
  count: number;
  staff: boolean;
  onStep: (dir: -1 | 1) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onStep(-1);
      if (e.key === "ArrowRight") onStep(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);

  const description = place.photo_analysis?.[url]?.trim() ?? "";
  const prompts = place.photo_prompts;
  const navButton =
    "inline-flex size-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-30";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${count}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="border-border/70 bg-card shadow-elev flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl(url, "full")}
            onError={(e) => {
              if (e.currentTarget.src !== url) e.currentTarget.src = url;
            }}
            alt={`Photo ${index + 1}`}
            className="max-h-[60dvh] w-full object-contain lg:max-h-[92dvh]"
          />
          <button type="button" aria-label="Previous photo" disabled={index === 0} onClick={() => onStep(-1)} className={`${navButton} absolute left-3 top-1/2 -translate-y-1/2`}>
            <ArrowLeft className="size-5" />
          </button>
          <button type="button" aria-label="Next photo" disabled={index === count - 1} onClick={() => onStep(1)} className={`${navButton} absolute right-3 top-1/2 -translate-y-1/2`}>
            <ArrowRight className="size-5" />
          </button>
        </div>
        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto p-5 lg:w-96">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base font-semibold">
                Photo {index + 1} of {count}
                {index === 0 ? " · Cover" : ""}
              </p>
              <p className="text-muted-foreground text-sm">{sourceLabel(place, url)}</p>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="size-5" />
            </button>
          </div>

          <section>
            <p className="text-muted-foreground type-eyebrow">What Enrich saw</p>
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">
              {description ||
                "No description yet. Enrich writes one for every photo it keeps; photos uploaded here, or kept from Create, have none."}
            </p>
          </section>

          {staff && prompts ? (
            <>
              <section>
                <p className="text-muted-foreground type-eyebrow">Analysis prompt (describes each photo)</p>
                <p className="bg-muted/60 mt-1.5 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-line">
                  {prompts.analysis}
                </p>
              </section>
              <section>
                <p className="text-muted-foreground type-eyebrow">Sorting prompt (reads every description, returns one order)</p>
                <p className="bg-muted/60 mt-1.5 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-line">
                  {prompts.sorting}
                </p>
              </section>
              <p className="text-muted-foreground text-xs">
                Today&apos;s prompts from Configurations › Enriching › Images{prompts.vision ? "" : " (Vision is off)"}. A description was written by the prompt live when that Enrich ran.
              </p>
            </>
          ) : null}
        </aside>
      </div>
    </div>,
    document.body,
  );
}
