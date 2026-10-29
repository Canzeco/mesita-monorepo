"use client";

// GENERATE, CONFIRMED, AWAITED (Pato, MESITA-2935: "before create, also show
// a confirmation modal … create the place, and after the place is created
// open the profile"). A Search row's Generate opens this dialog: the
// sparkles tile, "Generate a profile?", one line, the place's name and
// address, Cancel and Generate. The tap creates, never a render or an
// effect; landed, the parent opens the REAL profile. The opening route's
// generating screen never shows from Search. Landed, the card reads
// "Opening profile…" and stays up until the profile replaces it; the parent
// closes it when the address moves (MESITA-2957).
//
// ONE CARD, THREE STATES, ONE HEIGHT (design review, 2026-10-28). Confirm,
// generating and error share the tile, the title line, the body line and the
// place box; only the words change. The footer is a fixed 48px slot whose
// two layers cross-fade: the button row (confirm: Cancel · Generate; error:
// Cancel · Try again) and the step line (GenerateSteps, about ten seconds,
// measured). Nothing jumps (D6); the icon stays still (D8); the error keeps
// two full-size buttons (D10). Focus moves with the state: Generate on
// open, the card while it runs (the status is announced), Try again on an
// error (D11). While the create runs a backdrop tap or Esc does nothing.
//
// GOOGLE'S PREVIEW FIRST (Pato, MESITA-2941: "i don't want false positives,
// people adding the wrong place"). The dialog opens with one Details read:
// Google's first photo as the hero, then the category, stars and full
// address in the place box, so two places with one name read apart before
// anything is created. A failed or photo-less read keeps the sparkles tile
// in the hero; Generate never waits for the preview.

import { useEffect, useRef, useState } from "react";
import { MapPin, Sparkles, Star } from "lucide-react";

import {
  GenerateSteps,
  GenerateTile,
} from "@/components/consumer/GeneratingPlace";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiPreviewGooglePlace,
  type GooglePlacePreview,
} from "@/lib/api/place-search";
import {
  getOrCreateGooglePlace,
  type OpenedGooglePlace,
} from "@/lib/use-open-google-place";
import {
  PRIMARY_BUTTON_CLASS,
  SHEET_CANCEL_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

export type GenerateTarget = {
  /** The Google Place ID get-or-create keys on. */
  gid: string;
  name: string;
  address?: string | null;
};

// "opening": the create landed and the profile is on its way; the parent
// closes the dialog once the address moves (MESITA-2957).
type Phase = "confirm" | "generating" | "opening" | "error";

export function GeneratePlaceDialog({
  open,
  target,
  onClose,
  onGenerated,
}: {
  open: boolean;
  /** Kept after close so the exit fade still has its text. */
  target: GenerateTarget | null;
  onClose: () => void;
  onGenerated: (opened: OpenedGooglePlace) => void;
}) {
  const [busy, setBusy] = useState(false);
  // Each open starts clean: an opening hand-off ends with the dialog closed
  // while still busy, and a reopen must not inherit it.
  const [opens, setOpens] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBusy(false);
      setOpens((n) => n + 1);
    }
  }
  return (
    <LocalDialog
      open={open}
      onClose={() => (busy ? undefined : onClose())}
      ariaLabel="Generate a profile"
    >
      {target ? (
        // A fresh body per place: no state carries over between opens.
        <GenerateBody
          key={`${target.gid}:${opens}`}
          target={target}
          onClose={onClose}
          onGenerated={onGenerated}
          onBusy={setBusy}
        />
      ) : null}
    </LocalDialog>
  );
}

