"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/shared";
import { apiCreateVisitCode, readBill, visitLink, type VisitCode } from "@/lib/api/rewards";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// The guest's turn at the end of a visit (Pato, MESITA-3245: "guest enters bill,
// then busienss just correct if wrong"). The bill first, then a QR that carries it
// to visit.mesita.ai (MESITA-3240). The code lasts ten minutes and one use, and a
// new one replaces it when it ends, so what's on screen always works.

/** h-56 and w-56, the QR's bone and its slot. */
const QR_SIZE = 224;

function endsAt(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function billText(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function VisitQr({ placeId }: { placeId: string }) {
  const supabase = useBrowserSupabase();
  const [typed, setTyped] = useState("");
  const [billCents, setBillCents] = useState<number | null>(null);
  const [code, setCode] = useState<VisitCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (billCents === null) return;
    let live = true;
    apiCreateVisitCode(supabase, placeId, billCents).then(
      (next) => {
        if (!live) return;
        setCode(next);
        setError(null);
      },
      (err) => {
        if (!live) return;
        setCode(null);
        setError(errMsg(err, "Couldn't make a code. Try again."));
      },
    );
    return () => {
      live = false;
    };
  }, [supabase, placeId, billCents, attempt]);

  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(
      () => setAttempt((n) => n + 1),
      Math.max(0, new Date(code.expires_at).getTime() - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [code]);

  if (billCents === null) {
    const parsed = readBill(typed);
    return (
      <form
        className="w-full text-left"
        onSubmit={(event) => {
          event.preventDefault();
          if (parsed !== null) setBillCents(parsed);
        }}
      >
        <label className="block text-sm font-medium">
          Your bill
          <input
            inputMode="decimal"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className={cn(INPUT_CLASS, "mt-1")}
          />
        </label>
        <button type="submit" disabled={parsed === null} className={cn(PRIMARY_BUTTON_CLASS, "mt-3 h-11 w-full")}>
          Show my QR
        </button>
      </form>
    );
  }

  return (
    <div className="flex w-full flex-col items-center text-center">
      <div className="flex min-h-56 items-center justify-center">
        {code ? (
          <QRCodeSVG value={visitLink(placeId, code.code)} size={QR_SIZE} level="M" marginSize={2} bgColor="#ffffff" fgColor="#000000" />
        ) : error ? (
          <div>
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}
              className="text-muted-foreground mt-1 min-h-11 text-sm underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <Skeleton className="h-56 w-56 rounded-xl" />
        )}
      </div>
      {code ? (
        <div aria-live="polite">
          <p className="mt-4 font-semibold tabular-nums">Your bill: {billText(billCents)}</p>
          <p className="text-muted-foreground mt-1 text-sm">Show this to staff. It works until {endsAt(code.expires_at)}.</p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setBillCents(null);
          setCode(null);
          setError(null);
        }}
        className="text-muted-foreground mt-1 min-h-11 text-sm underline"
      >
        Change the bill
      </button>
    </div>
  );
}
