"use client";

import { useEffect, useState } from "react";
import { Ticket, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { SizedImg } from "@mesita/place-profile";
import { PLACE_REWARD_COUPON_CLASS } from "@mesita/place-profile/lib/ui";
import { Skeleton } from "@/components/shared";
import { apiCreateVisitCode, apiGetPlaceRewards, apiGetVisitResult, readBill, visitLink, type PlaceRewards, type VisitCode, type VisitResult } from "@/lib/api/rewards";
import { MOCK_REWARDS, mockRewardLabel } from "@/lib/mock-rewards";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import { capLine, RewardList } from "./RewardList";

// USING A REWARD, IN STEPS (Pato, MESITA-3250: "open almost a full screen modal …
// remember we have many steps"), inside a LocalSheet. Based on the old Ticket
// (TicketScreen and JourneyRail at 0134a1f9^): the place, a rail of steps, one step
// at a time. Only the steps that work today: the guest enters the bill (MESITA-3245),
// sees the rewards, shows a QR that carries the bill to visit.mesita.ai
// (MESITA-3240). The code lasts ten minutes and one use, and a new one replaces it
// when it ends, so what's on screen always works.
//
// PAY (Pato, MESITA-3256: "the step to pay the amount to the waiter"): staff close
// the visit on visit.mesita.ai and the server works out the discount. The QR step
// asks for that result every few seconds and moves here when it exists. No money
// moves through Mesita, and a tip is only words: the reward comes off the bill,
// never the tip, so the bill typed here is the one before tip.

const STEPS = [
  { id: "bill", label: "Bill" },
  { id: "reward", label: "Reward" },
  { id: "qr", label: "QR" },
  { id: "pay", label: "Pay" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const STEP_TITLE = "text-lg font-semibold tracking-tight";

/** How often the QR step asks whether staff closed the visit. */
const RESULT_POLL_MS = 4000;

function endsAt(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function billText(cents: number, currency = "MXN"): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
}

/** The rail: a bar over a word, equal columns. Steps already done go back. */
function StepRail({ step, onGo }: { step: StepId; onGo: (id: StepId) => void }) {
  const at = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Steps">
      {STEPS.map(({ id, label }, i) => {
        const body = (
          <>
            <span aria-hidden className={cn("h-[3px] w-full rounded-full", i <= at ? "bg-foreground" : "bg-border")} />
            <span className={cn("text-xs", i === at ? "font-semibold" : i < at ? "font-medium" : "text-muted-foreground font-medium")}>{label}</span>
          </>
        );
        const shell = "flex min-h-11 w-full flex-col items-start justify-center gap-1.5 text-left";
        return (
          <li key={id} className="min-w-0">
            {/* Once staff closed the visit there is nothing to go back to. */}
            {i < at && step !== "pay" ? (
              <button type="button" onClick={() => onGo(id)} className={shell}>
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

/** The QR step's code: made on arrival, replaced when it ends. */
function VisitCodeQr({
  placeId,
  billCents,
  onIssued,
  onChangeBill,
}: {
  placeId: string;
  billCents: number;
  onIssued: (issuedAt: string) => void;
  onChangeBill: () => void;
}) {
  const supabase = useBrowserSupabase();
  const [code, setCode] = useState<VisitCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    apiCreateVisitCode(supabase, placeId, billCents).then(
      (next) => {
        if (!live) return;
        setCode(next);
        setError(null);
        onIssued(next.issued_at);
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
    // onIssued only keeps the first time, so a new function changes nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, placeId, billCents, attempt]);

  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(
      () => setAttempt((n) => n + 1),
      Math.max(0, new Date(code.expires_at).getTime() - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [code]);

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className={STEP_TITLE}>Show this to staff</h2>
      <div className="mt-4 flex min-h-60 items-center justify-center">
        {code ? (
          <QRCodeSVG value={visitLink(placeId, code.code)} size={240} level="M" marginSize={2} bgColor="#ffffff" fgColor="#000000" />
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
          <Skeleton className="h-60 w-60 rounded-xl" />
        )}
      </div>
      {code ? (
        <div aria-live="polite">
          <p className="mt-4 font-semibold tabular-nums">Your bill: {billText(billCents)}</p>
          <p className="text-muted-foreground mt-1 text-sm">It works until {endsAt(code.expires_at)}. Staff scan it, correct the bill if it&apos;s off, and take your reward off. Then this screen shows what to pay.</p>
        </div>
      ) : null}
      <button type="button" onClick={onChangeBill} className="text-muted-foreground mt-1 min-h-11 text-sm underline">
        Change the bill
      </button>
    </div>
  );
}

export function VisitFlow({
  placeId,
  placeName,
  photo,
  onClose,
}: {
  placeId: string;
  placeName: string;
  photo?: string | null;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const [step, setStep] = useState<StepId>("bill");
  const [typed, setTyped] = useState("");
  const [data, setData] = useState<PlaceRewards | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The first code's time: a visit closed since then is this one, and a replaced
  // code does not move it.
  const [since, setSince] = useState<string | null>(null);
  const [result, setResult] = useState<VisitResult | null>(null);

  useEffect(() => {
    if (step !== "qr" || !since) return;
    let live = true;
    const timer = setInterval(() => {
      apiGetVisitResult(supabase, placeId, since).then(
        (visit) => {
          if (!live || !visit) return;
          setResult(visit);
          setStep("pay");
        },
        // A missed read only waits for the next one.
        () => undefined,
      );
    }, RESULT_POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [supabase, placeId, step, since]);

  useEffect(() => {
    let live = true;
    apiGetPlaceRewards(supabase, placeId).then(
      (next) => {
        if (live) setData(next);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [supabase, placeId, attempt]);

  const billCents = readBill(typed);
  // Real rewards where a place has them on, else the mock (MESITA-3218).
  const rewards = data ? (data.rewards.length > 0 ? data.rewards : MOCK_REWARDS) : [];
  const usable = rewards.some((r) => r.eligible);
  const coupon = mockRewardLabel(placeId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-4 pt-1">
        <span className="bg-muted ring-border block h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1">
          {photo ? <SizedImg src={photo} size="thumb" alt="" className="h-full w-full object-cover" /> : null}
        </span>
        <p className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{placeName}</p>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground -mr-2 flex h-11 w-11 shrink-0 items-center justify-center">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="px-4 pt-2">
        <StepRail step={step} onGo={setStep} />
      </div>

      {step === "bill" ? (
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (billCents !== null) setStep("reward");
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
            <h2 className={STEP_TITLE}>How much is your bill?</h2>
            <p className="text-muted-foreground mt-1 text-sm">Type it before any tip: your reward comes off the bill, not the tip. Staff correct it if it&apos;s off.</p>
            <div className="relative mt-4">
              <span aria-hidden className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                $
              </span>
              <input
                aria-label="Your bill"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                className={cn(INPUT_CLASS, "h-12 pr-14 pl-7 tabular-nums")}
              />
              <span aria-hidden className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                MXN
              </span>
            </div>
          </div>
          <div className="border-border border-t p-4">
            <button type="submit" disabled={billCents === null} className={PRIMARY_BUTTON_CLASS}>
              Next
            </button>
          </div>
        </form>
      ) : null}

      {step === "reward" ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <h2 className={STEP_TITLE}>Your reward</h2>
            {billCents !== null ? <p className="text-muted-foreground mt-1 text-sm tabular-nums">On your bill of {billText(billCents)}.</p> : null}
            {coupon ? (
              <p className={cn(PLACE_REWARD_COUPON_CLASS, "mt-4 flex w-full justify-center font-semibold")}>
                <Ticket className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{coupon}</span>
              </p>
            ) : null}
            <div className="border-border bg-card mt-4 rounded-2xl border">
              {data ? (
                <RewardList rewards={rewards} signedIn={data.signed_in} />
              ) : failed ? (
                <div className="p-4">
                  <p className="font-semibold">Rewards didn&apos;t load.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFailed(false);
                      setAttempt((n) => n + 1);
                    }}
                    className="text-muted-foreground mt-1 text-sm underline"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 p-4" aria-busy>
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              )}
            </div>
            {data ? (
              <p className="text-muted-foreground mt-3 text-sm">
                {usable
                  ? `The ones you qualify for add up, and the place takes them off today's bill.${capLine(rewards[0]?.cap_cents)}`
                  : data.signed_in
                    ? "None of these apply to you right now."
                    : "Sign in to use a reward."}
              </p>
            ) : null}
          </div>
          <div className="border-border border-t p-4">
            <button type="button" disabled={!usable} onClick={() => setStep("qr")} className={PRIMARY_BUTTON_CLASS}>
              Show my QR
            </button>
          </div>
        </>
      ) : null}

      {step === "qr" && billCents !== null ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <VisitCodeQr
              placeId={placeId}
              billCents={billCents}
              onIssued={(issuedAt) => setSince((first) => first ?? issuedAt)}
              onChangeBill={() => setStep("bill")}
            />
          </div>
          <p className="border-border text-muted-foreground border-t p-4 text-center text-sm" aria-live="polite">
            Waiting for staff…
          </p>
        </>
      ) : null}

      {step === "pay" && result ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <h2 className={STEP_TITLE}>Pay your waiter</h2>
            <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{billText(result.total_cents, result.currency)}</p>
            <p className="text-muted-foreground mt-1 text-sm">Pay it at the place, in cash or by card. Nothing is charged through Mesita.</p>
            <dl className="border-border bg-card divide-border mt-4 divide-y rounded-2xl border text-sm tabular-nums">
              <div className="flex items-center justify-between gap-3 p-4">
                <dt className="text-muted-foreground">Bill</dt>
                <dd>{billText(result.bill_cents, result.currency)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <dt className="text-muted-foreground">Reward</dt>
                <dd>−{billText(result.discount_cents, result.currency)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 p-4 font-semibold">
                <dt>You pay</dt>
                <dd>{billText(result.total_cents, result.currency)}</dd>
              </div>
            </dl>
            <p className="text-muted-foreground mt-3 text-sm">Leaving a tip? Add it on top. Your reward came off the bill, not the tip.</p>
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
