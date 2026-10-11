// ONE FACT, READ OFF THE PROFILE ROW (MESITA-2087). Two bugs this file pins:
//
//   Copy quoting the follower bar quotes the number the code actually tests
//   against. There is one number, and it is pinned literally here so a silent
//   drift has to come through this file.
//
//   A FAILED profile read is never stated as a fact. The default fallback
//   makes "we couldn't read it" and "you don't have it" one boolean apart,
//   and the wrong one is invisible in a screenshot.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ConsumerIdentityProvider,
  useConsumerIdentity,
} from "@/lib/identity-context";
import {
  INSTAGRAM_REACH_FOLLOWERS,
  instagramSummary,
  type ConsumerFacts,
} from "@/lib/consumer-identity";

/** Renders the identity the provider settled on as a JSON blob, so a test can
 *  assert the DERIVATION rather than a component's markup. */
function Probe() {
  const identity = useConsumerIdentity();
  return <span>{JSON.stringify(identity)}</span>;
}

function identityFrom(
  instagramHandle: string | null,
  instagramFollowers: number | null = null,
  profileUnavailable = false,
): ConsumerFacts {
  const html = renderToStaticMarkup(
    <ConsumerIdentityProvider
      instagramHandle={instagramHandle}
      instagramFollowers={instagramFollowers}
      profileUnavailable={profileUnavailable}
    >
      <Probe />
    </ConsumerIdentityProvider>,
  );
  return JSON.parse(
    html.replace(/^<span>/, "").replace(/<\/span>$/, "").replace(/&quot;/g, '"'),
  );
}

describe("Instagram is the handle, and the bar is the bar", () => {
  it("a handle with no count is connected but not verified", () => {
    const f = identityFrom("mock", 0);
    expect(f.igConnected).toBe(true);
    expect(f.igReach).toBe(false);
    expect(f.igHandle).toBe("mock");
  });

  it(`${INSTAGRAM_REACH_FOLLOWERS} exactly clears the bar`, () => {
    expect(identityFrom("mock", INSTAGRAM_REACH_FOLLOWERS).igReach).toBe(true);
    expect(identityFrom("mock", INSTAGRAM_REACH_FOLLOWERS - 1).igReach).toBe(
      false,
    );
  });

  it("the bar is 1,000 — Pato's number", () => {
    // Pinned literally so a silent drift has to come through this line.
    expect(INSTAGRAM_REACH_FOLLOWERS).toBe(1_000);
  });

  it("a count with no handle is not a connection", () => {
    // A stale `instagram_followers_count` on an account that disconnected
    // must not read as verified — or even as a count.
    const f = identityFrom(null, 50_000);
    expect(f.igConnected).toBe(false);
    expect(f.igReach).toBe(false);
    expect(f.igFollowers).toBe(0);
  });

  it("a blank handle is no handle", () => {
    const f = identityFrom("   ", 9_000);
    expect(f.igConnected).toBe(false);
    expect(f.igHandle).toBeNull();
  });
});

describe("a read that FAILED is never stated as a fact", () => {
  const unknown = identityFrom(null, null, true);

  it("carries the failure through to the identity", () => {
    expect(unknown.unknown).toBe(true);
  });

  it("says neither yes nor no", () => {
    // The default fallback makes a thrown read look like a plain account.
    // This line is what stops the app asserting the guess.
    expect(instagramSummary(unknown)).toBe("Come back to try");
  });

  it("a missing handle that did NOT throw is an ordinary empty account", () => {
    // "We read it and there is nothing" and "we could not read it" are one
    // boolean apart; only the second may hedge.
    const empty = identityFrom(null, null, false);
    expect(empty.unknown).toBe(false);
    expect(instagramSummary(empty)).toBe("Connect it");
  });
});

describe("the Instagram copy, pinned", () => {
  const off: ConsumerFacts = {
    igConnected: false,
    igHandle: null,
    igFollowers: 0,
    igReach: false,
    unknown: false,
  };

  it("the Me tile and the header chip", () => {
    expect(instagramSummary(off)).toBe("Connect it");
    expect(instagramSummary({ ...off, igConnected: true })).toBe("Connected");
    expect(
      instagramSummary({ ...off, igConnected: true, igHandle: "mock" }),
    ).toBe("@mock");
  });

  it("names no rung, class or reward — there are none", () => {
    for (const f of [
      off,
      { ...off, igConnected: true, igHandle: "mock", igFollowers: 200 },
      {
        ...off,
        igConnected: true,
        igHandle: "mock",
        igFollowers: 5_000,
        igReach: true,
      },
      { ...off, unknown: true },
    ]) {
      expect(instagramSummary(f)).not.toMatch(
        /\b(bronze|silver|gold|diamond|class|vip|tier|rank|rung|level|climb|reward|discount|premium|plan)\b/i,
      );
    }
  });
});
