"use client";

import { useEffect, useState } from "react";
import { amountText, money, readAmount } from "@/lib/amount";
import { closeVisit, getVisit, setBill, setTask, VisitError, type ClosedVisit, type Visit } from "@/lib/visit-api";

// THE SHARED VISIT, STAFF'S SIDE (Pato, MESITA-3270: "Billtip, Reward, Task, Pay, who
// confirms"). The scan opens one visit on both phones and this page follows it. Whoever
// knows the fact confirms it: staff type the bill and the guest confirms it; staff say
// whether they saw the Story; staff tap Received once the guest has paid. Tip stays out
// until Stripe.
//
//   bill  Staff type the amount and the place code. Then wait for the guest's Confirm.
//   task  Only if a Story is on offer. Seen it, or No story.
//   pay   The one number. Received closes the visit.
//
// The guest holds this same link, so every stamp carries the place code (the server
// checks it). Staff type it once, with the bill, and the page keeps it until a reload.
// Nothing is worked out here: every amount is the server's.

const REWARD_NAME: Record<string, string> = {
  welcome_visit: "Welcome Visit",
  returning_visit: "Returning Visit",
  instagram_story: "Instagram Story",
  vip_class: "VIP Class",
};

/** How often the page follows the guest. */
const POLL_MS = 3000;

