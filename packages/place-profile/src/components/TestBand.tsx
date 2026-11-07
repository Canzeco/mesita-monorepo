"use client";

import { FlaskConical } from "lucide-react";

import { cn } from "../lib/format";

// THE ONE BAND EVERY MONEY SURFACE WEARS WHILE STRIPE IS IN TEST MODE
// (MESITA-3303): the Wallet, the place screen's Vouchers tab and Business ›
// Payments. It says the one thing a guest or an owner must know, that no
// real money moves, and a surface can add its own line after it (the fee,
// the test card). It disappears the day Pato flips the key; nothing else
// changes. Contract tests in each app pin that the surface renders it.

export const TEST_BAND_TEXT = "TEST: no real money moves";

export function TestBand({ detail, className }: { detail?: string; className?: string }) {
  return (
    <div
      role="status"
      data-test-band
      className={cn(
        "border-border bg-muted text-foreground flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-snug",
        className,
      )}
    >
      <FlaskConical className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      <p className="min-w-0">
        <span className="font-semibold">{TEST_BAND_TEXT}</span>
        {detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
      </p>
    </div>
  );
}
