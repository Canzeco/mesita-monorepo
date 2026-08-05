"use client";

import { useCallback, useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { cn } from "@/lib/utils";

export type ProofSheetPhase =
  | "idle"
  | "opening"
  | "confirming"
  | "success"
  | "error";

export function googleMapsSearchUrl(placeName: string, address?: string | null) {
  const q = [placeName, address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q || "restaurant",
  )}`;
}

function GoogleReviewSheetBody({
  placeName,
  mapsUrl,
  onConfirm,
  onClose,
}: {
  placeName: string;
  mapsUrl: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<ProofSheetPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const openGoogle = useCallback(() => {
    setPhase("opening");
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => setPhase("idle"), 600);
  }, [mapsUrl]);

  const confirm = useCallback(async () => {
    setPhase("confirming");
    setError(null);
    try {
      await onConfirm();
      setPhase("success");
      window.setTimeout(() => onClose(), 400);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't confirm that just yet.",
      );
      setPhase("error");
    }
  }, [onConfirm, onClose]);

  return (
    <div className="flex flex-col gap-3 px-5 pt-4 pb-8">
      <div>
        <p className="text-foreground text-[15px] font-extrabold tracking-tight">
          Leave a Google review
        </p>
        <p className="text-muted-foreground mt-0.5 text-[12px]">{placeName}</p>
        <p className="text-muted-foreground mt-2.5 text-[12.5px] leading-snug">
          Post your review on Google, then confirm here so we can unlock the
          reward.
        </p>
      </div>

      <button
        type="button"
        onClick={openGoogle}
        disabled={phase === "confirming"}
        className="bg-pink-gradient shadow-glow flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
      >
        {phase === "opening" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ExternalLink className="size-4" />
        )}
        Open Google
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
            ? "Confirmed"
            : "I’ve posted it"}
      </button>

      {phase === "success" ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-[12px] font-semibold text-emerald-700">
          Got it — updating your tasks
        </p>
      ) : null}

      {error ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-[12px]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function GoogleReviewSheet({
  open,
  onClose,
  placeName,
  mapsUrl,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  placeName: string;
  mapsUrl: string;
  onConfirm: () => Promise<void>;
}) {
  return (
    <LocalSheet
      open={open}
      onClose={onClose}
      ariaLabel={`Leave a Google review for ${placeName}`}
    >
      {open ? (
        <GoogleReviewSheetBody
          placeName={placeName}
          mapsUrl={mapsUrl}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      ) : null}
    </LocalSheet>
  );
}