export function VisitFlow({ placeId, code, placeCode: typedPlaceCode }: { placeId: string; code: string; placeCode?: string }) {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [closed, setClosed] = useState<ClosedVisit | null>(null);
  const [placeCode, setPlaceCode] = useState(typedPlaceCode ?? "");
  // A wrong ticket, caught after the guest confirmed: they confirm the new one.
  const [changingBill, setChangingBill] = useState(false);

  useEffect(() => {
    if (closed || ended) return;
    let live = true;
    const read = () =>
      getVisit(placeId, code).then(
        (next) => {
          if (!live) return;
          setVisit(next);
          setFailed(null);
        },
        (err: VisitError) => {
          if (!live) return;
          if (err.code === "bad_code") setEnded(err.message);
          // A missed read only waits for the next one, once there is a page to keep.
          else setFailed(err.message);
        },
      );
    void read();
    const timer = setInterval(() => void read(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [placeId, code, attempt, closed, ended]);

  if (closed) return <Closed closed={closed} />;

  if (ended) {
    return (
      <main>
        <h1>Mesita Visit</h1>
        <p>{ended}</p>
      </main>
    );
  }
  if (!visit) {
    return failed ? (
      <main>
        <h1>Mesita Visit</h1>
        <p>{failed}</p>
        <button type="button" className="quiet" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </main>
    ) : (
      <main aria-busy>
        <p>Loading…</p>
      </main>
    );
  }
  if (!visit.code_set) {
    return (
      <main>
        <h1>{visit.place_name}</h1>
        <p>This place hasn&apos;t set its place code yet. The owner sets it in Mesita Business, under Rewards.</p>
      </main>
    );
  }

  const stamps = { placeId, code, placeCode, onPlaceCode: setPlaceCode, onVisit: setVisit };

  return (
    <main>
      <h1>{visit.place_name}</h1>
      <p>{visit.guest_name}</p>
      {visit.step === "bill" || changingBill ? (
        <BillStep visit={visit} {...stamps} startEditing={changingBill} onDoneEditing={() => setChangingBill(false)} />
      ) : (
        <>
          {visit.step === "task" ? <TaskStep visit={visit} {...stamps} /> : null}
          {visit.step === "pay" ? <PayStep visit={visit} {...stamps} onClosed={setClosed} /> : null}
          <button type="button" className="quiet" onClick={() => setChangingBill(true)}>
            Change the bill
          </button>
        </>
      )}
    </main>
  );
}

type Stamps = {
  visit: Visit;
  placeId: string;
  code: string;
  placeCode: string;
  onPlaceCode: (code: string) => void;
  onVisit: (visit: Visit) => void;
};

const placeCodeReady = (code: string) => /^\d{6}$/.test(code);

/** Asked once: gone after the first stamp that used it, back after a reload. */
function PlaceCodeField({ placeCode, onPlaceCode, known }: { placeCode: string; onPlaceCode: (code: string) => void; known: boolean }) {
  if (known) return null;
  return (
    <label className="field">
      <span>Place code</span>
      <input
        className="secret"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={placeCode}
        onChange={(e) => onPlaceCode(e.target.value.replace(/\D/g, ""))}
      />
    </label>
  );
}

function Rewards({ rewards }: { rewards: Visit["rewards"] }) {
  if (rewards.length === 0) return <p>No rewards for this guest here.</p>;
  return (
    <ul>
      {rewards.map((r) => (
        <li key={r.kind}>
          <span>{REWARD_NAME[r.kind] ?? r.kind}</span>
          <strong>{r.percent}%</strong>
        </li>
      ))}
    </ul>
  );
}

function BillStep({
  visit,
  placeId,
  code,
  placeCode,
  onPlaceCode,
  onVisit,
  startEditing,
  onDoneEditing,
}: Stamps & { startEditing: boolean; onDoneEditing: () => void }) {
  const sent = visit.bill_cents;
  const [editing, setEditing] = useState(startEditing);
  const [amount, setAmount] = useState(sent != null ? amountText(sent) : "");
  const [knownCode, setKnownCode] = useState(placeCodeReady(placeCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const billCents = readAmount(amount);
  const ready = billCents !== null && placeCodeReady(placeCode);

  if (sent != null && !editing) {
    return (
      <>
        <p>
          <strong>Bill {money(sent, visit.currency)}</strong>
        </p>
        <p aria-live="polite">Waiting for the guest to confirm it on their phone.</p>
        <button type="button" className="quiet" onClick={() => setEditing(true)}>
          Change the bill
        </button>
      </>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (billCents === null || !ready) return;
    setBusy(true);
    setError(null);
    try {
      onVisit(await setBill({ placeId, code, placeCode, billCents }));
      setKnownCode(true);
      setEditing(false);
      onDoneEditing();
    } catch (err) {
      const refused = err as VisitError;
      setError(refused.message);
      if (refused.code === "wrong_place_code" || refused.code === "locked") {
        setKnownCode(false);
        onPlaceCode("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <label className="field">
        <span>Full bill from the ticket, before the discount and any tip</span>
        <input inputMode="decimal" autoComplete="off" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <PlaceCodeField placeCode={placeCode} onPlaceCode={onPlaceCode} known={knownCode} />
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={!ready || busy}>
        {busy ? "Sending…" : "Send to guest"}
      </button>
      {sent != null ? (
        <button
          type="button"
          className="quiet"
          onClick={() => {
            setEditing(false);
            onDoneEditing();
          }}
        >
          Keep {money(sent, visit.currency)}
        </button>
      ) : null}
    </form>
  );
}

function TaskStep({ visit, placeId, code, placeCode, onPlaceCode, onVisit }: Stamps) {
  const [knownCode, setKnownCode] = useState(placeCodeReady(placeCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function stamp(seen: boolean) {
    setBusy(true);
    setError(null);
    try {
      onVisit(await setTask({ placeId, code, placeCode, seen }));
    } catch (err) {
      const refused = err as VisitError;
      setError(refused.message);
      if (refused.code === "wrong_place_code" || refused.code === "locked") {
        setKnownCode(false);
        onPlaceCode("");
      }
      setBusy(false);
    }
  }

  const ready = placeCodeReady(placeCode);
  const billed = visit.bill_cents != null ? money(visit.bill_cents, visit.currency) : null;
  return (
    <>
      {billed ? (
        <p>
          <strong>Bill {billed}</strong>
        </p>
      ) : null}
      <p>Ask to see the guest&apos;s Instagram Story about this place.</p>
      <ul>
        <li>
          <span>With the Story, the guest pays</span>
          <strong>{visit.quote_with_story ? money(visit.quote_with_story.total_cents, visit.currency) : "—"}</strong>
        </li>
        <li>
          <span>Without it</span>
          <strong>{visit.quote ? money(visit.quote.total_cents, visit.currency) : "—"}</strong>
        </li>
      </ul>
      <PlaceCodeField placeCode={placeCode} onPlaceCode={onPlaceCode} known={knownCode} />
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" disabled={!ready || busy} onClick={() => void stamp(true)}>
        Seen it
      </button>
      <button type="button" className="quiet" disabled={!ready || busy} onClick={() => void stamp(false)}>
        No story
      </button>
    </>
  );
}

function PayStep({ visit, placeId, code, placeCode, onPlaceCode, onVisit, onClosed }: Stamps & { onClosed: (closed: ClosedVisit) => void }) {
  const [knownCode, setKnownCode] = useState(placeCodeReady(placeCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One per visit on this page, so a retried tap never logs a visit twice.
  const [requestId] = useState(() => crypto.randomUUID());

  const ready = placeCodeReady(placeCode) && visit.bill_cents != null;

  async function received() {
    if (visit.bill_cents == null) return;
    setBusy(true);
    setError(null);
    try {
      onClosed(
        await closeVisit({
          placeId,
          code,
          placeCode,
          billCents: visit.bill_cents,
          rewardKinds: visit.rewards.map((r) => r.kind),
          requestId,
        }),
      );
    } catch (err) {
      const refused = err as VisitError;
      setError(refused.message);
      if (refused.code === "wrong_place_code" || refused.code === "locked") {
        setKnownCode(false);
        onPlaceCode("");
      }
      setBusy(false);
    }
  }

  async function takeStoryOff() {
    setBusy(true);
    setError(null);
    try {
      onVisit(await setTask({ placeId, code, placeCode, seen: false }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Rewards rewards={visit.rewards} />
      {visit.bill_cents != null && visit.quote ? (
        <ul>
          <li>
            <span>Bill</span>
            <strong>{money(visit.bill_cents, visit.currency)}</strong>
          </li>
          <li>
            <span>Discount</span>
            <strong>−{money(visit.quote.discount_cents, visit.currency)}</strong>
          </li>
          <li>
            <span>Guest pays</span>
            <strong>{money(visit.quote.total_cents, visit.currency)}</strong>
          </li>
        </ul>
      ) : null}
      <p>Take the payment at your till, then tap Received.</p>
      <PlaceCodeField placeCode={placeCode} onPlaceCode={onPlaceCode} known={knownCode} />
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" disabled={!ready || busy} onClick={() => void received()}>
        {busy ? "Closing…" : "Received"}
      </button>
      {visit.story && placeCodeReady(placeCode) ? (
        <button type="button" className="quiet" disabled={busy} onClick={() => void takeStoryOff()}>
          Take the Story off
        </button>
      ) : null}
    </>
  );
}

function Closed({ closed }: { closed: ClosedVisit }) {
  return (
    <main>
      <h1>Visit closed</h1>
      <ul>
        <li>
          <span>Bill</span>
          <strong>{money(closed.bill_cents, closed.currency)}</strong>
        </li>
        <li>
          <span>Discount</span>
          <strong>−{money(closed.discount_cents, closed.currency)}</strong>
        </li>
        <li>
          <span>Guest pays</span>
          <strong>{money(closed.total_cents, closed.currency)}</strong>
        </li>
      </ul>
    </main>
  );
}
