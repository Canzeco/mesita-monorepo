"use client";

import { use, useEffect, useState } from "react";
import { SIGN } from "@mesita/place-profile/lib/pay-steps";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { getStory, listPayments, reviewStory, type StoryMention, type StoryVoucher, VisitError } from "@/lib/visit-api";
import { keepStaff, readStaff } from "@/lib/staff-key";
import { waiterCode } from "@/lib/sign-gate";
import { agoLabel, zonedClock } from "@/lib/story-time";
import { CodeBoxes } from "../../tab/[token]/CodeBoxes";

// /story/<token> — the staff page for a guest's Story voucher (MESITA-3507,
// verified from the @mesita mention since MESITA-4264). The guest's Wallet
// shows a QR; staff scan it and land here. Top to bottom: the place, "Story
// voucher" and the guest's verified @handle; the one instruction (the story
// must tag @mesita AND this place: Meta reports only the @mesita tag, so the
// place tag is the staff's eye); every unclaimed story of that handle from
// the last 24 hours, newest first, each with its own Approve; "None of these
// tag this place" (Reject) last. Approve and Reject need the waiter code,
// the tab page's sign-in: the 12-hour staff token kept on this device, never
// the code. The guest holds the QR, so the token alone approves nothing.
// While no story has arrived the page re-reads every poll.every_ms for
// poll.for_ms, then offers Refresh. Every rule and peso is the server's.

type Read =
  | { kind: "loading" }
  | { kind: "ok"; story: StoryVoucher }
  | { kind: "invalid" }
  | { kind: "failed" }
  | { kind: "reload" };

/** The states where a story can still be approved. */
const OPEN = ["needs_story", "received", "rejected"];

const handleOf = (h: string | null) => (h ? `@${h.replace(/^@/, "")}` : null);

function reloadPage() {
  window.location.reload();
}

