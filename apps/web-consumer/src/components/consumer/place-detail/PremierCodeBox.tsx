"use client";

import { useState } from "react";
import { Ticket } from "lucide-react";
import { EFError } from "@/lib/api/_invoke";
import { shortDate } from "@/lib/api/boost";
import {
  apiRedeemPremierCode,
  CODE_REFUSED,
  rateLimitedLine,
} from "@/lib/api/premier-code";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { cn, errMsg } from "@/lib/utils";

// "HAVE A CODE?" (MESITA-3167): the Premier tab's code box. A Mesita code is
// 100%: it adds its Refill days (2X or 5X) to this place, nothing charged.
// The result is one line under the field (Design D5); on success the tab
// reloads its Premier so the level shows the new days.

const MARK: Record<number, string> = { 1: "2X", 2: "5X" };

/** "7KQ2ABCD" → "7KQ2-ABCD" as the guest types; the server takes either. */
function shape(raw: string): string {
  const s = raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 8);
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

export function PremierCodeBox({
  placeId,
  onRedeemed,
}: {
  placeId: string;
  onRedeemed: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<{ ok: boolean; text: string } | null>(null);

  async function redeem() {
    if (busy || code.replace("-", "").length !== 8) return;
    setBusy(true);
    setLine(null);
    try {
      const r = await apiRedeemPremierCode(getSupabase(), placeId, code);
      setLine({
        ok: true,
        text: `Added: ${MARK[r.tier] ?? "Premier"} until ${shortDate(r.ends_at)}`,
      });
      setCode("");
      onRedeemed();
    } catch (err) {
      const c = err instanceof EFError ? err.code : null;
      setLine({
        ok: false,
        text:
          c === "rate_limited"
            ? rateLimitedLine(
                err instanceof EFError ? err.body?.retry_after : null,
              )
            : (c && CODE_REFUSED[c]) ||
              errMsg(err, "Couldn't check the code. Try again."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-center gap-3">
        <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Ticket className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">Have a code?</span>
          <span className="text-muted-foreground block text-xs">
            A Mesita code gives this place free Premier days.
          </span>
        </span>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void redeem();
        }}
      >
        <label className="sr-only" htmlFor="premier-code">
          Code
        </label>
        <input
          id="premier-code"
          value={code}
          onChange={(e) => setCode(shape(e.target.value))}
          placeholder="XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          className="border-border bg-background h-12 min-w-0 flex-1 rounded-lg border px-3 font-mono text-base tracking-widest uppercase outline-none"
        />
        <button
          type="submit"
          disabled={busy || code.replace("-", "").length !== 8}
          className="bg-foreground text-paper h-12 shrink-0 rounded-lg px-5 text-sm font-semibold transition disabled:opacity-60"
        >
          {busy ? "Checking…" : "Redeem"}
        </button>
      </form>
      <p
        aria-live="polite"
        className={cn(
          "text-sm",
          !line && "sr-only",
          line && !line.ok && "text-destructive",
        )}
      >
        {line?.text ?? ""}
      </p>
    </div>
  );
}
