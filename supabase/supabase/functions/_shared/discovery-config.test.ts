// MESITA-1410 — money may not buy the whole deck.
//
// At decision time `mesita_level` was entirely bought: `plan` is money and
// `promoting` is only true if the place pays. MESITA-1598 later folded in
// Intake high-water, but this ceiling still bounds the same money RUNGS —
// LEVEL_LISTED 0.04 / LEVEL_PARTNER 0.2 / LEVEL_PROMOTING 1 — so the
// promoting-over-listed ratio is still 25^w at their bare values:
//
//   w = 1   25x
//   w = 2   625x        the ceiling (Pato, MESITA-1410)
//   w = 4   390,625x    the uniform WEIGHT_MAX
//
// Every other signal is bounded in (0, 1] and abstains at 1, so at w = 4 no
// combination of relevance outranks money — Level stops being a signal and
// becomes a sort key. These tests pin the ceiling that prevents an operator
// reaching that state from the console.

import {
  assertEquals,
  assertNotEquals,
} from "jsr:@std/assert@1";
import {
  DISCOVERY_DEFAULTS,
  normalizeDiscoveryConfig,
  SIGNAL_WEIGHT_MAX,
  WEIGHT_MAX,
  weightMaxFor,
} from "./discovery-config.ts";
import { LEVEL_LISTED, LEVEL_PROMOTING, SIGNAL_KEYS } from "./discovery-signals.ts";

Deno.test("Level's ceiling is 2, distinct from its default weight of 1", () => {
  // The default weight (1, MESITA-1408's value-preserving merge) and the
  // ceiling (2, Pato's MESITA-1410 decision) are two different numbers on
  // purpose: the default changes nothing on landing, and the ceiling is how
  // far an operator may turn the dial from the console afterward.
  assertEquals(weightMaxFor("mesita_level"), 2);
  assertNotEquals(weightMaxFor("mesita_level"), DISCOVERY_DEFAULTS.weights.mesita_level);
});

Deno.test("only Level is capped — the other seven keep the uniform ceiling", () => {
  for (const key of SIGNAL_KEYS) {
    if (key === "mesita_level") continue;
    assertEquals(weightMaxFor(key), WEIGHT_MAX, `${key} should keep WEIGHT_MAX`);
  }
  // A cap equal to WEIGHT_MAX would be a no-op dressed as a guard.
  assertNotEquals(weightMaxFor("mesita_level"), WEIGHT_MAX);
});

Deno.test("a console write above Level's ceiling is clamped, not accepted", () => {
  const cfg = normalizeDiscoveryConfig({
    weights: { mesita_level: 4, proximity: 4 },
  });
  // The bought axis is held at its ceiling...
  assertEquals(cfg.weights.mesita_level, 2);
  // ...while an earned one is still free to reach the uniform max, so this is
  // a targeted guard and not a global de-tuning.
  assertEquals(cfg.weights.proximity, 4);
});

Deno.test("the ceiling keeps the bought span two orders of magnitude below the uniform max", () => {
  // The arithmetic the ceiling exists for. At the cap, promoting beats listed
  // by 625x — large, deliberately so, but a span the other seven signals can
  // still argue with. At the uniform max (390,625x) nothing could.
  const span = (w: number) => (LEVEL_PROMOTING / LEVEL_LISTED) ** w;
  assertEquals(span(weightMaxFor("mesita_level")), 625);
  assertEquals(span(WEIGHT_MAX), 390_625);
});

Deno.test("the admin console mirrors the ceiling it renders", () => {
  // catalog.ts is a hand-maintained mirror of this module (it says so at
  // WEIGHT_MIN). The EF clamps server-side either way, so drift here is not a
  // correctness bug — it is a console that offers a number the backend then
  // silently refuses, which is worse to debug than a rejected write.
  const catalog = Deno.readTextFileSync(
    new URL(
      "../../../../apps/web-admin/src/app/(app)/filters-config/catalog.ts",
      import.meta.url,
    ),
  );
  for (const [key, cap] of Object.entries(SIGNAL_WEIGHT_MAX)) {
    const pattern = new RegExp(`${key}:\\s*${cap}\\s*,`);
    assertEquals(
      pattern.test(catalog),
      true,
      `catalog.ts must mirror SIGNAL_WEIGHT_MAX.${key} = ${cap}`,
    );
  }
});
