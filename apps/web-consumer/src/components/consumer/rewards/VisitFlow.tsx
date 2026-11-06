"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { SizedImg } from "@mesita/place-profile";
import { Skeleton } from "@/components/shared";
import {
  apiConfirmBill,
  apiCreateVisitCode,
  apiGetPlaceRewards,
  apiGetVisit,
  apiGetVisitResult,
  apiSkipTask,
  visitLink,
  type OpenVisit,
  type PlaceReward,
  type PlaceRewards,
  type VisitCode,
  type VisitResult,
} from "@/lib/api/rewards";
import { rewardStepPath, type RewardStep } from "@/lib/consumer-route-contract";
import { useServerProfile } from "@/lib/identity-context";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import { GuestPassport } from "./GuestPassport";
import { capLine, REWARD_LINE, REWARD_NAME } from "./RewardList";
import type { RewardPlaceHeader } from "./reward-place-seed";

// USING A REWARD IS A SHARED VISIT (Pato, MESITA-3270: "Billtip, Reward, Task, Pay, who
// confirms"; chose the shared visit). Full screen, each step an address under /pay
// (MESITA-3254). The QR opens one visit on both phones, and this sheet follows it by
// asking the server every few seconds. Whoever knows the fact confirms it:
//
//   qr      The guest shows it. Staff scan, and the visit is open.
//   bill    Staff type the bill from the ticket. The guest confirms it.
//   reward  What applies and what they pay. The server's numbers, a screen with no stamp.
//   task    Only if a Story is on offer. The guest shows it and staff say they saw it,
//           or the guest skips it. Nothing in the app can see the post.
//   pay     The one number. The guest pays at the till, staff tap Received, it closes.
//
// No money moves through Mesita and a tip is only words until Stripe: the reward comes
// off the bill, never the tip. Everything but the QR's secret lives on the server, so a
// reload lands on the same step. An unopened QR lasts ten minutes and is replaced when it
// ends. Starting over replaces the open visit, so a table staff walked away from never
// holds the guest for its hour.

const STEP_TITLE = "text-lg font-semibold tracking-tight";

const STORY = "instagram_story";

/** How often the sheet follows staff. */
const POLL_MS = 3000;

function billText(cents: number, currency = "MXN"): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
}

/** The rail: a bar over a word. A step the guest has reached is a tap away. The QR sits
 *  before it, and Task shows only when a Story is on offer. */
