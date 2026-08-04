"use client";

// v3c (MESITA-851) — the guest's route when a visit went wrong.
//
// The tone here is doing real work. v3a moved the tasks off the floor on the
// premise that the guest's word is good; this sheet is the same premise
// pointed the other way, so it must not read like a complaint form that
// accuses a place. It asks what happened, says plainly that a human reads it,
// and never promises an outcome — a report is evidence, not a verdict, and
// the EF deliberately records no strike.

import { useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { REPORT_REASONS, type ReportReason } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

// Second-person copy — the operator-facing labels live in the EF's shared
// module and read differently on purpose.
const REASON_COPY: Record<ReportReason, { title: string; body: string }> = {
  discount_refused: {
    title: "They wouldn't apply my discount",
    body: "You showed the pass and the place said no.",
  },
  closed_without_honoring: {
    title: "The ticket closed but I got nothing",
    body: "Marked done on their side, no discount on yours.",
  },
  qr_not_scanned: {
    title: "They wouldn't scan my QR",
    body: "Staff refused or ignored the code.",
  },
  other: {
    title: "Something else",
    body: "Tell us in your own words.",
  },
};

export function ReportTicketSheet({
  open,
  placeName,
  busy,
  error,
  existingReason,
  onClose,
  onSubmit,
}: {
  open: boolean;
  placeName: string;
  busy: boolean;
  error: string | null;
  /** Set when the guest already filed — the sheet becomes an edit. */
  existingReason: ReportReason | null;
  onClose: () => void;
  onSubmit: (reason: ReportReason, detail: string) => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(existingReason);
  const [detail, setDetail] = useState("");

  return (
    <LocalSheet
      open={open}
      onClose={onClose}
      ariaLabel={`Report your visit to ${placeName}`}
    >
      <div className="flex flex-col gap-4 px-5 pt-4 pb-8">
        <header className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-600/10 text-red-700">
            <TriangleAlert className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-foreground text-[15px] leading-tight font-extrabold">
              {existingReason ? "Update your report" : "What went wrong?"}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
              A person at Mesita reads every one of these. {placeName} is not
              told who reported.
            </p>
          </div>
        </header>

        <ul className="flex flex-col gap-1.5">
          {REPORT_REASONS.map((key) => {
            const copy = REASON_COPY[key];
            const active = reason === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setReason(key)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full flex-col items-start rounded-xl border px-3.5 py-2.5 text-left transition",
                    active
                      ? "border-red-500/60 bg-red-500/8"
                      : "border-border bg-card hover:bg-muted/50",
                  )}
                >
                  <span className="text-foreground text-[13px] leading-tight font-bold">
                    {copy.title}
                  </span>
                  <span className="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">
                    {copy.body}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <label className="flex flex-col gap-1.5">
          <span className="text-foreground text-[12px] font-semibold">
            Anything else?{" "}
            <span className="text-muted-foreground font-normal">Optional</span>
          </span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What happened, in your words."
            className="border-border bg-card text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] outline-none"
          />
        </label>

        {error ? (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-[12px]">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!reason || busy}
          onClick={() => reason && onSubmit(reason, detail)}
          className="bg-foreground text-background flex min-h-12 items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold transition active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {existingReason ? "Update report" : "Send report"}
        </button>
        <p className="text-muted-foreground/80 text-center text-[11px] leading-snug">
          This doesn&apos;t penalise the place on its own — it goes to a person
          who looks into it.
        </p>
      </div>
    </LocalSheet>
  );
}
