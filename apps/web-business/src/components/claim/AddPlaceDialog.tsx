"use client";

// Add a place (MESITA-3138, Pato: "include hero image … and all that"): a
// Google listing Mesita doesn't hold opens this dialog before anything is
// added, the way the consumer app's Generate dialog does (MESITA-2941:
// "i don't want false positives, people adding the wrong place"). One
// Details read when it opens: Google's first photo as the hero with its
// credit, then the name, category, stars and full address. Nothing is
// stored. A failed or photo-less read keeps a plain tile; Add never waits.
// While Add runs, the buttons give way to the create steps (MESITA-3140).

import { useEffect, useRef, useState } from "react";
import { MapPin, Plus, Star, X } from "lucide-react";
import { previewGooglePlace, type FoundPlace, type GooglePreview } from "@/lib/business-api";
import { GenerateSteps } from "@/components/place-manage/GenerateSteps";

export function AddPlaceDialog({
  place,
  label,
  adding,
  error,
  onConfirm,
  onClose,
}: {
  place: FoundPlace | null;
  label: string;
  adding: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (place && d && !d.open) d.showModal();
    if (!place && d?.open) d.close();
  }, [place]);

  return (
    <dialog
      ref={dialog}
      aria-label="Add a place"
      onCancel={(e) => {
        if (adding) e.preventDefault();
      }}
      onClose={() => {
        if (!adding) onClose();
      }}
      onClick={(e) => {
        // p-0 + inner wrapper: a click on the <dialog> itself is the backdrop.
        if (!adding && e.target === e.currentTarget) onClose();
      }}
      className="bg-card m-auto w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border-0 p-0 shadow-elev backdrop:bg-black/40"
    >
      {place?.google_place_id ? (
        // A fresh body per listing: no preview carries over.
        <Body key={place.google_place_id} place={place} label={label} adding={adding} error={error} onConfirm={onConfirm} onClose={onClose} />
      ) : null}
    </dialog>
  );
}

function Body({
  place,
  label,
  adding,
  error,
  onConfirm,
  onClose,
}: {
  place: FoundPlace;
  label: string;
  adding: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  // undefined while the read runs, null when it failed.
  const [preview, setPreview] = useState<GooglePreview | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    previewGooglePlace(place.google_place_id!).then((r) => {
      if (live) setPreview(r.ok ? r.data : null);
    });
    return () => {
      live = false;
    };
  }, [place.google_place_id]);

  const name = preview?.name || place.name || "Unnamed place";
  const address = preview?.address || place.address;
  const rating = preview?.rating ? preview.rating.toFixed(1) : null;

  return (
    <div className="flex flex-col">
      <div className="bg-muted relative aspect-[16/10] w-full">
        {preview?.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.photoUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <MapPin className={"text-muted-foreground size-8" + (preview === undefined ? " animate-pulse" : "")} aria-hidden />
          </div>
        )}
        {preview?.photoUrl && preview.photoAuthor ? (
          <span className="absolute bottom-2 left-3 rounded-full bg-black/45 px-2 py-0.5 text-xs text-white">Photo: {preview.photoAuthor}</span>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          disabled={adding}
          aria-label="Close"
          className="bg-card/90 hover:bg-card absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-full disabled:opacity-50"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold tracking-tight">{name}</p>
          {preview?.category || rating ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              {preview?.category ? <span>{preview.category}</span> : null}
              {preview?.category && rating ? <span aria-hidden>·</span> : null}
              {rating ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-current" aria-hidden /> {rating}
                  {preview?.reviewCount ? <span>({preview.reviewCount.toLocaleString("en-US")})</span> : null}
                </span>
              ) : null}
            </p>
          ) : null}
          {address ? <p className="text-muted-foreground text-sm">{address}</p> : null}
          <p className="text-muted-foreground text-sm">Not on Mesita yet. Adding it creates its profile from Google; it grants nothing.</p>
        </div>
        {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
        {adding ? (
          <div className="flex h-12 items-center justify-center">
            <GenerateSteps />
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={adding}
              className="border-border hover:bg-muted h-10 rounded-full border px-4 text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={adding}
              className="bg-foreground text-background inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold disabled:opacity-60"
            >
              <Plus className="size-4" aria-hidden /> {label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
