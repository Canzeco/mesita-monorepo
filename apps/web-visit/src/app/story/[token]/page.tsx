"use client";

import { use, useEffect, useState } from "react";
import { SIGN } from "@mesita/place-profile/lib/pay-steps";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { getStory, listPayments, reviewStory, type StoryCheck, type StoryMention, VisitError } from "@/lib/visit-api";
import { keepStaff, readStaff } from "@/lib/staff-key";
import { waiterCode } from "@/lib/sign-gate";
import { agoLabel, zonedClock } from "@/lib/story-time";
import { CodeBoxes } from "../../tab/[token]/CodeBoxes";

// /story/<token> — the waiter's page for a guest's story check (MESITA-3507,
// the @mesita mention since MESITA-4264, approved BEFORE the guest pays since
// MESITA-4297). The guest's Offers sheet shows a Story QR; the waiter scans
// it and lands here. Top to bottom: the place, "Story voucher" and the
// guest's verified @handle; the guest's newest story, how long ago it was
// posted, and what the waiter checks by eye (@mesita tagged, this place
// tagged, the Paid partnership label); Approve and Reject. Approve and Reject
// need the waiter code, the tab page's sign-in: the 12-hour staff token kept
// on this device, never the code. The guest holds the QR, so the token alone
// approves nothing. While no story (or no story newer than a reject) has
// arrived, the page re-reads every poll.every_ms for poll.for_ms, then offers
// Refresh. No money here: the guest pays after the approval. Every rule is
// the server's.

type Read =
  | { kind: "loading" }
  | { kind: "ok"; check: StoryCheck }
  | { kind: "invalid" }
  | { kind: "retired" }
  | { kind: "failed" }
  | { kind: "reload" };

const TOO_OLD = "This story is too old for the bonus. Ask the guest to post a new one.";
const REOPEN = "Ask the guest to open the Story sheet again";

const handleOf = (h: string | null) => (h ? `@${h.replace(/^@/, "")}` : null);

/** The story the waiter can act on: none after a reject until a newer one. */
function freshStory(check: StoryCheck) {
  const s = check.story;
  if (!s) return null;
  if (check.state === "open" && check.last_rejected_at && Date.parse(s.mentioned_at) <= Date.parse(check.last_rejected_at)) return null;
  return s;
}

