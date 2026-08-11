"use client";

// Step 2 of THE TICKET — "do tasks". One panel for both rungs: open the
// target app, come back, say you did it. Proofs SELF-ATTEST (MESITA-849):
// confirming writes `self_verified` straight away, no screenshot and no staff
// approval, so the rate moves the moment the guest says it moved.
//
// This was two near-identical LocalSheets (GoogleReviewSheet /
// InstagramStorySheet) stacked on top of the ticket panel. A sheet over a
// stepped modal is a stack — the step IS the surface now, so the body renders
// inline and the two copies collapsed into one component.

import { useCallback, useState } from "react";
import { Check, ExternalLink, Instagram, Loader2, Star } from "lucide-react";
import { UtensilsCrossed } from "lucide-react";

import { cn } from "@/lib/utils";

export type TaskKind = "review" | "story";

export function googleMapsSearchUrl(placeName: string, address?: string | null) {
  const q = [placeName, address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q || "restaurant",
  )}`;
}

export function instagramOpenUrl() {
  return "https://www.instagram.com/";
}

type Phase = "idle" | "opening" | "confirming" | "success" | "error";

export function TaskProof({
  kind,
  placeName,
  placeAddress,
  rate,
  rejected = false,
  onConfirm,
  onDone,
  onSkip,
}: {
  kind: TaskKind;
  placeName: string;
  placeAddress?: string | null;
  /** The rate this task unlocks — 0 hides the number rather than guess one. */
  rate: number;
  /** A proof that came back rejected: the base still holds, retry is allowed. */
  rejected?: boolean;
  onConfirm: () => Promise<void>;
  /** Fired after a confirmed proof — the caller advances to the QR. */
  onDone: () => void;
  /** "I'll do it later" — the QR is never gated on this, so leaving is free. */
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const isReview = kind === "review";

  const openTarget = useCallback(() => {
    setPhase("opening");
    window.open(
      isReview ? googleMapsSearchUrl(placeName, placeAddress) : instagramOpenUrl(),
      "_blank",
      "noopener,noreferrer",
    );
    window.setTimeout(() => setPhase("idle"), 600);
  }, [isReview, placeName, placeAddress]);

  const confirm = useCallback(async () => {
    setPhase("confirming");
    setError(null);
    try {
      await onConfirm();
      setPhase("success");
      window.setTimeout(() => onDone(), 400);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't confirm that just yet.",
      );
      setPhase("error");
    }
  }, [onConfirm, onDone]);

  return (
    <div className="flex flex-col gap-3">
      {/* Order first (D8): the task is something you do while the food comes,
          not a toll you pay at the door. */}
      <p className="rounded-xl bg-amber-500/12 px-3 py-2 text-center text-[11.5px] leading-snug font-bold text-amber-800">
        <UtensilsCrossed className="mr-1 inline size-3.5 align-[-2px]" />
        Order first — do this while your food comes.
      </p>

      <div className="surface-card rounded-2xl px-4 py-4 text-center">
        <span className="bg-secondary/10 text-secondary mx-auto grid size-11 place-items-center rounded-xl">
          {isReview ? <Star className="size-5" /> : <Instagram className="size-5" />}
        </span>
        <p className="text-foreground mt-2 text-[14.5px] font-extrabold tracking-tight">
          {isReview ? "Leave your Google review" : "Post your tagged story"}
        </p>
        <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
          {isReview
            ? "Rate your visit on Google — you can edit it later."
            : `Tag ${placeName} in your story, then confirm below.`}
        </p>
        {rate > 0 ? (
          <p className="text-primary mt-2 text-[12.5px] font-bold">
            Unlocks {rate}% off
          </p>
        ) : null}
      </div>

      {rejected ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-center text-[12px] font-semibold">
          That one wasn&apos;t accepted — your base rate still holds. You can
          try again.
        </p>
      ) : null}

      <button
        type="button"
        onClick={openTarget}
        disabled={phase === "confirming"}
        className="bg-pink-gradient shadow-glow flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
      >
        {phase === "opening" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ExternalLink className="size-4" />
        )}
        {isReview ? "Open Google" : "Open Instagram"}
      </button>

      <button
        type="button"
        onClick={() => void confirm()}
        disabled={phase === "confirming" || phase === "opening"}
        className={cn(
          "border-border bg-card text-foreground flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border text-[14px] font-bold transition active:scale-[0.99] disabled:opacity-50",
        )}
      >
        {phase === "confirming" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : phase === "success" ? (
          <Check className="size-4 text-emerald-600" strokeWidth={3} />
        ) : null}
        {phase === "confirming"
          ? "Confirming…"
          : phase === "success"
            ? "Done — opening your QR"
            : "I posted it"}
      </button>

      {error ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-[12px]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSkip}
        className="text-muted-foreground hover:text-foreground mx-auto flex min-h-11 items-center text-[12.5px] font-semibold transition"
      >
        I&apos;ll finish this in a bit — show my QR
      </button>
    </div>
  );
}
