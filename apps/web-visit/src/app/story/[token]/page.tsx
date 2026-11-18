"use client";

import { use, useEffect, useState } from "react";
import { SIGN } from "@mesita/place-profile/lib/pay-steps";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { getStory, listPayments, reviewStory, type StoryMention, VisitError, type WaiterStory } from "@/lib/visit-api";
import { keepStaff, readStaff } from "@/lib/staff-key";
import { waiterCode } from "@/lib/sign-gate";
import { agoLabel } from "@/lib/story-time";
import { CodeBoxes } from "../../tab/[token]/CodeBoxes";

// /story/<token> — the waiter's page for a guest's Story voucher
// (MESITA-4304; pieces from MESITA-3507, 4264 and the closed 4297). The app
// already found the guest's story (consumer-web-check-story); the guest's
// Story page shows this QR BEFORE they pay. Top to bottom: the place, "Story
// voucher", the guest's verified @handle; the story, how long ago it was
// posted, and what the waiter checks by eye (@mesita tagged, this place
// tagged, the Paid partnership label); Approve and Reject. Both need the
// waiter code, the tab page's sign-in: the 12-hour staff token kept on this
// device, never the code. The guest holds the QR, so the token alone
// approves nothing. No money here: the guest pays after the approval. Every
// rule is the server's.

type Read = { kind: "loading" } | { kind: "ok"; story: WaiterStory } | { kind: "invalid" } | { kind: "failed" };

const TOO_OLD = "This story is too old for the bonus. Ask the guest to post a new one.";
const handleOf = (h: string | null) => (h ? `@${h.replace(/^@/, "")}` : null);

export default function StoryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [read, setRead] = useState<Read>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);
  const [typedCode, setTypedCode] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped when the kept staff token changes, so the code box shows or hides.
  const [, setStaffBump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getStory(token)
      .then((story) => {
        if (!cancelled) setRead({ kind: "ok", story });
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof VisitError && e.invalid) return setRead({ kind: "invalid" });
        setRead((r) => (r.kind === "ok" ? r : { kind: "failed" }));
      });
    return () => {
      cancelled = true;
    };
  }, [token, nonce]);

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
      <main className="proof" data-story-state="invalid">
        <p className="proof-status warn" role="alert">
          This Story QR is not valid. Ask the guest to show it again.
        </p>
      </main>
    );
  }
  if (read.kind === "failed") {
    return (
      <main className="proof">
        <p className="proof-status" role="alert">
          Couldn&apos;t check this story. Try again.
        </p>
        <button
          type="button"
          onClick={() => {
            setRead({ kind: "loading" });
            setNonce((n) => n + 1);
          }}
        >
          Try again
        </button>
      </main>
    );
  }

  const s = read.story;
  const placeId = s.place.id;
  const guest = handleOf(s.instagram_handle);
  const placeTag = handleOf(s.place.instagram_handle);
  const staffKept = readStaff(placeId);

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

  async function decide(decision: "approve" | "reject") {
    if (busy) return;
    setBusy(decision);
    setError(null);
    try {
      const staff = await staffToken();
      if (!staff) return;
      const r = await reviewStory({ token, decision, staff_token: staff, place_id: placeId });
      if (r === "failed") return setError("Couldn't save. Try again");
      if ("refused" in r) {
        if (r.code === "staff_code_needed") {
          keepStaff(placeId, null, null);
          setStaffBump((n) => n + 1);
          return setError("Type the waiter code again, then tap again.");
        }
        if (r.code === "gone") return setRead({ kind: "invalid" });
        setError(r.code === "story_too_old" ? TOO_OLD : r.error);
        setNonce((n) => n + 1);
        return;
      }
      setNonce((n) => n + 1);
    } finally {
      setBusy(null);
    }
  }

  const band = s.test_mode ? (
    <p className="test-band" role="status" data-test-band>
      {TEST_BAND_TEXT}
    </p>
  ) : null;
  const header = (
    <header className="story-head">
      <p className="proof-place">{s.place.name ?? "A Mesita place"}</p>
      <h1>Story voucher</h1>
      <p className="proof-line">{guest ?? "No Instagram linked"}</p>
    </header>
  );

  if (s.state !== "waiting") {
    const line =
      s.state === "approved"
        ? "Approved · the guest can now pay for the Story voucher"
        : s.state === "used"
          ? "Approved and paid."
          : "Not approved. The guest can post a new story.";
    return (
      <main className="proof" data-story-state={s.state}>
        {band}
        {header}
        <StoryCard mention={s.story} now={s.server_time} big />
        <p className={s.state === "rejected" ? "proof-status warn story-outcome" : "proof-done story-outcome"} role="status">
          {line}
        </p>
      </main>
    );
  }

  const tooOld = s.story.status === "too_old";
  return (
    <main className="proof" data-story-state="waiting">
      {band}
      {header}
      <div className="story-list">
        <StoryCard mention={s.story} now={s.server_time} />
      </div>
      {tooOld ? (
        <p className="proof-status warn" role="alert">
          {TOO_OLD}
        </p>
      ) : (
        <>
          <ul className="story-checks" aria-label="Check the story shows">
            <li>@mesita tagged</li>
            <li>{placeTag ?? "This place"} tagged</li>
            <li>Paid partnership label</li>
          </ul>
          {staffKept === null ? <CodeBoxes value={typedCode} onChange={setTypedCode} /> : null}
          {error ? (
            <p className="proof-status warn" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}
          <button type="button" disabled={!!busy} onClick={() => void decide("approve")}>
            {busy === "approve" ? "Approving…" : "Approve"}
          </button>
          <button type="button" className="quiet" disabled={!!busy} onClick={() => void decide("reject")}>
            {busy === "reject" ? "Saving…" : "Reject"}
          </button>
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
        {mention.source === "emulator" && !mention.media_url ? (
          // MESITA-4310: a test story has no screenshot; it only tags.
          <p className="story-broken">Test story · tags @mesita and this place</p>
        ) : broken ? (
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
