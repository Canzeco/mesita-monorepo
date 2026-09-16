// Pure grouping/ranking/pagination for the Wallet's real balance read
// (consumer-web-list-credit-balances, MESITA-1674). Kept out of the EF's
// index.ts so the ranking rule is unit-testable without a live DB — the same
// split credits-readiness.ts and credits-packages.ts already use.
//
// PLACE-SCOPED, MIRRORING THE SCHEMA. credit_lots is place-scoped
// (MESITA-1892): a guest's Credits at one venue are ONE balance no matter how
// many lots fund it. This module groups a flat lot list (one consumer's rows,
// however many places they span) into one summary per place.
//
// BALANCE IS STILL DERIVED, NEVER CACHED. Same rule the schema comment on
// credit_lots makes: nothing here is written back. `remainingCents` is
// computed fresh from paid/bonus/spent every time this module runs.
//
// THE PLACE IS BOTH THE MONEY BOUNDARY AND THE FACE — THE BRANCH IS GONE.
// MESITA-1816 made a one-place organization's balance wear that place's name
// and photo, and kept an else-branch for the enterprise case: at two or more
// places the card fell back to the organization's own identity. Pato,
// 2026-09-13: "too complex for one organization to manage multiple places
// too. It's just too enterprise." MESITA-1892 took him at his word and
// deleted the layer, so the else-branch has no world left to describe —
// `placeCount` and the nullable `place` collapse into the balance simply
// BEING a place: who owes the guest, what the card is titled, and whose photo
// it wears are now one fact, not three that had to be reconciled.

export type CreditLotRow = {
  id: string;
  placeId: string;
  paidCents: number;
  bonusCents: number;
  spentCents: number;
  currency: string;
  activatesAt: string; // ISO
  expiresAt: string; // ISO
  createdAt: string; // ISO
};

export type CreditLotSummary = {
  lotId: string;
  paidCents: number;
  bonusCents: number;
  spentCents: number;
  /** paid + bonus - spent. credit_lots_spent_range keeps this non-negative at the DB. */
  remainingCents: number;
  activatesAt: string;
  expiresAt: string;
  createdAt: string;
  /** activatesAt is still in the future, relative to the server clock this response is stamped with. */
  pending: boolean;
  /** expiresAt has passed. A lot is never both — credit_lots_matures_before_expiry is a DB constraint. */
  expired: boolean;
};

/** The place's own identity, for the card's face. */
export type CreditBalanceFace = {
  name: string;
  /** `photos[0]`, ONE string — the same rule business-web-list-places states. Null when the place has none. */
  photoUrl: string | null;
};

export type CreditPlaceBalance = {
  placeId: string;
  placeName: string;
  /** The place's `photos[0]`, or null. The Wallet wears it as the balance's face. */
  photoUrl: string | null;
  currency: string;
  /** Sum of remainingCents across every lot — spendable, pending or expired. A place with only dead lots still reports what was there, the same continuity the old per-place BalanceCard kept. */
  totalCents: number;
  /** Sum of remainingCents across lots that are neither pending nor expired: spendable right now. */
  spendableCents: number;
  /** Sum of remainingCents across lots not yet active. */
  pendingCents: number;
  /** Sum of the still-unspent PRINCIPAL across live (non-expired) lots — spend_credits takes principal before bonus, so paid_cents - spent_cents (floored at 0) is the exact remaining paid share, not an estimate. */
  paidCents: number;
  /** Soonest expiresAt among spendable lots, or null when none are spendable. Drives an "expires in Nd" chip. */
  nearestExpiryAt: string | null;
  /** Soonest activatesAt among pending lots, or null when none are pending. Drives "activates in Nh". */
  nearestActivationAt: string | null;
  /** Whether Buy would still work at this place today (placesAcceptingCredits). A balance renders regardless — this only gates the "buy more" affordance. */
  acceptsMoreCredits: boolean;
  /** Newest first. */
  lots: CreditLotSummary[];
};

export function summarizeLot(row: CreditLotRow, nowMs: number): CreditLotSummary {
  const activatesAtMs = Date.parse(row.activatesAt);
  const expiresAtMs = Date.parse(row.expiresAt);
  return {
    lotId: row.id,
    paidCents: row.paidCents,
    bonusCents: row.bonusCents,
    spentCents: row.spentCents,
    remainingCents: Math.max(0, row.paidCents + row.bonusCents - row.spentCents),
    activatesAt: row.activatesAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    pending: activatesAtMs > nowMs,
    expired: expiresAtMs <= nowMs,
  };
}

