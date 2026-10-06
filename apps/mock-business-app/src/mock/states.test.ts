// EVERY NAMED STATE HAS COPY, A FIXTURE, AND AT MOST ONE DOOR (MESITA-2017).
//
// The voice session named states nobody had drawn: five Stripe rungs, six
// channel connections, seven campaign lifecycles, four line states, four
// website states. Each view carries a table keyed on the type, so the
// compiler refuses a missing entry; this asserts the two things it cannot —
// that a fixture place actually reaches each state (or the file says why
// not), and that no state offers two ways out.
//
// AND NOTHING READS THE WALL CLOCK. `MOCK_NOW` is Wednesday 2026-09-16; a view
// that calls `Date.now()` or `new Date()` with no argument flips on the
// weekend and on the Monday reset — the 2 a.m. Friday break.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLACES, CREDIT_CAMPAIGNS } from "./fixtures";
import type { CampaignState, LineState, OrderChannelState, PayLadder, WebsiteState } from "./types";
import { CAMPAIGN_STATES } from "@/components/views/CreditsView";
import { CHANNEL_STATES } from "@/components/views/OrdersView";
import { LINE_STATES } from "@/components/views/LineView";
import { WEBSITE_STATES } from "@/components/views/WebsiteView";

const has = <T,>(xs: T[], wanted: T[]) => wanted.every((w) => xs.includes(w));

describe("fixtures reach the named states", () => {
  it("Stripe: every rung but restricted has a place, and restricted is a scenario preset", () => {
    const rungs = PLACES.map((p) => p.pay);
    expect(has(rungs, ["never", "started", "pending", "enabled"] as PayLadder[])).toBe(true);
  });

  it("channels: disconnected, connecting, connected and token_expired; catalog_conflict is unreachable in v1", () => {
    const states = PLACES.flatMap((p) => Object.values(p.orderChannels));
    expect(has(states, ["disconnected", "connecting", "connected", "token_expired"] as OrderChannelState[])).toBe(true);
    // Platform-owned catalogs cannot conflict; the copy exists for the day
    // Mesita-owned sync does. A fixture holding it would be a lie.
    expect(states).not.toContain("catalog_conflict");
  });

  it("campaigns: all seven lifecycle states", () => {
    const states = CREDIT_CAMPAIGNS.map((c) => c.state);
    expect(has(states, ["draft", "scheduled", "selling", "sold_out", "closed", "redeeming", "expired"] as CampaignState[])).toBe(true);
  });

  it("line: off, activating and full; voice is one field away", () => {
    const states = PLACES.map((p) => p.lineState);
    expect(has(states, ["off", "activating", "full"] as LineState[])).toBe(true);
  });

  it("website: none, preview and published; picked is one field away", () => {
    const states = PLACES.map((p) => p.websiteState);
    expect(has(states, ["none", "preview", "published"] as WebsiteState[])).toBe(true);
  });

  it("the others: verification requested, a lapsed badge, cashback paused, a missing menu", () => {
    expect(PLACES.some((p) => p.verificationRequested && !p.verified)).toBe(true);
    expect(PLACES.some((p) => p.partnerLapsedAt !== null)).toBe(true);
    expect(PLACES.some((p) => p.cashbackPaused)).toBe(true);
    expect(PLACES.some((p) => p.menuPublishedAt === null)).toBe(true);
    expect(PLACES.some((p) => p.menuPublishedAt !== null)).toBe(true);
    expect(PLACES.some((p) => p.notificationsNumber === null)).toBe(true);
  });

  it("credits acceptance only ever names a sister fixture", () => {
    const ids = new Set(PLACES.map((p) => p.id));
    for (const p of PLACES) for (const id of p.acceptedIssuers) expect(ids.has(id) && id !== p.id).toBe(true);
  });
});

describe("state tables", () => {
  it("every failure state that names a reason names one verb", () => {
    for (const [key, s] of Object.entries(CHANNEL_STATES)) {
      if (s.why) expect(typeof s.verb, key).toBe("string");
    }
  });

  it("verbs are single strings, never lists", () => {
    for (const table of [CAMPAIGN_STATES, CHANNEL_STATES, LINE_STATES, WEBSITE_STATES]) {
      for (const s of Object.values(table)) expect(s.verb === null || typeof s.verb === "string").toBe(true);
    }
  });
});

describe("no view reads the wall clock", () => {
  const dir = join(__dirname, "..", "components", "views");
  const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
  it.each(files)("%s", (file) => {
    const src = readFileSync(join(dir, file), "utf8");
    expect(src).not.toMatch(/Date\.now\(/);
    expect(src).not.toMatch(/new Date\(\)/);
  });
});