function GenerateBody({
  target,
  onClose,
  onGenerated,
  onBusy,
}: {
  target: GenerateTarget;
  onClose: () => void;
  onGenerated: (opened: OpenedGooglePlace) => void;
  onBusy: (busy: boolean) => void;
}) {
  const supabase = useBrowserSupabase();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const run = useRef(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  // undefined while the read runs, null when it failed.
  const [preview, setPreview] = useState<GooglePlacePreview | null | undefined>(
    undefined,
  );

  // One Details read per open; the body is keyed per place.
  useEffect(() => {
    let live = true;
    apiPreviewGooglePlace(supabase, target.gid).then(
      (p) => live && setPreview(p),
      () => live && setPreview(null),
    );
    return () => {
      live = false;
    };
  }, [supabase, target.gid]);

  // Focus follows the state (D11). The dialog fades in over a frame, so the
  // first focus waits one.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (phase === "generating" || phase === "opening")
        cardRef.current?.focus();
      else primaryRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const generate = async () => {
    const mine = ++run.current;
    setPhase("generating");
    setError(null);
    setAttempt((n) => n + 1);
    onBusy(true);
    try {
      const opened = await getOrCreateGooglePlace(supabase, target.gid);
      // Still busy: the dialog holds the screen until the profile replaces
      // it (MESITA-2957).
      if (run.current === mine) {
        setPhase("opening");
        onGenerated(opened);
      }
    } catch (err) {
      if (run.current === mine) {
        setError(errMsg(err, "Couldn't generate that profile right now."));
        setPhase("error");
        onBusy(false);
      }
    }
  };

  const cancel = () => {
    // A closed dialog drops a late answer; the create itself still lands
    // and the lists swap the card (lib/created-places.ts).
    run.current += 1;
    onBusy(false);
    onClose();
  };

  const opening = phase === "opening";
  const running = phase === "generating" || opening;
  const failed = phase === "error";
  const address = preview?.address || target.address;
  const rating = preview?.rating ? preview.rating.toFixed(1) : null;

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className="flex flex-col items-center text-center outline-none"
      data-generate-place={phase}
    >
      <PreviewHero preview={preview} muted={failed} />
      <div className="flex w-full flex-col items-center px-6 pt-5 pb-6">
        <div role="status" aria-live="polite" aria-busy={running}>
          <h2 className={SHEET_TITLE_CLASS}>
            {running
              ? "Generating profile…"
              : failed
                ? "Couldn't generate this profile"
                : "Generate a profile?"}
          </h2>
          <p className="text-muted-foreground mt-1.5 max-w-[280px] text-sm leading-relaxed">
            {failed ? error : "We'll build its profile from Google."}
          </p>
        </div>
        <div className="bg-muted mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left">
          <MapPin
            className="text-muted-foreground h-5 w-5 shrink-0"
            strokeWidth={2.25}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="text-foreground block truncate text-sm font-semibold">
              {preview?.name || target.name}
            </span>
            {preview?.category || rating ? (
              <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                {preview?.category ? (
                  <span className="truncate">{preview.category}</span>
                ) : null}
                {preview?.category && rating ? (
                  <span aria-hidden>·</span>
                ) : null}
                {rating ? (
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Star
                      className="fill-fact-star text-fact-star h-3 w-3"
                      aria-hidden
                    />
                    {rating}
                    {preview?.reviewCount ? (
                      <span>({preview.reviewCount})</span>
                    ) : null}
                  </span>
                ) : null}
              </span>
            ) : null}
            {address ? (
              <span className="text-muted-foreground line-clamp-2 block text-xs">
                {address}
              </span>
            ) : null}
          </span>
        </div>

        {/* The fixed footer slot: buttons and steps cross-fade in place. */}
        <div className="relative mt-5 h-12 w-full">
          <div
            className={cn(
              "absolute inset-0 flex gap-2 transition-opacity duration-200 motion-reduce:transition-none",
              running ? "pointer-events-none opacity-0" : "opacity-100",
            )}
            aria-hidden={running}
            inert={running}
          >
            <button
              type="button"
              onClick={cancel}
              className={SHEET_CANCEL_BUTTON_CLASS}
            >
              Cancel
            </button>
            <button
              ref={primaryRef}
              type="button"
              onClick={() => void generate()}
              className={cn(PRIMARY_BUTTON_CLASS, "h-auto flex-1 py-3")}
              data-generate-place-confirm
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {failed ? "Try again" : "Generate"}
            </button>
          </div>
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity duration-200 motion-reduce:transition-none",
              running ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={!running}
          >
            {opening ? (
              <span className="text-foreground animate-in fade-in text-sm font-semibold duration-300 motion-reduce:animate-none">
                Opening profile…
              </span>
            ) : running ? (
              <GenerateSteps key={attempt} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Google's first photo, a fixed 16:10 slot so nothing jumps when it lands:
 *  a pulse while the read runs, the sparkles tile when there is no photo. */
function PreviewHero({
  preview,
  muted,
}: {
  preview: GooglePlacePreview | null | undefined;
  muted: boolean;
}) {
  const photo = preview?.photoUrl;
  return (
    <div
      className={cn(
        "bg-muted relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden",
        preview === undefined && "animate-pulse motion-reduce:animate-none",
      )}
    >
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
          {/* Google requires the photo's author next to it. */}
          {preview?.photoAuthor ? (
            <span className="type-label absolute bottom-2 left-2 max-w-[80%] truncate rounded-full bg-black/55 px-2 py-0.5 text-white">
              Photo: {preview.photoAuthor} · Google
            </span>
          ) : null}
        </>
      ) : preview !== undefined ? (
        <GenerateTile muted={muted} />
      ) : null}
    </div>
  );
}
