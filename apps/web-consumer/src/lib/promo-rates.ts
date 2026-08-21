
// Per-class promo rates. The `free`/`premium` keys mirror the v4 places
// columns (welcome_free_rate / free_rate / …) — the DB column vocabulary is
// unchanged (per-segment place columns are a not-yet-landed backend follow-up,
// MESITA-723). The consumer class → column mapping lives in
// resolveActivePromoRate: the floor reads `free`, anything elevated reads
// `premium`. These column names are the v4 PLACES columns and have nothing to
// do with the consumer's plan — they predate Classes v2 and are a binary
// cheap-vs-generous split, which is why the resolver takes a boolean.
type PromoClassRates = {
  free: number | null;
  premium: number | null;
};

type PromoMatrix = {
  welcome: PromoClassRates;
  default: PromoClassRates;
  is_first_visit: boolean;
};

/** Columns needed to resolve a place's promo rate / strategy. */
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
  is_first_visit?: boolean | null;
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
};

/** Place-shaped input for PromoChip (rates + cap/currency for the tooltip). */
export type PromoChipPlace = PromoRateFields & {
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

  return {
    welcome,
    default: defaults,
    is_first_visit: row.is_first_visit !== false,
  };
}

function promoMatrixHasAnyRate(matrix: PromoMatrix): boolean {
  return (
    matrix.welcome.free != null ||
    matrix.welcome.premium != null ||
    matrix.default.free != null ||
    matrix.default.premium != null
  );
}

function resolveActivePromoRate(
  matrix: PromoMatrix,
  elevated: boolean,
  isFirstVisit = matrix.is_first_visit,
): number | null {
  // The v4 columns only know the binary free-vs-elevated split, so this takes
  // the BOOLEAN it always meant. It used to take a ClassKey and compare it
  // against "standard", which silently assumed the class ladder had exactly
  // one unelevated rung — true under v1, and false the moment plan became its
  // own axis (a Bronze guest on Premium is elevated).
  const col: keyof PromoClassRates = elevated ? "premium" : "free";
  const welcome = matrix.welcome[col];
  const returning = matrix.default[col];
  return (
    (isFirstVisit ? (welcome ?? returning) : (returning ?? welcome)) ?? null
  );
}

// ── Strategy derivation (v7, MESITA-861) ────────────────────────────────
//
// Three strategies — zero / conservative / aggressive. The four place rate
// columns ARE the strategy (a membership writes them as one preset — admin-
// web-set-plan refuses partial grids), so the client recovers it by exact
// preset match, mirroring _shared/promo-strategy.ts. null/custom coerces to
// "zero", same as the bill engine.
export type PlaceStrategy = "zero" | "conservative" | "aggressive";

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
];

export function strategyForPromoMatrix(matrix: {
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
 * the room AT ALL, not what this particular guest would earn — that stays
 * resolvePromoRateFromPlaceRow for display, and the quotable number still comes
 * from consumer-web-get-discount-quote. Same gate as the promo chip, so a place
 * the deck shows with a ribbon is exactly a place "Visit" keeps.
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

export function resolvePromoRateFromPlaceRow(
  row: PromoRateFields,
  isFirstVisit: boolean,
  premium: boolean,
): number | null {
  const matrix = buildPromoMatrixFromRow(row, "partner");
  if (
    !placeOffersMesitaRewards({
      promoting: isPromoting(row),
      promo_matrix: matrix,
      promo_configured: hasExplicitClassRates(row),
    })
  ) {
    return null;
  }
  return resolveActivePromoRate(matrix, premium, isFirstVisit);
}
