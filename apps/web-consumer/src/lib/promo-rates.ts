// Per-class promo rates. The `free`/`premium` keys mirror the v4 places
// columns (welcome_free_rate / free_rate / …) — the DB column vocabulary is
// unchanged (per-segment place columns are a not-yet-landed backend follow-up,
// MESITA-723).
//
// NOTHING HERE IS A PRICE (MESITA-1019). These four numbers are the place's
// strategy IDENTITY: the engine recovers `zero | conservative | aggressive |
// dominant` by matching the tuple against the presets below, and the rate a
// guest is actually quoted comes from `promos_config.v11` via
// `consumer-web-get-discount-quote`. Reading a column as a percentage is the
// MESITA-1017 drift class and is how the promo chip spent a month quoting
// numbers the till never honored. The names also have nothing to do with the
// consumer's plan — they predate Classes v2 and are a binary
// cheap-vs-generous split.
type PromoClassRates = {
  free: number | null;
  premium: number | null;
};

type PromoMatrix = {
  welcome: PromoClassRates;
  default: PromoClassRates;
};

/** Columns needed to recover a place's strategy — and to gate on it. */
export type PromoRateFields = {
  /** Computed server-side per request (MESITA-1150): does a guest get a
   *  discount here RIGHT NOW. Replaces every listing_type gate — that enum is
   *  written only when something writes the place, so a strike-2 pause left
   *  it saying 'partner' over a closed promo lane. Absent ⇒ NOT promoting:
   *  hiding a real reward is recoverable, promising a dead one is not. */
  promoting?: boolean | null;
  /** @deprecated for gating — still on the row, no longer decides anything a
   *  guest sees. `promoting` is the question every surface actually asks. */
  listing_type?: string | null;
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
};

/** Place-shaped input for PromoChip: the id it quotes by, the columns that
 *  decide WHETHER it quotes, and the cap/currency for the tooltip. No rate is
 *  read from here any more — see PromoChip (MESITA-1019). */
export type PromoChipPlace = PromoRateFields & {
  id: string;
  currency?: string | null;
  reward_cap_mxn?: number | null;
};

function positiveRate(v: number | null | undefined): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

export function hasExplicitClassRates(row: PromoRateFields): boolean {
  return (
    positiveRate(row.welcome_free_rate) != null ||
    positiveRate(row.welcome_premium_rate) != null ||
    positiveRate(row.free_rate) != null ||
    positiveRate(row.premium_rate) != null
  );
}

/** Map places row → promo matrix from the per-class rate columns. */
export function buildPromoMatrixFromRow(
  row: PromoRateFields,
  _listingType: "partner" | "web",
): PromoMatrix {
  const welcome = {
    free: positiveRate(row.welcome_free_rate),
    premium: positiveRate(row.welcome_premium_rate),
  };
  const defaults = {
    free: positiveRate(row.free_rate),
    premium: positiveRate(row.premium_rate),
  };

  return { welcome, default: defaults };
}

function promoMatrixHasAnyRate(matrix: PromoMatrix): boolean {
  return (
    matrix.welcome.free != null ||
    matrix.welcome.premium != null ||
    matrix.default.free != null ||
    matrix.default.premium != null
  );
}

// ── Strategy derivation (v7, MESITA-861) ────────────────────────────────
//
// Three strategies — zero / conservative / aggressive. The four place rate
// columns ARE the strategy (a membership writes them as one preset — admin-
// web-set-plan refuses partial grids), so the client recovers it by exact
// preset match, mirroring _shared/promo-strategy.ts. null/custom coerces to
// "zero", same as the bill engine.
export type PlaceStrategy = "zero" | "conservative" | "aggressive" | "dominant";

const STRATEGY_PRESETS: {
  id: PlaceStrategy;
  w_free: number | null;
  w_prem: number | null;
  free: number | null;
  prem: number | null;
}[] = [
  { id: "zero", w_free: null, w_prem: null, free: null, prem: null },
  { id: "conservative", w_free: 20, w_prem: 30, free: 10, prem: 20 },
  { id: "aggressive", w_free: 30, w_prem: 50, free: 10, prem: 30 },
  // Dominant, restored 2026-08-21. Without this row a place running it falls
  // through to "zero" and the guest is told there is no reward — the exact
  // coercion this table's exact matching makes so easy to miss.
  { id: "dominant", w_free: 40, w_prem: 50, free: 20, prem: 30 },
];

function strategyForPromoMatrix(matrix: {
  welcome: { free: number | null; premium: number | null };
  default: { free: number | null; premium: number | null };
}): PlaceStrategy {
  const hit = STRATEGY_PRESETS.find(
    (s) =>
      s.w_free === matrix.welcome.free &&
      s.w_prem === matrix.welcome.premium &&
      s.free === matrix.default.free &&
      s.prem === matrix.default.premium,
  );
  return hit?.id ?? "zero";
}

/** Fail-closed read of the server's live answer (MESITA-1150). */
export function isPromoting(
  row: { promoting?: boolean | null } | null | undefined,
): boolean {
  return row?.promoting === true;
}

/**
 * Does this place PAY Mesita — the Partner fact, fail-closed.
 *
 * One of the three independent place facts (Verified · Partner · Promoting).
 * Deliberately NOT `listing_type === "partner"`: that enum fuses paying with
 * running a non-zero strategy and is only rewritten when something writes the
 * place, so a paused promo leaves it standing. The server computes this one
 * per request from the plan alone.
 */
export function isPartner(
  row: { partner?: boolean | null } | null | undefined,
): boolean {
  return row?.partner === true;
}

/** Whether the place runs the Mesita reward program (detail hero + matrix). */
export function placeOffersMesitaRewards(input: {
  promoting: boolean;
  promo_matrix: PromoMatrix;
  promo_configured: boolean;
}): boolean {
  if (!promoMatrixHasAnyRate(input.promo_matrix)) return false;
  // The server already weighed plan, strategy and promo lane together. A rate
  // on the row is not enough on its own: a paused place still carries its
  // rates, and rendering them would promise a discount nobody will honor.
  return input.promoting;
}

/**
 * The strategy a place row is running, straight from its four rate columns
 * (MESITA-869). Any surface holding a place summary — swipe card, place
 * detail, a ticket — can quote that place's REAL numbers instead of the
 * static peak: `REWARD_SEGMENT_BY_KEY.review.rates[strategyForPlaceRow(row)]`.
 * Custom or cleared rates coerce to "zero", exactly like the bill engine, so
 * the caller shows no percentage rather than a wrong one.
 */
export function strategyForPlaceRow(
  row: PromoRateFields | null | undefined,
): PlaceStrategy {
  if (!row) return "zero";
  return strategyForPromoMatrix(buildPromoMatrixFromRow(row, "partner"));
}

/**
 * Does this place run a live VISIT reward — the `visits` context of promos v11?
 *
 * Class-independent on purpose. The discovery Filters context axis
 * ("Prioritize · Visit", MESITA-1081) asks whether the place pays for a body in
 * the room AT ALL, not what this particular guest would earn — the quotable
 * number comes from consumer-web-get-discount-quote. Same gate as the promo
 * chip, so a place the deck shows with a ribbon is exactly a place "Visit"
 * keeps.
 */
export function placeRewardsVisits(
  row: PromoRateFields | null | undefined,
): boolean {
  if (!row) return false;
  return placeOffersMesitaRewards({
    promoting: isPromoting(row),
    promo_matrix: buildPromoMatrixFromRow(row, "partner"),
    promo_configured: hasExplicitClassRates(row),
  });
}
