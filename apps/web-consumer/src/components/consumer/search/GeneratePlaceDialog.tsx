"use client";

// GENERATE, CONFIRMED, AWAITED (Pato, MESITA-2935: "before create, also show
// a confirmation modal … create the place, and after the place is created
// open the profile"). A Search row's Generate opens this dialog: the place's
// name and address, Cancel and Generate profile. Generate turns the dialog
// into the generating view and awaits get-or-create (one shared request per
// Google Place ID); landed, the parent opens the REAL profile. The opening
// route's draft profile never shows from Search any more. A refusal stays
// here, with Try again. The tap creates, never a render or an effect.

import { useRef, useState } from "react";
import { MapPin, Sparkles } from "lucide-react";

import { GeneratingPlace } from "@/components/consumer/GeneratingPlace";
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
  onGenerated: (opened: OpenedGooglePlace, target: GenerateTarget) => void;
}) {
  // While get-or-create runs the dialog holds: a stray backdrop tap or Esc
  // must not drop the guest out of a create that is about to open a profile.
  const [busy, setBusy] = useState(false);
  return (
    <LocalDialog
      open={open}
      onClose={() => (busy ? undefined : onClose())}
      ariaLabel="Generate a profile"
    >
      {target ? (
        // A fresh body per open: no confirm/generating state carries over.
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
  onGenerated: (opened: OpenedGooglePlace, target: GenerateTarget) => void;
  onBusy: (busy: boolean) => void;
}) {
  const supabase = useBrowserSupabase();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);

  const generate = async () => {
    const mine = ++run.current;
    setGenerating(true);
    setError(null);
    onBusy(true);
    try {
      const opened = await getOrCreateGooglePlace(supabase, target.gid);
      if (run.current === mine) onGenerated(opened, target);
    } catch (err) {
      if (run.current === mine) {
        setError(errMsg(err, "Couldn't generate that profile right now."));
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

  if (generating) {
    return (
      <div className="py-8" data-generate-place="generating">
        <GeneratingPlace
          name={target.name}
          address={target.address}
          error={error}
          onRetry={() => void generate()}
        />
        {error ? (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={cancel}
              className="text-muted-foreground hover:text-foreground text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center px-6 pt-7 pb-6 text-center"
      data-generate-place="confirm"
    >
      <span className="bg-foreground text-paper flex h-14 w-14 items-center justify-center rounded-2xl">
        <Sparkles className="h-6 w-6" strokeWidth={2} aria-hidden />
      </span>
      <h2 className={cn(SHEET_TITLE_CLASS, "mt-4")}>Generate a profile?</h2>
      <p className="text-muted-foreground mt-1.5 max-w-[280px] text-sm leading-relaxed">
        This place isn&apos;t on Mesita yet. We&apos;ll build its profile from
        Google, and anyone can vote to enrich it.
      </p>
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
      <div className="mt-5 flex w-full gap-2">
        <button
          type="button"
          onClick={cancel}
          className={SHEET_CANCEL_BUTTON_CLASS}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void generate()}
          className={cn(PRIMARY_BUTTON_CLASS, "h-auto flex-1 py-3")}
          data-generate-place-confirm
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Generate
        </button>
      </div>
    </div>
  );
}