export default function StoryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [read, setRead] = useState<Read>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);
  // While waiting for a story: re-read until this time, then offer Refresh.
  const [pollUntil, setPollUntil] = useState<number | null>(null);
  const [waitOver, setWaitOver] = useState(false);
  const [typedCode, setTypedCode] = useState("");
  // The mention id being approved, or "reject".
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped when the kept staff token changes, so the code box shows or hides.
  const [, setStaffBump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getStory(token)
      .then((story) => {
        if (cancelled) return;
        setRead({ kind: "ok", story });
        const waiting = !story.refunded && OPEN.includes(story.state) && story.mentions.length === 0;
        setPollUntil((until) => (waiting ? until ?? Date.now() + story.poll.for_ms : null));
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof VisitError && e.code === "reload") return setRead({ kind: "reload" });
        if (e instanceof VisitError && e.invalid) return setRead({ kind: "invalid" });
        // A missed re-read keeps the page as it was (a fresh object, so the
        // poll schedules its next read).
        setRead((r) => (r.kind === "ok" ? { ...r } : { kind: "failed" }));
      });
    return () => {
      cancelled = true;
    };
  }, [token, nonce]);

  // The poll: the next read every poll.every_ms until pollUntil.
  useEffect(() => {
    if (read.kind !== "ok" || pollUntil === null) return;
    const timer = setTimeout(() => {
      if (Date.now() >= pollUntil) {
        setPollUntil(null);
        setWaitOver(true);
      } else {
        setNonce((n) => n + 1);
      }
    }, read.story.poll.every_ms);
    return () => clearTimeout(timer);
  }, [read, pollUntil]);

  function refresh() {
    if (read.kind === "ok") setPollUntil(Date.now() + read.story.poll.for_ms);
    setWaitOver(false);
    setNonce((n) => n + 1);
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
  if (read.kind === "invalid") {
    return (
      <main className="proof">
        <p className="proof-status warn" role="alert">
          This Story voucher is not valid. Ask the guest to show it again.
        </p>
      </main>
    );
  }
  if (read.kind === "reload") return <ReloadNeeded />;
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

  const { story } = read;
  const placeId = story.place.id;
  const guest = handleOf(story.instagram_handle);
  const placeTag = handleOf(story.place.instagram_handle);
  const staffKept = readStaff(placeId);
  const clock = (iso: string) => zonedClock(iso, story.place.time_zone);

  /** The staff token for this tap: the kept one, or the typed waiter code
   *  traded for one (then kept, as the tab page does). Null on refusal. */
  async function staffToken(): Promise<string | null> {
    const kept = readStaff(placeId);
    if (kept) return kept;
    const code = waiterCode(typedCode);
    if (!code) {
      setError("Type the waiter code, then tap again.");
      return null;
    }
    const key = await listPayments({ place_id: placeId, place_code: code });
    setTypedCode("");
    if (key === "failed") {
      setError("Couldn't save. Try again");
      return null;
    }
    if ("kind" in key) {
      const wait = key.retryAfterS ? ` ${SIGN.tryAgainInMin(Math.ceil(key.retryAfterS / 60))}` : "";
      setError(key.kind === "staff_only" ? SIGN.wrongWaiterCode : `${key.error}${wait}`);
      return null;
    }
    if (!key.staff_token) {
      setError("Couldn't save. Try again");
      return null;
    }
    keepStaff(placeId, key.staff_token, key.staff_token_expires_at ?? null);
    setStaffBump((n) => n + 1);
    return key.staff_token;
  }

  async function decide(decision: "approve" | "reject", mentionId?: string) {
    if (busy) return;
    setBusy(mentionId ?? "reject");
    setError(null);
    try {
      const staff = await staffToken();
      if (!staff) return;
      const r = await reviewStory({ token, decision, ...(mentionId ? { mention_id: mentionId } : {}), staff_token: staff, place_id: placeId });
      if (r === "failed") return setError("Couldn't save. Try again");
      if ("refused" in r) {
        if (r.code === "staff_code_needed") {
          keepStaff(placeId, null, null);
          setStaffBump((n) => n + 1);
          return setError("Type the waiter code again, then tap again.");
        }
        if (r.code === "reload") return setRead({ kind: "reload" });
        if (r.code === "gone") return setRead({ kind: "invalid" });
        if (r.code === "mention_claimed" || r.code === "mention_expired") {
          setNotice("This story was just used. Refreshing…");
          setTimeout(() => {
            setNotice(null);
            setNonce((n) => n + 1);
          }, 1500);
          return;
        }
        setError(r.error);
        // Refunded, not paid, already decided: the next read shows why.
        if (r.code === "refunded" || r.code === "not_paid" || r.code === "already_decided") setNonce((n) => n + 1);
        return;
      }
      setNonce((n) => n + 1);
    } finally {
      setBusy(null);
    }
  }

  const band = story.test_mode ? (
    <p className="test-band" role="status" data-test-band>
      {TEST_BAND_TEXT}
    </p>
  ) : null;
  const header = (
    <header className="story-head">
      <p className="proof-place">{story.place.name ?? "A Mesita place"}</p>
      <h1>Story voucher</h1>
      <p className="proof-line">{guest ?? "No Instagram linked"}</p>
    </header>
  );

  // Not paid any more: nothing can be approved.
  if (story.refunded) {
    return (
      <main className="proof" data-story-state="refunded">
        {band}
        {header}
        <p className="proof-status warn" role="alert">
          {story.status === "needs_review" ? "This voucher is not paid yet." : "This voucher was refunded"}
        </p>
      </main>
    );
  }

  if (story.state === "released") {
    return (
      <main className="proof" data-story-state="released">
        {band}
        {header}
        {story.claimed_mention ? <StoryCard mention={story.claimed_mention} now={story.server_time} big /> : null}
        <p className="proof-done story-outcome" role="status">
          Bonus added
        </p>
      </main>
    );
  }

  if (story.state === "void") {
    const why =
      story.bonus_void_reason === "expired"
        ? "No story was approved within 7 days"
        : story.bonus_void_reason === "refunded"
          ? "This voucher was refunded"
          : story.bonus_void_reason === "unreachable"
            ? "Bonus not added · the story was not up 3 hours later"
            : "Bonus not added";
    return (
      <main className="proof" data-story-state="void">
        {band}
        {header}
        <p className="proof-status warn" role="alert">
          {why}
        </p>
      </main>
    );
  }

  if (story.state === "approved") {
    return (
      <main className="proof" data-story-state="approved">
        {band}
        {header}
        {story.claimed_mention ? <StoryCard mention={story.claimed_mention} now={story.server_time} big /> : null}
        <p className="proof-done story-outcome" role="status">
          {story.approved_at ? `Approved at ${clock(story.approved_at)}` : "Approved"}
          {story.bonus_at ? ` · the bonus lands from ${clock(story.bonus_at)} if the story is still up` : ""}
        </p>
      </main>
    );
  }

  // needs_story · received · rejected: a story can still be approved.
  const candidates = story.mentions;
  const alert = error ? (
    <p className="proof-status warn" role="alert" aria-live="polite">
      {error}
    </p>
  ) : null;
  return (
    <main className="proof" data-story-state={story.state}>
      {band}
      {header}
      <p className="proof-status story-rule">
        Approve only a story that tags @mesita AND {placeTag ? `${placeTag} (this place)` : "this place"}
      </p>
      {story.review === "rejected" ? <p className="proof-line story-note">Rejected. The guest can post again.</p> : null}
      {notice ? (
        <p className="proof-status" role="status">
          {notice}
        </p>
      ) : null}

      {candidates.length === 0 ? (
        waitOver ? (
          <div className="story-wait" data-story-wait="over">
            <p className="proof-line">
              No story from {guest ?? "the guest"} yet. Ask the guest to tag @mesita and this place.
            </p>
            <button type="button" className="quiet" onClick={refresh}>
              Refresh
            </button>
          </div>
        ) : (
          <div className="story-wait" data-story-wait="polling">
            <span className="pay-spinner" aria-hidden />
            <p className="proof-line" role="status">
              Waiting for the story…
            </p>
          </div>
        )
      ) : (
        <>
          <div className="story-list">
            {candidates.map((m) => (
              <StoryCard
                key={m.id}
                mention={m}
                now={story.server_time}
                busy={busy === m.id}
                disabled={!!busy || !!notice}
                onApprove={() => void decide("approve", m.id)}
              />
            ))}
          </div>
          {staffKept === null ? <CodeBoxes value={typedCode} onChange={setTypedCode} /> : null}
          {alert}
          <button type="button" className="quiet" disabled={!!busy || !!notice} onClick={() => void decide("reject")}>
            {busy === "reject" ? "Saving…" : "None of these tag this place"}
          </button>
        </>
      )}
    </main>
  );
}

