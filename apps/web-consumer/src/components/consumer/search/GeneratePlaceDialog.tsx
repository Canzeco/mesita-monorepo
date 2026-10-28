"use client";

// GENERATE, CONFIRMED, AWAITED (Pato, MESITA-2935: "before create, also show
// a confirmation modal … create the place, and after the place is created
// open the profile"). A Search row's Generate opens this dialog: the
// sparkles tile, "Generate a profile?", one line, the place's name and
// address, Cancel and Generate. The tap creates, never a render or an
// effect; landed, the parent opens the REAL profile. The opening route's
// generating screen never shows from Search.
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

import { useEffect, useRef, useState } from "react";
import { MapPin, Sparkles } from "lucide-react";

import {
  GenerateSteps,
  GenerateTile,
} from "@/components/consumer/GeneratingPlace";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { useBrowserSupabase } from "@/lib/supabase/browser";
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

type Phase = "confirm" | "generating" | "error";

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
  return (
    <LocalDialog
      open={open}
      onClose={() => (busy ? undefined : onClose())}
      ariaLabel="Generate a profile"
    >
      {target ? (
        // A fresh body per place: no state carries over between opens.
        <GenerateBody
          key={target.gid}
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

  // Focus follows the state (D11). The dialog fades in over a frame, so the
  // first focus waits one.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (phase === "generating") cardRef.current?.focus();
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
      if (run.current === mine) onGenerated(opened);
    } catch (err) {
      if (run.current === mine) {
        setError(errMsg(err, "Couldn't generate that profile right now."));
        setPhase("error");
      }
    } finally {
      if (run.current === mine) onBusy(false);
    }
  };

  const cancel = () => {
    // A closed dialog drops a late answer; the create itself still lands
    // and the lists swap the card (lib/created-places.ts).
    run.current += 1;
    onBusy(false);
    onClose();
  };

  const running = phase === "generating";
  const failed = phase === "error";

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className="flex flex-col items-center px-6 pt-7 pb-6 text-center outline-none"
      data-generate-place={phase}
    >
      <GenerateTile muted={failed} />
      <div role="status" aria-live="polite" aria-busy={running}>
        <h2 className={cn(SHEET_TITLE_CLASS, "mt-4")}>
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
            {target.name}
          </span>
          {target.address ? (
            <span className="text-muted-foreground block truncate text-xs">
              {target.address}
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
          {running ? <GenerateSteps key={attempt} /> : null}
        </div>
      </div>
    </div>
  );
}