function StepRail({ visit, step, onGo }: { visit: OpenVisit | null | undefined; step: RewardStep; onGo: (id: RewardStep) => void }) {
  const opened = Boolean(visit?.opened_at);
  const confirmed = Boolean(visit?.bill_confirmed_at);
  const steps: { id: RewardStep; label: string; reached: boolean }[] = [
    { id: "bill", label: "Bill", reached: opened },
    { id: "reward", label: "Reward", reached: confirmed },
    ...(visit?.story_offered ? [{ id: "task" as const, label: "Task", reached: confirmed }] : []),
    { id: "pay", label: "Pay", reached: visit?.step === "pay" },
  ];
  const at = steps.findIndex((s) => s.id === step);
  return (
    <ol className="flex gap-1.5" aria-label="Steps">
      {steps.map((s, i) => {
        const body = (
          <>
            <span aria-hidden className={cn("h-[3px] w-full rounded-full", i <= at ? "bg-foreground" : "bg-border")} />
            <span className={cn("text-xs", i === at ? "font-semibold" : i < at ? "font-medium" : "text-muted-foreground font-medium")}>{s.label}</span>
          </>
        );
        const shell = "flex min-h-11 w-full flex-col items-start justify-center gap-1.5 text-left";
        return (
          <li key={s.id} className="min-w-0 flex-1">
            {i !== at && s.reached ? (
              <button type="button" onClick={() => onGo(s.id)} className={shell}>
                {body}
              </button>
            ) : (
              <div className={shell} aria-current={i === at ? "step" : undefined}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The amounts, like a receipt (Pato, MESITA-3254: "clear billing, like what is the
 *  amount"). */
function Receipt({ billCents, offCents, payCents, currency }: { billCents: number; offCents: number; payCents: number; currency?: string }) {
  const row = "flex items-center justify-between gap-4 px-4 py-3 tabular-nums";
  return (
    <dl className="border-border bg-card divide-border w-full divide-y rounded-2xl border text-left text-sm">
      <div className={row}>
        <dt className="text-muted-foreground">Your bill</dt>
        <dd className="font-medium">{billText(billCents, currency)}</dd>
      </div>
      <div className={row}>
        <dt className="text-muted-foreground">Your reward</dt>
        <dd className="text-fact-reward font-semibold">−{billText(offCents, currency)}</dd>
      </div>
      <div className={row}>
        <dt className="font-semibold">You pay</dt>
        <dd className="text-base font-semibold">{billText(payCents, currency)}</dd>
      </div>
    </dl>
  );
}

/** What applies to this guest here, so they can post a Story in time (MESITA-3259:
 *  "only mention the current reward you apply"). */
function RewardRows({ rewards }: { rewards: PlaceReward[] }) {
  return (
    <ul className="divide-border border-border bg-card w-full divide-y rounded-2xl border text-left">
      {rewards.map((r) => (
        <li key={r.kind} className="flex items-start gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{REWARD_NAME[r.kind]}</span>
            <span className="text-muted-foreground block text-sm">
              {r.kind === STORY ? "Post a story about this place and show it to staff. Your profile must be public." : REWARD_LINE[r.kind]}
            </span>
          </span>
          <span className="text-fact-reward shrink-0 text-sm font-semibold tabular-nums">{r.percent}% OFF</span>
        </li>
      ))}
    </ul>
  );
}

function StartOver({ onStartOver }: { onStartOver: () => void }) {
  return (
    <button type="button" onClick={onStartOver} className="text-muted-foreground mt-3 min-h-11 text-sm underline">
      Start over with a new QR
    </button>
  );
}

export function VisitFlow({
  placeId,
  place,
  step,
  onClose,
}: {
  placeId: string;
  place: RewardPlaceHeader | null;
  step: RewardStep;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const memberNumber = useServerProfile()?.code;
  // undefined until the server has answered; null means no open visit.
  const [visit, setVisit] = useState<OpenVisit | null | undefined>(undefined);
  const [result, setResult] = useState<VisitResult | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [offers, setOffers] = useState<PlaceRewards | null>(null);
  const [offersFailed, setOffersFailed] = useState(false);
  const [offersAttempt, setOffersAttempt] = useState(0);
  const [code, setCode] = useState<VisitCode | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeAttempt, setCodeAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // A visit closed since this moment is this one. A replaced QR does not move it.
  const since = useRef<string | null>(null);

  const go = (id: RewardStep) => {
    setActionError(null);
    router.push(rewardStepPath(placeId, id));
  };

  // Follow the visit. When it is gone, the close's result is read first and both land
  // together, so the sheet never takes a closed visit for an ended one.
  useEffect(() => {
    if (result) return;
    let live = true;
    const read = async () => {
      try {
        const next = await apiGetVisit(supabase, placeId);
        if (next?.opened_at && !since.current) since.current = next.opened_at;
        const closed = !next && since.current ? await apiGetVisitResult(supabase, placeId, since.current) : null;
        if (!live) return;
        if (closed) setResult(closed);
        setVisit(next);
        setReadFailed(false);
      } catch {
        // A missed read only waits for the next one, and says so.
        if (live) setReadFailed(true);
      }
    };
    void read();
    const timer = setInterval(() => void read(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [supabase, placeId, result]);

  useEffect(() => {
    let live = true;
    apiGetPlaceRewards(supabase, placeId).then(
      (next) => {
        if (live) setOffers(next);
      },
      () => {
        if (live) setOffersFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [supabase, placeId, offersAttempt]);

  // What the place really has on, and only what this guest can use.
  const offered = (offers?.rewards ?? []).filter((r) => r.eligible);
  const usable = offered.length > 0;
  const opened = Boolean(visit?.opened_at);
  const known = visit !== undefined;

  // The QR: made on arrival, replaced when it ends, never once staff opened the visit.
  useEffect(() => {
    if (step !== "qr" || !known || opened || !usable || result) return;
    if (code && new Date(code.expires_at).getTime() > Date.now()) return;
    let live = true;
    apiCreateVisitCode(supabase, placeId).then(
      (next) => {
        if (!live) return;
        setCode(next);
        setCodeError(null);
        since.current = since.current ?? next.issued_at;
      },
      (err) => {
        if (!live) return;
        setCode(null);
        setCodeError(errMsg(err, "Couldn't make a code. Try again."));
      },
    );
    return () => {
      live = false;
    };
  }, [supabase, placeId, step, known, opened, usable, result, code, codeAttempt]);

  useEffect(() => {
    if (!code || opened) return;
    const timer = setTimeout(() => setCodeAttempt((n) => n + 1), Math.max(0, new Date(code.expires_at).getTime() - Date.now()));
    return () => clearTimeout(timer);
  }, [code, opened]);

  // The address follows the visit. The server says how far it got; the guest can be
  // on any step up to there, and Reward is theirs to read for as long as they like.
  useEffect(() => {
    if (result) {
      if (step !== "pay") router.replace(rewardStepPath(placeId, "pay"));
      return;
    }
    if (visit === undefined) return;
    const target = ((): RewardStep | null => {
      if (!visit?.opened_at) return step === "qr" ? null : "qr";
      if (step === "qr") return "bill";
      if (!visit.bill_confirmed_at) return step === "bill" ? null : "bill";
      if (step === "task" && visit.step === "pay") return "pay";
      if (step === "task" && !visit.story_offered) return "pay";
      if (step === "pay" && visit.step === "task") return "task";
      return null;
    })();
    if (target) router.replace(rewardStepPath(placeId, target));
  }, [router, placeId, step, visit, result]);

  async function confirmBill(billCents: number) {
    setBusy(true);
    setActionError(null);
    try {
      setVisit(await apiConfirmBill(supabase, placeId, billCents));
      go("reward");
    } catch (err) {
      setActionError(errMsg(err, "Couldn't confirm it. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function skipTask() {
    setBusy(true);
    setActionError(null);
    try {
      setVisit(await apiSkipTask(supabase, placeId));
    } catch (err) {
      setActionError(errMsg(err, "Couldn't skip it. Try again."));
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setActionError(null);
    setCode(null);
    setCodeError(null);
    since.current = null;
    setVisit(null);
    router.replace(rewardStepPath(placeId, "qr"));
  }

  const quote = visit?.quote ?? null;
  const withStory = visit?.quote_with_story ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-4 pt-3">
        <span className="bg-muted ring-border block h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1">
          {place?.photo ? <SizedImg src={place.photo} size="thumb" alt="" className="h-full w-full object-cover" /> : null}
        </span>
        {place ? (
          <p className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{place.name}</p>
        ) : (
          <span className="min-w-0 flex-1">
            <Skeleton className="h-4 w-3/5" />
          </span>
        )}
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground -mr-2 flex h-11 w-11 shrink-0 items-center justify-center">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {step !== "qr" && !result ? (
        <div className="px-4 pt-2">
          <StepRail visit={visit} step={step} onGo={go} />
        </div>
      ) : null}

      {readFailed ? (
        <p role="status" className="text-muted-foreground px-4 pt-2 text-sm">
          Can&apos;t reach Mesita. Trying again…
        </p>
      ) : null}

      {step === "qr" ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <div className="flex flex-col items-center text-center">
              {offers && !usable ? (
                <p className="text-muted-foreground w-full p-4 text-sm">
                  {!offers.signed_in
                    ? "Sign in to use a reward."
                    : offers.rewards.length === 0
                      ? "This place has no rewards yet."
                      : "None of these apply to you right now."}
                </p>
              ) : offersFailed && !offers ? (
                <div className="w-full p-4">
                  <p className="font-semibold">Rewards didn&apos;t load.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setOffersFailed(false);
                      setOffersAttempt((n) => n + 1);
                    }}
                    className="text-muted-foreground mt-1 min-h-11 text-sm underline"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <GuestPassport />
                  <h2 className={cn(STEP_TITLE, "mt-4")}>Show this to staff</h2>
                  <div className="mt-4 flex min-h-60 items-center justify-center">
                    {code ? (
                      <QRCodeSVG value={visitLink(placeId, code.code)} size={240} level="M" marginSize={2} bgColor="#ffffff" fgColor="#000000" />
                    ) : codeError ? (
                      <div>
                        <p className="text-sm">{codeError}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setCodeError(null);
                            setCodeAttempt((n) => n + 1);
                          }}
                          className="text-muted-foreground mt-1 min-h-11 text-sm underline"
                        >
                          Try again
                        </button>
                      </div>
                    ) : (
                      <Skeleton className="h-60 w-60 rounded-xl" />
                    )}
                  </div>
                  {/* Staff type this at visit.mesita.ai when the QR won't scan (MESITA-3262). */}
                  {code && memberNumber ? (
                    <p className="text-muted-foreground mt-2 text-sm">
                      Won&apos;t scan? Member number <span className="text-foreground font-semibold">{memberNumber}</span>
                    </p>
                  ) : null}
                  {usable ? (
                    <div className="mt-4 w-full">
                      <RewardRows rewards={offered} />
                      <p className="text-muted-foreground mt-3 text-left text-sm">
                        The ones you qualify for add up, and the place takes them off today&apos;s bill.{capLine(offered[0]?.cap_cents)}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {code ? (
            <p className="border-border text-muted-foreground border-t p-4 text-center text-sm" aria-live="polite">
              Waiting for staff to scan…
            </p>
          ) : null}
        </>
      ) : null}

      {step === "bill" && !result ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <h2 className={STEP_TITLE}>Your bill</h2>
            {visit?.bill_cents != null ? (
              <>
                <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{billText(visit.bill_cents, visit.currency)}</p>
                <p className="text-muted-foreground mt-1 text-sm">Staff typed this from your ticket, before any discount or tip. Check it matches.</p>
              </>
            ) : (
              <p className="text-muted-foreground mt-4 text-sm" aria-live="polite">
                Staff are typing your bill…
              </p>
            )}
            {actionError ? (
              <p role="alert" className="mt-3 text-sm">
                {actionError}
              </p>
            ) : null}
            <StartOver onStartOver={startOver} />
          </div>
          {visit?.bill_cents != null ? (
            <div className="border-border border-t p-4">
              {visit.bill_confirmed_at ? (
                <button type="button" onClick={() => go("reward")} className={PRIMARY_BUTTON_CLASS}>
                  Next
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => void confirmBill(visit.bill_cents as number)} className={PRIMARY_BUTTON_CLASS}>
                  {busy ? "Confirming…" : "Confirm the bill"}
                </button>
              )}
              <p className="text-muted-foreground mt-2 text-center text-sm">Not right? Tell staff, and they&apos;ll change it.</p>
            </div>
          ) : null}
        </>
      ) : null}

      {step === "reward" && !result ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <h2 className={STEP_TITLE}>Your reward</h2>
            {visit?.bill_cents != null && quote ? (
              <div className="mt-4">
                <Receipt billCents={visit.bill_cents} offCents={quote.discount_cents} payCents={quote.total_cents} currency={visit.currency} />
              </div>
            ) : null}
            {visit?.rewards.length ? (
              <ul className="text-muted-foreground mt-3 text-sm">
                {visit.rewards.map((r) => (
                  <li key={r.kind}>
                    {REWARD_NAME[r.kind]}: {r.percent}% OFF
                  </li>
                ))}
              </ul>
            ) : null}
            {visit?.step === "task" && withStory ? (
              <p className="mt-3 text-sm">
                With an Instagram Story you pay <span className="font-semibold">{billText(withStory.total_cents, visit.currency)}</span>.
              </p>
            ) : null}
            <StartOver onStartOver={startOver} />
          </div>
          <div className="border-border border-t p-4">
            <button type="button" onClick={() => go(visit?.step === "task" ? "task" : "pay")} className={PRIMARY_BUTTON_CLASS}>
              Next
            </button>
          </div>
        </>
      ) : null}

      {step === "task" && !result ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <h2 className={STEP_TITLE}>Post your Instagram Story</h2>
            <p className="text-muted-foreground mt-1 text-sm">Post a story about this place and show it to staff. Your profile must be public.</p>
            {withStory && quote ? (
              <dl className="border-border bg-card divide-border mt-4 divide-y rounded-2xl border text-sm tabular-nums">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="font-semibold">With your Story</dt>
                  <dd className="text-base font-semibold">{billText(withStory.total_cents, visit?.currency)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-muted-foreground">Without it</dt>
                  <dd className="font-medium">{billText(quote.total_cents, visit?.currency)}</dd>
                </div>
              </dl>
            ) : null}
            {actionError ? (
              <p role="alert" className="mt-3 text-sm">
                {actionError}
              </p>
            ) : null}
            <StartOver onStartOver={startOver} />
          </div>
          <div className="border-border border-t p-4">
            <p className="text-muted-foreground mb-2 text-center text-sm" aria-live="polite">
              Waiting for staff to see it…
            </p>
            <button type="button" disabled={busy} onClick={() => void skipTask()} className="text-muted-foreground min-h-11 w-full text-sm underline">
              No story today
            </button>
          </div>
        </>
      ) : null}

      {step === "pay" && !result ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
          <h2 className={STEP_TITLE}>Pay your waiter</h2>
          {visit?.bill_cents != null && quote ? (
            <>
              <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{billText(quote.total_cents, visit.currency)}</p>
              <p className="text-muted-foreground mt-1 text-sm">Pay it at the place, in cash or by card. Nothing is charged through Mesita.</p>
              <div className="mt-4">
                <Receipt billCents={visit.bill_cents} offCents={quote.discount_cents} payCents={quote.total_cents} currency={visit.currency} />
              </div>
              <p className="text-muted-foreground mt-3 text-sm">Leaving a tip? Add it on top. Your reward came off the bill, not the tip.</p>
              <p className="text-muted-foreground mt-3 text-sm" aria-live="polite">
                Waiting for staff to tap Received…
              </p>
            </>
          ) : (
            <Skeleton className="mt-4 h-9 w-1/2" />
          )}
          <StartOver onStartOver={startOver} />
        </div>
      ) : null}

      {result ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <h2 className={STEP_TITLE}>All done</h2>
            <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{billText(result.total_cents, result.currency)}</p>
            <p className="text-muted-foreground mt-1 text-sm">Staff received it, and the visit is saved in Me › Visits.</p>
            <div className="mt-4">
              <Receipt billCents={result.bill_cents} offCents={result.discount_cents} payCents={result.total_cents} currency={result.currency} />
            </div>
          </div>
          <div className="border-border border-t p-4">
            <button type="button" onClick={onClose} className={PRIMARY_BUTTON_CLASS}>
              Done
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