/** Re-read while an open check has no story the waiter can approve. */
function waitsForStory(check: StoryCheck) {
  if (check.state !== "open") return false;
  const s = freshStory(check);
  return !s || s.status === "too_old";
}

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
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped when the kept staff token changes, so the code box shows or hides.
  const [, setStaffBump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getStory(token)
      .then((check) => {
        if (cancelled) return;
        setRead({ kind: "ok", check });
        const waiting = waitsForStory(check);
        setPollUntil((until) => (waiting ? until ?? Date.now() + check.poll.for_ms : null));
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof VisitError && e.code === "reload") return setRead({ kind: "reload" });
        if (e instanceof VisitError && e.code === "story_token_retired") return setRead({ kind: "retired" });
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
    }, read.check.poll.every_ms);
    return () => clearTimeout(timer);
  }, [read, pollUntil]);

  function refresh() {
    if (read.kind === "ok") setPollUntil(Date.now() + read.check.poll.for_ms);
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
          This Story QR is not valid. Ask the guest to show it again.
        </p>
      </main>
    );
  }
  if (read.kind === "retired") {
    return (
      <main className="proof" data-story-state="retired">
        <p className="proof-status warn" role="alert">
          {REOPEN}
        </p>
      </main>
    );
  }
  if (read.kind === "reload") return <ReloadNeeded />;
  if (read.kind === "failed") {
    return (
      <main className="proof">
        <p className="proof-status" role="alert">
          Couldn&apos;t check this story. Try again.
        </p>
        <button type="button" onClick={() => { setRead({ kind: "loading" }); setNonce((n) => n + 1); }}>
          Try again
        </button>
      </main>
    );
  }

  const { check } = read;
  const placeId = check.place.id;
  const guest = handleOf(check.instagram_handle);
  const placeTag = handleOf(check.place.instagram_handle);
  const staffKept = readStaff(placeId);
  const clock = (iso: string) => zonedClock(iso, check.place.time_zone);

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

  async function decide(decision: "approve" | "reject", mentionId: string) {
    if (busy) return;
    setBusy(decision);
    setError(null);
    try {
      const staff = await staffToken();
      if (!staff) return;
      const r = await reviewStory({
        token,
        decision,
        ...(decision === "approve" ? { mention_id: mentionId } : {}),
        staff_token: staff,
        place_id: placeId,
      });
      if (r === "failed") return setError("Couldn't save. Try again");
      if ("refused" in r) {
        if (r.code === "staff_code_needed") {
          keepStaff(placeId, null, null);
          setStaffBump((n) => n + 1);
          return setError("Type the waiter code again, then tap again.");
        }
        if (r.code === "reload") return setRead({ kind: "reload" });
        if (r.code === "gone") return setRead({ kind: "invalid" });
        if (r.code === "story_token_retired") return setRead({ kind: "retired" });
        if (r.code === "story_gone" || r.code === "story_claimed") {
          setNotice(r.error);
          setTimeout(() => {
            setNotice(null);
            setNonce((n) => n + 1);
          }, 1500);
          return;
        }
        setError(r.code === "story_too_old" ? TOO_OLD : r.error);
        // Too old or already decided: the next read shows where it stands.
        if (r.code === "story_too_old" || r.code === "already_decided") setNonce((n) => n + 1);
        return;
      }
      if (r.outcome === "rejected") setPollUntil(Date.now() + check.poll.for_ms);
      setWaitOver(false);
      setNonce((n) => n + 1);
    } finally {
      setBusy(null);
    }
  }

  const band = check.test_mode ? (
    <p className="test-band" role="status" data-test-band>
      {TEST_BAND_TEXT}
    </p>
  ) : null;
  const header = (
    <header className="story-head">
      <p className="proof-place">{check.place.name ?? "A Mesita place"}</p>
      <h1>Story voucher</h1>
      <p className="proof-line">{guest ?? "No Instagram linked"}</p>
    </header>
  );

  if (check.state === "used") {
    return (
      <main className="proof" data-story-state="used">
        {band}
        {header}
        {check.story ? <StoryCard mention={check.story} now={check.server_time} big /> : null}
        <p className="proof-done story-outcome" role="status">
          Approved and paid.
        </p>
      </main>
    );
  }

  if (check.state === "expired") {
    return (
      <main className="proof" data-story-state="expired">
        {band}
        {header}
        <p className="proof-status warn" role="alert">
          This approval expired. {REOPEN}.
        </p>
      </main>
    );
  }

  if (check.state === "approved") {
    return (
      <main className="proof" data-story-state="approved">
        {band}
        {header}
        {check.story ? <StoryCard mention={check.story} now={check.server_time} big /> : null}
        <p className="proof-done story-outcome" role="status">
          {check.approved_at ? `Approved at ${clock(check.approved_at)}` : "Approved"} · the guest can now pay for the Story voucher
        </p>
        <p className="proof-line">They have until {clock(check.expires_at)} to pay.</p>
      </main>
    );
  }

  // open: a story can still be approved.
  const story = freshStory(check);
  const tooOld = story?.status === "too_old";
  const alert = error ? (
    <p className="proof-status warn" role="alert" aria-live="polite">
      {error}
    </p>
  ) : null;
  const waiting = waitOver ? (
    <div className="story-wait" data-story-wait="over">
      <p className="proof-line">
        No new story from {guest ?? "the guest"} yet. Ask the guest to post one.
      </p>
      <button type="button" className="quiet" onClick={refresh}>
        Refresh
      </button>
    </div>
  ) : (
    <div className="story-wait" data-story-wait="polling">
      <span className="pay-spinner" aria-hidden />
      <p className="proof-line" role="status">
        Waiting for the guest&apos;s story…
      </p>
    </div>
  );

  return (
    <main className="proof" data-story-state="open">
      {band}
      {header}
      {check.last_rejected_at && !story ? (
        <p className="proof-line story-note">Not approved. The guest can post again.</p>
      ) : null}
      {notice ? (
        <p className="proof-status" role="status">
          {notice}
        </p>
      ) : null}

      {!story ? (
        waiting
      ) : (
        <>
          <div className="story-list">
            <StoryCard mention={story} now={check.server_time} />
          </div>
          {tooOld ? (
            <>
              <p className="proof-status warn" role="alert">
                {TOO_OLD}
              </p>
              {waiting}
            </>
          ) : (
            <>
              <ul className="story-checks" aria-label="Check the story shows">
                <li>@mesita tagged</li>
                <li>{placeTag ?? "This place"} tagged</li>
                <li>Paid partnership label</li>
              </ul>
              {staffKept === null ? <CodeBoxes value={typedCode} onChange={setTypedCode} /> : null}
              {alert}
              <button type="button" disabled={!!busy || !!notice} onClick={() => void decide("approve", story.id)}>
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
              <button type="button" className="quiet" disabled={!!busy || !!notice} onClick={() => void decide("reject", story.id)}>
                {busy === "reject" ? "Saving…" : "Reject"}
              </button>
            </>
          )}
        </>
      )}
    </main>
  );
}

/** The story in a fixed 9:16 frame: the frame holds its size while the media
 *  loads; media that fails greys the card. Under it: how long ago it was
 *  posted, and "Test story" for an emulator story. */
function StoryCard({ mention, now, big = false }: { mention: StoryMention; now: string; big?: boolean }) {
  const [failed, setFailed] = useState(false);
  const broken = failed || !mention.media_url;
  const ago = agoLabel(mention.mentioned_at, now);
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
      <p className="proof-place">
        {ago === "just now" ? "Posted just now" : `Posted ${ago}`}
        {mention.source === "emulator" ? " · Test story" : ""}
      </p>
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
