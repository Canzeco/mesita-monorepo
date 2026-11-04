"use client";

// New visit and the log (MESITA-3202). Staff type the guest's code, the bill
// and how it was paid, and pick a reward the guest qualifies for. The "guest
// pays" line is a preview for the person at the till: the server computes the
// discount again and its number is the one stored and shown afterwards.

import { useState } from "react";
import { Card } from "@/components/shell/Page";
import { INPUT_BASE } from "@/components/ui/manage";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import {
  checkVisitCode,
  createPlaceVisit,
  listPlaceVisits,
  voidPlaceVisit,
  type PaymentMethod,
  type PlaceVisit,
  type PlaceVisits,
  type RewardKind,
  type VisitGuest,
} from "@/lib/business-api";
import { money, PAYMENT_LABEL, REWARD_COPY, REWARD_REASON } from "@/lib/rewards";
import { cn } from "@/lib/utils";

const ROW = "flex min-h-14 items-center gap-3 px-5 py-3 text-sm sm:px-6";
const QUIET =
  "border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40";
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

function NewVisit({ placeId, onLogged }: { placeId: string; onLogged: (visit: PlaceVisit) => void }) {
  const [code, setCode] = useState("");
  const [found, setFound] = useState<VisitGuest | null>(null);
  const [bill, setBill] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reward, setReward] = useState<RewardKind | null>(null);
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const billCents = readBill(bill);
  const offer = found?.rewards.find((r) => r.kind === reward && r.eligible) ?? null;
  const preview = billCents
    ? Math.min(offer ? Math.floor((billCents * offer.percent + 50) / 100) : 0, offer?.cap_cents ?? billCents)
    : 0;

  function reset() {
    setCode("");
    setFound(null);
    setBill("");
    setMethod("cash");
    setReward(null);
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
    setReward(null);
    // One tap, one visit: a retry of this form sends the same id.
    setRequestId(crypto.randomUUID());
  }

  async function log() {
    if (!billCents || !found) return;
    setBusy(true);
    setError(null);
    const r = await createPlaceVisit(placeId, { code: code.trim(), billCents, method, rewardKind: reward, requestId });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      if (r.code === "bad_code") reset();
      return;
    }
    const name = found.guest.name ?? "The guest";
    setDone(`Logged. ${name} pays ${money(r.data.total_cents, r.data.currency)}.`);
    onLogged({ ...r.data, guest_name: found.guest.name, member_number: found.guest.member_number });
    reset();
  }

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
                aria-label="Bill"
                className={cn(FIELD, "min-w-0 flex-1 tabular-nums")}
              />
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
                    className={cn(QUIET, method === m && "bg-foreground text-background hover:bg-foreground")}
                  >
                    {PAYMENT_LABEL[m]}
                  </button>
                ))}
              </div>
            </li>
            <li className={cn(ROW, "items-start")}>
              <span className="text-muted-foreground w-20 shrink-0 pt-2">Reward</span>
              <div className="flex min-w-0 flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={reward === null}
                  onClick={() => setReward(null)}
                  className={cn(QUIET, reward === null && "bg-foreground text-background hover:bg-foreground")}
                >
                  None
                </button>
                {found.rewards.map((r) => (
                  <button
                    key={r.kind}
                    type="button"
                    disabled={!r.eligible}
                    aria-pressed={reward === r.kind}
                    title={r.reason ? REWARD_REASON[r.reason] : undefined}
                    onClick={() => setReward(r.kind)}
                    className={cn(QUIET, reward === r.kind && "bg-foreground text-background hover:bg-foreground")}
                  >
                    {REWARD_COPY[r.kind].name} · {r.percent}%
                  </button>
                ))}
              </div>
            </li>
            {reward === "instagram_story" ? (
              <li className={cn(ROW, "text-muted-foreground")}>Check the story on the guest&apos;s phone before you log this.</li>
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
      {done ? <p className="text-muted-foreground px-5 pb-4 text-sm sm:px-6">{done}</p> : null}
    </Card>
  );
}

function when(iso: string, timezone: string | null): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  try {
    return d.toLocaleString("en-US", { ...opts, ...(timezone ? { timeZone: timezone } : {}) });
  } catch {
    return d.toLocaleString("en-US", opts);
  }
}

function VisitRow({
  visit,
  timezone,
  canVoid,
  busy,
  onVoid,
}: {
  visit: PlaceVisit;
  timezone: string | null;
  canVoid: boolean;
  busy: boolean;
  onVoid: () => void;
}) {
  const voided = !!visit.voided_at;
  const reward = visit.reward_kind ? `${REWARD_COPY[visit.reward_kind].name} −${money(visit.discount_cents, visit.currency)}` : null;
  const facts = [
    `Paid ${money(visit.total_cents, visit.currency)}`,
    PAYMENT_LABEL[visit.payment_method],
    reward,
    when(visit.created_at, timezone),
  ].filter(Boolean);
  return (
    <li className={cn(ROW, voided && "opacity-50")}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {visit.guest_name ?? "Guest"}
          {voided ? <span className="text-muted-foreground font-normal"> · Voided</span> : null}
        </p>
        <p className="text-muted-foreground">{facts.join(" · ")}</p>
      </div>
      {canVoid && !voided ? (
        <button type="button" className={QUIET} disabled={busy} onClick={onVoid}>
          Void
        </button>
      ) : null}
    </li>
  );
}

export function VisitsPanel({ placeId, initial }: { placeId: string; initial: PlaceVisits }) {
  const [visits, setVisits] = useState<PlaceVisit[]>(initial.visits);
  const [next, setNext] = useState<string | null>(initial.next);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    if (!next) return;
    setBusy(true);
    setError(null);
    const r = await listPlaceVisits(placeId, next);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setVisits((v) => [...v, ...r.data.visits]);
    setNext(r.data.next);
  }

  async function voidOne(visit: PlaceVisit) {
    if (!window.confirm(`Void ${visit.guest_name ?? "this guest"}'s visit? It stays in the list, marked Voided.`)) return;
    setBusy(true);
    setError(null);
    const r = await voidPlaceVisit(placeId, visit.id);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setVisits((all) => all.map((v) => (v.id === visit.id ? { ...v, voided_at: r.data.voided_at } : v)));
  }

  return (
    <>
      <NewVisit placeId={placeId} onLogged={(visit) => setVisits((all) => [visit, ...all.filter((v) => v.id !== visit.id)])} />
      <Card className="flex flex-col p-0 sm:p-0">
        <ul className="divide-border divide-y">
          {visits.length === 0 ? <li className={cn(ROW, "text-muted-foreground")}>No visits yet.</li> : null}
          {visits.map((v) => (
            <VisitRow
              key={v.id}
              visit={v}
              timezone={initial.timezone}
              canVoid={initial.can_void}
              busy={busy}
              onVoid={() => void voidOne(v)}
            />
          ))}
          {next ? (
            <li className={ROW}>
              <button type="button" className={QUIET} disabled={busy} onClick={() => void more()}>
                {busy ? "Loading…" : "Show more"}
              </button>
            </li>
          ) : null}
        </ul>
        {error ? <p className={cn(ERROR_BOX_CLASS, "mx-5 mb-4 sm:mx-6")}>{error}</p> : null}
      </Card>
    </>
  );
}