/** One story in a fixed 9:16 frame: the frame holds its size while the
 *  media loads; media that fails greys the card and disables its Approve. */
function StoryCard({
  mention,
  now,
  big = false,
  busy = false,
  disabled = false,
  onApprove,
}: {
  mention: StoryMention;
  now: string;
  big?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onApprove?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const broken = failed || !mention.media_url;
  return (
    <div className={`story-card${big ? " story-card-big" : ""}${broken ? " story-card-broken" : ""}`} data-mention={mention.id}>
      <div className="story-frame">
        {broken ? (
          <p className="story-broken">Can&apos;t load this story. Ask the guest to show it on their phone</p>
        ) : mention.media_kind === "video" ? (
          <video className="story-media" src={mention.media_url ?? undefined} muted playsInline controls preload="metadata" onError={() => setFailed(true)} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="story-media" src={mention.media_url ?? undefined} alt="The guest's Instagram story" onError={() => setFailed(true)} />
        )}
      </div>
      <p className="proof-place">{agoLabel(mention.mentioned_at, now)}</p>
      {onApprove ? (
        <button type="button" disabled={broken || disabled} onClick={onApprove}>
          {busy ? "Approving…" : "Approve"}
        </button>
      ) : null}
    </div>
  );
}

function ReloadNeeded() {
  return (
    <main className="proof" data-story-state="reload">
      <p className="proof-status" role="alert">
        This page changed.
      </p>
      <button type="button" onClick={reloadPage}>
        Reload this page
      </button>
    </main>
  );
}
