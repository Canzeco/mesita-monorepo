"use client";

import { useEffect, useState } from "react";
import { money, readAmount } from "@/lib/amount";
import { closeVisit, getVisit, type ClosedVisit, type Visit } from "@/lib/visit-api";

// Pato, MESITA-3240: "you scan, and you click received and you input the actual
// amount and the digits." The amount is the full bill: the server takes the
// rewards off it and this page then says what the guest pays. Nothing is worked
// out here, so no second copy of the money rules exists.

const REWARD_NAME: Record<string, string> = {
  welcome_visit: "Welcome Visit",
  returning_visit: "Returning Visit",
  instagram_story: "Instagram Story",
  vip_class: "VIP Class",
};

/** Story is the one reward a person has to see first (MESITA-3202). */
const SEEN_FIRST = "instagram_story";

export function VisitFlow({ placeId, code }: { placeId: string; code: string }) {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [storySeen, setStorySeen] = useState(false);
  const [received, setReceived] = useState(false);
  const [closed, setClosed] = useState<ClosedVisit | null>(null);

  useEffect(() => {
    let live = true;
    getVisit(placeId, code).then(
      (next) => {
        if (live) setVisit(next);
      },
      (err: Error) => {
        if (live) setLoadError(err.message);
      },
    );
    return () => {
      live = false;
    };
  }, [placeId, code, attempt]);

  if (closed) return <Closed closed={closed} />;

  if (loadError) {
    return (
      <main>
        <h1>Mesita Visit</h1>
        <p>{loadError}</p>
        <button
          type="button"
          className="quiet"
          onClick={() => {
            setLoadError(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </main>
    );
  }
  if (!visit) {
    return (
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

  const cap = visit.rewards.find((r) => r.cap_cents != null)?.cap_cents ?? null;
  const rewardKinds = visit.rewards
    .filter((r) => r.kind !== SEEN_FIRST || storySeen)
    .map((r) => r.kind);

  return (
    <main>
      <h1>{visit.place_name}</h1>
      <p>{visit.guest_name}</p>
      {visit.rewards.length > 0 ? (
        <ul>
          {visit.rewards.map((r) => (
            <li key={r.kind}>
              {r.kind === SEEN_FIRST ? (
                <label>
                  <input
                    type="checkbox"
                    checked={storySeen}
                    disabled={received}
                    onChange={(e) => setStorySeen(e.target.checked)}
                  />
                  <span>{REWARD_NAME[r.kind]}: you saw the story</span>
                </label>
              ) : (
                <span>{REWARD_NAME[r.kind] ?? r.kind}</span>
              )}
              <strong>{r.percent}%</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>No rewards for this guest here.</p>
      )}
      {cap != null ? <p>At most {money(cap, visit.currency)} off a bill.</p> : null}
      {received ? (
        <CloseForm placeId={placeId} code={code} rewardKinds={rewardKinds} onClosed={setClosed} />
      ) : (
        <button type="button" onClick={() => setReceived(true)}>
          Received
        </button>
      )}
    </main>
  );
}

function CloseForm({
  placeId,
  code,
  rewardKinds,
  onClosed,
}: {
  placeId: string;
  code: string;
  rewardKinds: string[];
  onClosed: (closed: ClosedVisit) => void;
}) {
  const [amount, setAmount] = useState("");
  const [placeCode, setPlaceCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One per opening of this form, so a retried tap never logs a visit twice.
  const [requestId] = useState(() => crypto.randomUUID());

  const billCents = readAmount(amount);
  const ready = billCents !== null && /^\d{6}$/.test(placeCode);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (billCents === null || !ready) return;
    setBusy(true);
    setError(null);
    try {
      onClosed(await closeVisit({ placeId, code, placeCode, billCents, rewardKinds, requestId }));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <label className="field">
        <span>Amount, the full bill before the discount</span>
        <input
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Place code</span>
        <input
          className="secret"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={placeCode}
          onChange={(e) => setPlaceCode(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={!ready || busy}>
        {busy ? "Closing…" : "Close visit"}
      </button>
    </form>
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
