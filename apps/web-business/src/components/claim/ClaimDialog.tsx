"use client";

// Claim, in a modal (Pato, MESITA-3139: "in order to access a place, you
// need to directly verify ownership with phone call, build the modal"). The
// search's Claim, and Add and claim once the place is added, open this over
// Places: the place, then the claim flow of /claim/<id> (ClaimForm) — a call
// to the listing's phone with a 6-digit code, or Mesita checks by hand.
// Native <dialog>: the page behind is inert, Escape closes.

import { useEffect, useRef } from "react";
import { MapPin, X } from "lucide-react";
import type { ClaimablePlace } from "@/lib/business-api";
import { ClaimForm } from "./ClaimForm";
import { EnrichingTag } from "@/components/place-manage/GenerateSteps";

export function ClaimDialog({
  place,
  added,
  enriching,
  onClose,
}: {
  place: ClaimablePlace | null;
  added: boolean;
  /** The add started Enrich (MESITA-3140). */
  enriching: boolean;
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
      aria-label="Claim your place"
      onClose={onClose}
      onClick={(e) => {
        // p-0 + inner wrapper: a click on the <dialog> itself is the backdrop.
        if (e.target === e.currentTarget) dialog.current?.close();
      }}
      className="bg-card m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border-0 p-0 shadow-elev backdrop:bg-black/30 backdrop:backdrop-blur-sm"
    >
      {place ? (
        // A fresh flow per place: no code or form carries over.
        <div key={place.id} className="relative flex flex-col gap-5 px-5 pt-8 pb-5 sm:px-6">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="bg-muted/70 hover:bg-muted text-muted-foreground absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full transition-colors"
          >
            <X className="size-4" aria-hidden />
          </button>
          {/* The place, centred like a sheet's title (MESITA-3148). */}
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            {place.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={place.photo} alt="" className="size-16 rounded-2xl object-cover shadow-sm" />
            ) : (
              <span className="bg-muted flex size-16 items-center justify-center rounded-2xl">
                <MapPin className="text-muted-foreground size-6" aria-hidden />
              </span>
            )}
            <div className="flex min-w-0 flex-col items-center gap-1">
              <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                Claim your place {enriching ? <EnrichingTag /> : null}
              </p>
              <h2 className="text-xl font-semibold tracking-tight">{place.name ?? "Unnamed place"}</h2>
              {place.address ? <p className="text-muted-foreground line-clamp-2 text-sm">{place.address}</p> : null}
            </div>
          </div>
          {added ? (
            <p className="text-muted-foreground text-center text-sm">
              We added {place.name ?? "your place"} to Mesita{enriching ? " and are filling in its profile from public sources" : ""}. Now prove it&apos;s yours.
            </p>
          ) : null}
          <ClaimForm place={place} />
        </div>
      ) : null}
    </dialog>
  );
}
