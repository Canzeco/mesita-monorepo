"use client";

// New visit (MESITA-3202), on Rewards for the moment (Pato, MESITA-3210: "move the
// 6 digits code to Rewards ... then we move it again to visits"). Staff type the
// guest's code, the bill and how it was paid, and tick the rewards. Welcome,
// Returning and VIP start ticked when the guest qualifies; Story starts off
// because staff must see it first. They add up (MESITA-3210).
//
// The "guest pays" line is a preview for the person at the till: the server
// computes the discount again, and its number is the one stored and shown after.

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/shell/Page";
import { INPUT_BASE } from "@/components/ui/manage";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { checkVisitCode, createPlaceVisit, type PaymentMethod, type RewardKind, type VisitGuest } from "@/lib/business-api";
import { money, PAYMENT_LABEL, REWARD_COPY, REWARD_REASON } from "@/lib/rewards";
import { placeTabHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ROW = "flex min-h-14 items-center gap-3 px-5 py-3 text-sm sm:px-6";
const QUIET =
  "border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40";
const ON = "bg-foreground text-background hover:bg-foreground";
const PRIMARY =
  "bg-foreground text-background h-10 shrink-0 rounded-full px-5 text-sm font-semibold transition-opacity disabled:opacity-40";
const FIELD = cn(INPUT_BASE, "h-10 px-3");
const METHODS: PaymentMethod[] = ["cash", "card", "transfer", "other"];

/** "1,234.50" as whole cents, or null. On the digits, so no float touches it. */
function readBill(text: string): number | null {
  const clean = text.replace(/[,\s]/g, "");
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(clean);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

function memberLine(number: string | null): string | null {
  if (!number) return null;
  return `Member ${number.replace(/^(\d{4})(\d{4})$/, "$1-$2")}`;
}

export function NewVisit({ placeId }: { placeId: string }) {
  const [code, setCode] = useState("");
  const [found, setFound] = useState<VisitGuest | null>(null);
  const [bill, setBill] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [picked, setPicked] = useState<RewardKind[]>([]);
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const billCents = readBill(bill);
  const offers = (found?.rewards ?? []).filter((r) => r.eligible && picked.includes(r.kind));
  const percent = offers.reduce((sum, r) => sum + r.percent, 0);
  const cap = offers[0]?.cap_cents ?? null;
  const preview = billCents ? Math.min(Math.floor((billCents * percent + 50) / 100), cap ?? billCents) : 0;

  function reset() {
    setCode("");
    setFound(null);
    setBill("");
    setMethod("cash");
    setPicked([]);
  }

  function toggle(kind: RewardKind) {
    setPicked((now) => (now.includes(kind) ? now.filter((k) => k !== kind) : [...now, kind]));
  }

  async function check() {
    setBusy(true);
    setError(null);
    setDone(null);
    const r = await checkVisitCode(placeId, code.trim());
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setFound(r.data);
    setPicked(r.data.rewards.filter((o) => o.eligible && o.kind !== "instagram_story").map((o) => o.kind));
    // One tap, one visit: a retry of this form sends the same id.
    setRequestId(crypto.randomUUID());
  }

  async function log() {
    if (!billCents || !found) return;
    setBusy(true);
    setError(null);
    const r = await createPlaceVisit(placeId, { code: code.trim(), billCents, method, rewardKinds: picked, requestId });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      if (r.code === "bad_code") reset();
      return;
    }
    setDone(`${found.guest.name ?? "The guest"} pays ${money(r.data.total_cents, r.data.currency)}.`);
    reset();
  }

  // A disabled button's title never shows on a phone at the till.
  const storyOff = found?.rewards.find((r) => r.kind === "instagram_story" && !r.eligible);

  return (
    <Card className="flex flex-col p-0 sm:p-0">
      <h2 className="px-5 pt-4 pb-2 font-semibold sm:px-6">New visit</h2>
      <ul className="divide-border divide-y">
        {!found ? (
          <li className={ROW}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === 6 && !busy) void check();
              }}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Guest's 6-digit code"
              aria-label="Guest's code"
              className={cn(FIELD, "min-w-0 flex-1 tabular-nums")}
            />
            <button type="button" className={QUIET} disabled={code.length !== 6 || busy} onClick={() => void check()}>
              {busy ? "Checking…" : "Check"}
            </button>
          </li>
        ) : (
          <>
            <li className={ROW}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{found.guest.name ?? "Guest"}</p>
                <p className="text-muted-foreground">{memberLine(found.guest.member_number)}</p>
              </div>
              <button type="button" className={QUIET} disabled={busy} onClick={reset}>
                Change
              </button>
            </li>
            <li className={ROW}>
              <span className="text-muted-foreground w-20 shrink-0">Bill</span>
              <input
                value={bill}
                onChange={(e) => setBill(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                aria-label="Bill in Mexican pesos"
                className={cn(FIELD, "min-w-0 flex-1 tabular-nums")}
              />
              <span className="text-muted-foreground shrink-0">MXN</span>
            </li>
            <li className={ROW}>
              <span className="text-muted-foreground w-20 shrink-0">Paid with</span>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={method === m}
                    onClick={() => setMethod(m)}
                    className={cn(QUIET, method === m && ON)}
                  >
                    {PAYMENT_LABEL[m]}
                  </button>
                ))}
              </div>
            </li>
            <li className={cn(ROW, "items-start")}>
              <span className="text-muted-foreground w-20 shrink-0 pt-2">Rewards</span>
              {found.rewards.length === 0 ? (
                <span className="text-muted-foreground pt-2">None are on.</span>
              ) : (
                <div className="flex min-w-0 flex-wrap gap-2">
                  {found.rewards.map((r) => (
                    <button
                      key={r.kind}
                      type="button"
                      disabled={!r.eligible}
                      aria-pressed={picked.includes(r.kind)}
                      title={r.reason ? REWARD_REASON[r.reason] : undefined}
                      onClick={() => toggle(r.kind)}
                      className={cn(QUIET, picked.includes(r.kind) && ON)}
                    >
                      {REWARD_COPY[r.kind].name} · {r.percent}%
                    </button>
                  ))}
                </div>
              )}
            </li>
            {storyOff?.reason ? (
              <li className={cn(ROW, "text-muted-foreground")}>Instagram Story: {REWARD_REASON[storyOff.reason]}.</li>
            ) : null}
            {picked.includes("instagram_story") ? (
              <li className={cn(ROW, "text-muted-foreground")}>
                Check on the guest&apos;s phone: the story and a public profile.
              </li>
            ) : null}
            <li className={ROW}>
              <p className="min-w-0 flex-1 font-medium">
                {billCents ? `Guest pays ${money(billCents - preview, "MXN")}` : "Enter the bill"}
                {preview > 0 ? <span className="text-muted-foreground font-normal"> · {money(preview, "MXN")} off</span> : null}
              </p>
              <button type="button" className={PRIMARY} disabled={!billCents || busy} onClick={() => void log()}>
                {busy ? "Logging…" : "Log visit"}
              </button>
            </li>
          </>
        )}
      </ul>
      {error ? <p className={cn(ERROR_BOX_CLASS, "mx-5 mb-4 sm:mx-6")}>{error}</p> : null}
      {done ? (
        <p className="text-muted-foreground px-5 pb-4 text-sm sm:px-6">
          Logged. {done}{" "}
          <Link href={placeTabHref(placeId, "visits")} className="underline">
            See it in Visits
          </Link>
        </p>
      ) : null}
    </Card>
  );
}
