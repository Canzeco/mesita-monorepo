"use client";

// "Have a code?" on Billing (MESITA-3167; Design D1 last row, D4 open in the
// empty state, D5 result lines, D10 accessibility). A Mesita code is 100%:
// it adds its Refill days (2X or 5X) to this place, nothing charged. Owner
// and editor both redeem (business-web-redeem-premier-code). The line sits
// under the field; on success the page refreshes so the rows show the days.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { redeemPremierCode } from "@/lib/business-api";

const FACTOR: Record<number, string> = { 1: "2X", 2: "5X" };

/** "7KQ2ABCD" → "7KQ2-ABCD" as it is typed; the server takes either. */
function shape(raw: string): string {
  const s = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 8);
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

export function CodeRow({
  placeId,
  you,
  day,
  time,
  bare = false,
}: {
  placeId: string;
  /** The caller pays the place's subscription ("Your 2X subscription…"). */
  you: boolean;
  /** A date in the place's time zone ("Dec 3"). */
  day: (iso: string | null | undefined) => string;
  /** A clock time in the place's time zone ("4:05 PM"). */
  time: (iso: string) => string;
  /** One line under the plans, no card (MESITA-3177). */
  bare?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<{ ok: boolean; text: string[] } | null>(null);
  const whose = you ? "Your" : "The place's";

  async function redeem() {
    if (busy || code.replace("-", "").length !== 8) return;
    setBusy(true);
    setLines(null);
    const r = await redeemPremierCode(placeId, code);
    setBusy(false);
    if (r.ok) {
      const { tier, ends_at, paused } = r.data;
      setLines({
        ok: true,
        text: [
          `Added: ${FACTOR[tier]} until ${day(ends_at)}`,
          ...(paused
            ? [`${whose} ${FACTOR[paused.tier]} subscription pauses until ${day(paused.until)}. Nothing is charged until then.`]
            : []),
        ],
      });
      setCode("");
      router.refresh();
      return;
    }
    const refused: Record<string, string> = {
      code_unknown: "That code doesn't exist.",
      code_expired: "That code has expired.",
      code_exhausted: "That code has been used up.",
      code_used_here: "This code was already used on this place.",
      paid_higher: `${whose} 5X subscription already ranks this place higher. The code was not used.`,
      rate_limited: Number.isFinite(Date.parse(r.error)) ? `Too many tries. Try again at ${time(r.error)}.` : "Too many tries. Try again later.",
      cap_reached: "This place already has a year of days queued.",
    };
    setLines({ ok: false, text: [(r.code && refused[r.code]) || r.error] });
  }

  return (
    <div className={bare ? "flex flex-col gap-2 px-1" : "flex flex-col gap-2 px-5 py-3"}>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void redeem();
        }}
      >
        <label htmlFor="billing-code" className={bare ? "text-muted-foreground text-sm" : "font-medium sm:flex-1"}>
          Have a code?
        </label>
        <div className="flex gap-2">
          <span className="sr-only">Code</span>
          <input
            id="billing-code"
            value={code}
            onChange={(e) => setCode(shape(e.target.value))}
            placeholder="XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="border-border bg-background h-9 w-full min-w-0 rounded-full border px-4 font-mono text-sm tracking-widest uppercase sm:w-36"
          />
          <button
            type="submit"
            disabled={busy || code.replace("-", "").length !== 8}
            className="border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Checking…" : "Redeem"}
          </button>
        </div>
      </form>
      <div aria-live="polite" className={`empty:hidden ${lines && !lines.ok ? "text-destructive text-sm" : "text-sm"}`}>
        {lines?.text.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </div>
    </div>
  );
}