/** Name and photo per place, built by the caller from ONE place_profiles read
 *  across every place on the page. A place missing here still gets a balance —
 *  money the guest is owed never depends on the face resolving. */
export type PlaceFaces = ReadonlyMap<string, CreditBalanceFace>;

export function groupCreditLotsByPlace(
  rows: CreditLotRow[],
  faces: PlaceFaces,
  acceptsMore: ReadonlySet<string>,
  nowMs: number,
): CreditPlaceBalance[] {
  const byPlace = new Map<string, CreditLotSummary[]>();
  const currencyByPlace = new Map<string, string>();
  for (const row of rows) {
    const list = byPlace.get(row.placeId) ?? [];
    list.push(summarizeLot(row, nowMs));
    byPlace.set(row.placeId, list);
    if (!currencyByPlace.has(row.placeId)) {
      currencyByPlace.set(row.placeId, row.currency);
    }
  }

  const out: CreditPlaceBalance[] = [];
  for (const [placeId, lots] of byPlace) {
    let totalCents = 0;
    let spendableCents = 0;
    let pendingCents = 0;
    let paidCents = 0;
    let nearestExpiryMs = Infinity;
    let nearestActivationMs = Infinity;
    for (const lot of lots) {
      totalCents += lot.remainingCents;
      if (lot.expired) continue;
      paidCents += Math.max(0, lot.paidCents - lot.spentCents);
      if (lot.pending) {
        pendingCents += lot.remainingCents;
        nearestActivationMs = Math.min(nearestActivationMs, Date.parse(lot.activatesAt));
      } else {
        spendableCents += lot.remainingCents;
        nearestExpiryMs = Math.min(nearestExpiryMs, Date.parse(lot.expiresAt));
      }
    }
    const face = faces.get(placeId) ?? null;
    out.push({
      placeId,
      placeName: face?.name ?? "A Mesita place",
      photoUrl: face?.photoUrl ?? null,
      currency: currencyByPlace.get(placeId) ?? "MXN",
      totalCents,
      spendableCents,
      pendingCents,
      paidCents,
      nearestExpiryAt: Number.isFinite(nearestExpiryMs) ? new Date(nearestExpiryMs).toISOString() : null,
      nearestActivationAt: Number.isFinite(nearestActivationMs) ? new Date(nearestActivationMs).toISOString() : null,
      acceptsMoreCredits: acceptsMore.has(placeId),
      lots: [...lots].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    });
  }
  return out;
}

/**
 * Spendable places first, then pending-only, then dead money — the same
 * three-tier "spendable sinks last when expired" rule BalanceList's
 * rankBalances applied per-place, with a middle tier for money that exists
 * but has not matured yet. Ties break on totalCents desc, then name asc, so
 * the order is fully deterministic across pages — required for the offset
 * cursor below to mean the same thing on every call.
 */
export function rankPlaceBalances(places: CreditPlaceBalance[]): CreditPlaceBalance[] {
  const tier = (p: CreditPlaceBalance) => (p.spendableCents > 0 ? 0 : p.pendingCents > 0 ? 1 : 2);
  return [...places].sort((a, b) => {
    const t = tier(a) - tier(b);
    if (t !== 0) return t;
    if (b.totalCents !== a.totalCents) return b.totalCents - a.totalCents;
    return a.placeName.localeCompare(b.placeName);
  });
}

/** A page's worth by default; also the hard ceiling a caller cannot raise past. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export function clampLimit(raw: unknown): number {
  const n = typeof raw === "number" ? Math.round(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, n);
}

/**
 * Offset-style cursor over the already-ranked list. "Twenty places" is the
 * named design case this exists for (MESITA-1674's Also) — the contract had
 * no limit before this. Ranking is recomputed once per request over this
 * consumer's own lots, which credit_lots_consumer_place_idx already makes a
 * cheap indexed scan, so there is no case here for standing up a SQL view or
 * a keyset cursor only this one read would use — an opaque decimal offset is
 * simplest, and correct as long as the caller treats it as opaque.
 */
export function paginatePlaceBalances(
  ranked: CreditPlaceBalance[],
  cursor: string | null,
  limit: number,
): { page: CreditPlaceBalance[]; nextCursor: string | null } {
  const parsed = cursor ? parseInt(cursor, 10) : 0;
  const offset = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const page = ranked.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return { page, nextCursor: nextOffset < ranked.length ? String(nextOffset) : null };
}
