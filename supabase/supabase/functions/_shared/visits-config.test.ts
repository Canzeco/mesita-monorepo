import { assertEquals } from "jsr:@std/assert@1";
import {
  guestVisitsPolicy,
  normalizeVisitsConfig,
  staffVisitsPolicy,
  VISITS_DEFAULTS,
  type VisitsConfig,
} from "./visits-config.ts";

// Keys the admin Visits page does not render. Whole-blob save must still
// carry them so a later reader sees the operator's stored value, not a default.
const UNRENDERED = [
  "requireProofScreenshot",
  "maxFixRequests",
  "payCash",
  "payCard",
  "payCredits",
  "autoCloseHours",
  "legacyV3Enabled",
] as const;

Deno.test("normalizeVisitsConfig: an absent key comes back at its default", () => {
  const stripped = { ...VISITS_DEFAULTS } as Record<string, unknown>;
  for (const k of UNRENDERED) delete stripped[k];
  assertEquals(normalizeVisitsConfig(stripped), VISITS_DEFAULTS);
});

Deno.test("normalizeVisitsConfig: a stored unrendered value survives", () => {
  const stored: VisitsConfig = {
    ...VISITS_DEFAULTS,
    requireProofScreenshot: false,
    maxFixRequests: 0,
    payCash: false,
    payCard: true,
    payCredits: true,
    autoCloseHours: 48,
    legacyV3Enabled: false,
  };
  assertEquals(normalizeVisitsConfig(stored), stored);
});

Deno.test("normalizeVisitsConfig: default tip snaps onto a chip", () => {
  const cfg = normalizeVisitsConfig({
    tipPresets: [10, 20],
    defaultTipPct: 15,
  });
  assertEquals(cfg.tipPresets, [10, 20]);
  assertEquals(cfg.defaultTipPct, 10);
});

Deno.test("normalizeVisitsConfig: staff poll ceiling cannot sit below the base", () => {
  const cfg = normalizeVisitsConfig({
    staffPollSeconds: 8,
    staffPollMaxSeconds: 3,
  });
  assertEquals(cfg.staffPollSeconds, 8);
  assertEquals(cfg.staffPollMaxSeconds, 8);
});

Deno.test("guest/staff slices carry only what those surfaces may see", () => {
  const g = guestVisitsPolicy(VISITS_DEFAULTS);
  const s = staffVisitsPolicy(VISITS_DEFAULTS);
  assertEquals(g.tipPresets, [10, 15, 20]);
  assertEquals(g.consumerPollSeconds, 10);
  assertEquals(s.staffPollSeconds, 3);
  assertEquals(s.staffPollMaxSeconds, 30);
  const flat = JSON.stringify({ g, s });
  for (const forbidden of ["consumer_id", "project_id", "class_key", "strategy"]) {
    assertEquals(flat.includes(forbidden), false, `slice leaked "${forbidden}"`);
  }
});
