"use client";

// Profile's Photos box (MESITA-3504, Pato 2026-11-08: "where is the box to
// configure Photos? Return it."). The gallery a guest swipes, hero first:
// add, reorder, remove. An added photo is stored at once
// (business-web-upload-place-photo) but reaches the gallery only when the
// page's one Save sends `photos` (business-web-update-place), so Discard
// drops it like any other edit.
//
// The next Enrich still rebuilds the gallery (Docs › Atlas, one gallery):
// an owner's order does not stick through Enrich yet.

import { useRef, useState } from "react";
import { ImagesIcon } from "@phosphor-icons/react/dist/ssr";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { photoUrl } from "@mesita/place-profile";
import { SectionCard } from "@/components/ui/manage";
import { resizeImageFile } from "@/lib/image-resize";
import { type AdminPlace, uploadPlacePhoto } from "../actions";
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

export function PhotosCard({ place }: { place: AdminPlace }) {
  const { savePending, profile } = usePlaceContext();
  const max = profile.fieldLimits.photosMax;
  const [photos, setPhotos] = useState<string[]>(() => galleryOf(place));
  const [saved, setSaved] = useState<string[]>(photos);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

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
  const makeHero = (from: number) =>
    setPhotos((prev) => [prev[from], ...prev.filter((_, i) => i !== from)]);
  const remove = (at: number) => setPhotos((prev) => prev.filter((_, i) => i !== at));

  const iconButton =
    "inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-40";

  return (
    <SectionCard
      icon={<ImagesIcon size={20} />}
      title="Photos"
      subtitle={`What guests swipe through. The first one is the cover. Up to ${max}.`}
      action={
        <span className="text-muted-foreground type-label tabular-nums">
          {photos.length} / {max}
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
            className="bg-muted group border-border/60 relative aspect-square overflow-hidden rounded-xl border"
          >
            {/* Stored photos load their 640px size (MESITA-2966). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(src, "card")}
              onError={(e) => {
                if (e.currentTarget.src !== src) e.currentTarget.src = src;
              }}
              alt={`Photo ${i + 1}`}
              className="h-full w-full object-cover"
            />
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
            <div className="absolute inset-x-2 bottom-2 flex justify-between">
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
    </SectionCard>
  );
}
