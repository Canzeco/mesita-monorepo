"use client";

// Step 2 of THE TICKET — "do tasks". One panel for both external rungs: open
// the target app, do the thing, come back and POST THE SCREENSHOT (MESITA-1030,
// Pato: "the screenshot is the way to validate — just post whatever screenshot
// and it's done"). The screenshot is the proof artifact: it uploads to the
// ticket-proofs bucket and rides the submit EF onto the ticket row. Nothing
// inspects it — the submission still self-attests (`self_verified`,
// MESITA-849) — but the confirm button requires one attached.
//
// This was two near-identical LocalSheets (GoogleReviewSheet /
// InstagramStorySheet) stacked on top of the ticket panel. A sheet over a
// stepped modal is a stack — the step IS the surface, so the body renders
// inline and the two copies collapsed into one component.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  UtensilsCrossed,
} from "lucide-react";

import { uploadTicketProof } from "@/lib/ticket-proofs";
import { useConsumerIdentity } from "@/lib/class-context";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  GoogleGlyph,
  InstagramGlyph,
} from "@/components/consumer/rewards/BrandGlyph";
import { cn, errMsg } from "@/lib/utils";

export type TaskKind = "review" | "story";

export function googleMapsSearchUrl(
  placeName: string,
  address?: string | null,
) {
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
  ticketId,
  placeName,
  placeAddress,
  rate,
  rejected = false,
  onConfirm,
  onDone,
  onSkip,
}: {
  kind: TaskKind;
  ticketId: string;
  placeName: string;
  placeAddress?: string | null;
  /** The rate this task unlocks — 0 hides the number rather than guess one. */
  rate: number;
  /** A proof that came back rejected: the base still holds, retry is allowed. */
  rejected?: boolean;
  /** Called with the uploaded screenshot's public URL. */
  onConfirm: (screenshotUrl: string) => Promise<void>;
  /** Fired after a confirmed proof — the caller advances to the QR. */
  onDone: () => void;
  /** "I'll do it later" — the QR is never gated on this, so leaving is free. */
  onSkip: () => void;
}) {
  const supabase = useBrowserSupabase();
  const { userId } = useConsumerIdentity();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const isReview = kind === "review";

  // The attached screenshot. Preview via object URL, revoked on replace.
  const [shot, setShot] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openTimer = useRef<number | null>(null);
  const confirmTimer = useRef<number | null>(null);
  const previewUrl = useMemo(
    () => (shot ? URL.createObjectURL(shot) : null),
    [shot],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);
  useEffect(
    () => () => {
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
      if (confirmTimer.current !== null)
        window.clearTimeout(confirmTimer.current);
    },
    [],
  );

  const openTarget = useCallback(() => {
    setPhase("opening");
    window.open(
      isReview
        ? googleMapsSearchUrl(placeName, placeAddress)
        : instagramOpenUrl(),
      "_blank",
      "noopener,noreferrer",
    );
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setPhase("idle"), 600);
  }, [isReview, placeName, placeAddress]);

  const confirm = useCallback(async () => {
    if (!shot) return;
    setPhase("confirming");
    setError(null);
    try {
      const url = await uploadTicketProof(
        supabase,
        userId,
        ticketId,
        isReview ? "review" : "story",
        shot,
      );
      await onConfirm(url);
      setPhase("success");
      if (confirmTimer.current !== null)
        window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(() => onDone(), 400);
    } catch (err) {
      setError(errMsg(err, "Couldn't confirm that just yet."));
      setPhase("error");
    }
  }, [shot, supabase, userId, ticketId, isReview, onConfirm, onDone]);

  return (
    <div className="flex flex-col gap-3">
      {/* Order first (D8): the task is something you do while the food comes,
          not a toll you pay at the door. */}
      <p className="rounded-xl bg-amber-500/12 px-3 py-2 text-center text-xs leading-snug font-bold text-amber-800">
        <UtensilsCrossed className="mr-1 inline size-3.5 align-[-2px]" />
        Order first — do this while your food comes.
      </p>

      <div className="surface-card rounded-2xl px-4 py-4 text-center">
        <span className="bg-muted/60 mx-auto grid size-11 place-items-center rounded-xl">
          {isReview ? (
            <GoogleGlyph className="size-6" />
          ) : (
            <InstagramGlyph className="size-6" />
          )}
        </span>
        <p className="text-foreground mt-2 text-sm font-extrabold tracking-tight">
          {isReview ? "Leave your Google review" : "Post your tagged story"}
        </p>
        <p className="text-muted-foreground mt-1 text-xs leading-snug">
          {isReview
            ? "Rate your visit on Google, screenshot it, post it here."
            : `Tag ${placeName} in your story, screenshot it, post it here.`}
        </p>
        {rate > 0 ? (
          <p className="text-foreground type-body mt-2 font-bold">
            Unlocks {rate}% off
          </p>
        ) : null}
      </div>

      {rejected ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-center text-xs font-semibold">
          That one wasn&apos;t accepted — your base rate still holds. You can
          try again.
        </p>
      ) : null}

      <button
        type="button"
        onClick={openTarget}
        disabled={phase === "confirming"}
        className="bg-foreground text-background flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold transition active:scale-[0.99] disabled:opacity-50"
      >
        {phase === "opening" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ExternalLink className="size-4" />
        )}
        {isReview ? "Open Google" : "Open Instagram"}
      </button>

      {/* The proof slot — the screenshot IS the confirmation. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) setShot(f);
          e.target.value = "";
        }}
      />
      {previewUrl ? (
        <div className="border-border bg-card relative overflow-hidden rounded-2xl border">
          {/* Plain <img>: a blob object URL — next/image adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Your screenshot"
            className="mx-auto max-h-44 w-auto object-contain py-2"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={phase === "confirming"}
            className="text-foreground shadow-rest type-label absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 font-bold transition active:scale-95"
          >
            <RefreshCw className="size-3" />
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="border-primary/35 bg-primary/[0.04] text-primary type-body flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed font-bold transition active:scale-[0.99]"
        >
          <Camera className="size-4" />
          Add your screenshot
        </button>
      )}

      <button
        type="button"
        onClick={() => void confirm()}
        disabled={!shot || phase === "confirming" || phase === "opening"}
        className={cn(
          "border-border bg-card text-foreground flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition active:scale-[0.99] disabled:opacity-50",
        )}
      >
        {phase === "confirming" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : phase === "success" ? (
          <Check className="size-4 text-emerald-600" strokeWidth={3} />
        ) : null}
        {phase === "confirming"
          ? "Sending your proof…"
          : phase === "success"
            ? "Done — opening your QR"
            : shot
              ? "Post it — I'm done"
              : "Add the screenshot to finish"}
      </button>

      {error ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSkip}
        className="text-muted-foreground hover:text-foreground type-body mx-auto flex min-h-11 items-center font-semibold transition"
      >
        I&apos;ll finish this in a bit — show my QR
      </button>
    </div>
  );
}
