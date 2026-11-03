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
      className="bg-background m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border-0 p-0 shadow-elev backdrop:bg-black/40"
    >
      {place ? (
        // A fresh flow per place: no code or form carries over.
        <div key={place.id} className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            {place.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={place.photo} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="bg-muted flex size-14 shrink-0 items-center justify-center rounded-xl">
                <MapPin className="text-muted-foreground size-5" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                Claim your place {enriching ? <EnrichingTag /> : null}
              </p>
              <p className="truncate text-lg font-semibold tracking-tight">{place.name ?? "Unnamed place"}</p>
              {place.address ? <p className="text-muted-foreground truncate text-sm">{place.address}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="hover:bg-muted inline-flex size-9 shrink-0 items-center justify-center rounded-full"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {added ? (
            <p className="border-border bg-card rounded-xl border px-4 py-3 text-sm">
              We added {place.name ?? "your place"} to Mesita{enriching ? " and are filling in its profile from public sources" : ""}. Now prove it&apos;s yours.
            </p>
          ) : null}
          <ClaimForm place={place} />
        </div>
      ) : null}
    </dialog>
  );
}
