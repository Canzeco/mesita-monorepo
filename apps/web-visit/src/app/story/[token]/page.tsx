"use client";

import { use, useEffect, useState } from "react";
import { clockTime, moneyLabel } from "@mesita/place-profile/lib/money";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { activateStory, getStory, type StoryVoucher, VisitError } from "@/lib/visit-api";

// /story/<token> — the staff page for a guest's Story voucher (MESITA-3507,
// Pato: "first buy it, then ... activate it by posting an instagram story
// tagging the place and showing it [to] the waiter"). The guest's Wallet
// shows a QR; staff scan it and land here. The page names the guest's
// Instagram: staff check that the story the guest shows is that account's,
// posted at this place and tagging it, then tap Activate. The credit turns
// Available at once; a second tap or phone reads "Already activated".

type Read = { kind: "loading" } | { kind: "ok"; story: StoryVoucher } | { kind: "invalid" } | { kind: "failed" };

export default function StoryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [read, setRead] = useState<Read>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);
  const [activatedAt, setActivatedAt] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activateFailed, setActivateFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStory(token)
      .then((story) => {
        if (!cancelled) setRead({ kind: "ok", story });
      })
      .catch((e) => {
        if (!cancelled) setRead({ kind: e instanceof VisitError && e.invalid ? "invalid" : "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [token, nonce]);

  async function activate() {
    setActivating(true);
    setActivateFailed(false);
    try {
      const r = await activateStory(token);
      setActivatedAt(r.activated_at);
    } catch (e) {
      if (e instanceof VisitError && e.invalid) setRead({ kind: "invalid" });
      else setActivateFailed(true);
    } finally {
      setActivating(false);
    }
  }

  if (read.kind === "invalid") {
    return (
      <main className="proof">
        <p className="proof-status warn" role="alert">
          This Story voucher is not valid. Ask the guest to show it again.
        </p>
      </main>
    );
  }
  if (read.kind === "failed") {
    return (
      <main className="proof">
        <p className="proof-status" role="alert">
          Couldn&apos;t check this Story voucher. Try again.
        </p>
        <button type="button" onClick={() => { setRead({ kind: "loading" }); setNonce((n) => n + 1); }}>
          Try again
        </button>
      </main>
    );
  }
  if (read.kind === "loading") {
    return (
      <main className="proof">
        <p className="proof-status" role="status">
          Checking…
        </p>
      </main>
    );
  }

  const { story } = read;
  const already = story.activated_at;
  const handle = story.instagram_handle ? `@${story.instagram_handle.replace(/^@/, "")}` : "No Instagram linked";

  return (
    <main className="proof">
      {story.test_mode ? (
        <p className="test-band" role="status" data-test-band>
          {TEST_BAND_TEXT}
        </p>
      ) : null}
      {already ? (
        <p className="proof-status warn" role="alert">
          Already activated · {clockTime(already)}
        </p>
      ) : null}
      {story.refunded ? <p className="proof-status warn">Refunded. It can&apos;t be activated.</p> : null}
      <p className="proof-line">Story voucher</p>
      <p className="proof-amount">{handle}</p>
      <p className="proof-line">
        {moneyLabel(story.credit_cents, story.currency)} of credit · paid {moneyLabel(story.amount_cents, story.currency)}
        {story.paid_at ? ` · ${clockTime(story.paid_at)}` : ""}
      </p>
      <p className="proof-place">{story.place.name ?? "A Mesita place"}</p>

      <div className="proof-foot">
        {already || story.refunded ? null : activatedAt ? (
          <p className="proof-done" role="status">
            Activated · {clockTime(activatedAt)}
          </p>
        ) : (
          <>
            <p className="proof-line">
              Check the guest&apos;s Instagram story: posted from {handle}, at this place, tagging it.
            </p>
            {activateFailed ? (
              <p className="proof-status" role="alert">
                Couldn&apos;t check this Story voucher. Try again.
              </p>
            ) : null}
            <button type="button" onClick={() => void activate()} disabled={activating}>
              {activating ? "Activating…" : "Story seen · Activate"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
