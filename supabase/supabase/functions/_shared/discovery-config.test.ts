// MESITA-1410 — money may not buy the whole deck.
//
// `mesita_level` is entirely bought: `plan` is money and `promoting` is only
// true if the place pays. The blend is a product of s^w, and Level's rungs are
// LEVEL_LISTED 0.04 / LEVEL_PARTNER 0.2 / LEVEL_PROMOTING 1, so the
// promoting-over-listed ratio is 25^w:
//
//   w = 1   25x        the value MESITA-1408's merge shipped and preserved
//   w = 2   625x
//   w = 4   390,625x   the uniform WEIGHT_MAX
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

Deno.test("Level's ceiling is the value the merge shipped, so nothing re-ranks", () => {
  // The whole point of capping HERE rather than at some rounder number: w = 1
  // is the only exponent anyone has evaluated, because MESITA-1408 was
  // deliberately value-preserving at it. Adopting a live gate at its current
  // value is the only cap that changes nothing on landing.
  assertEquals(weightMaxFor("mesita_level"), 1);
  assertEquals(weightMaxFor("mesita_level"), DISCOVERY_DEFAULTS.weights.mesita_level);
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
  assertEquals(cfg.weights.mesita_level, 1);
  // ...while an earned one is still free to reach the uniform max, so this is
  // a targeted guard and not a global de-tuning.
  assertEquals(cfg.weights.proximity, 4);
});

Deno.test("the ceiling keeps the bought span inside one order of magnitude", () => {
  // The arithmetic the ceiling exists for. At the cap, promoting beats listed
  // by 25x — large, deliberately so, but a span the other seven signals can
  // still argue with. One rung higher and they cannot.
  const span = (w: number) => (LEVEL_PROMOTING / LEVEL_LISTED) ** w;
  assertEquals(span(weightMaxFor("mesita_level")), 25);
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
