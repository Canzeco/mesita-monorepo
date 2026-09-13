// Pure grouping/ranking/pagination for the Wallet's real balance read
// (consumer-web-list-credit-balances, MESITA-1674). Kept out of the EF's
// index.ts so the ranking rule is unit-testable without a live DB — the same
// split credits-readiness.ts and credits-packages.ts already use.
//
// ORG-SCOPED, MIRRORING THE SCHEMA. credit_lots is org-scoped (MESITA-1671):
// a guest's Credits at one organization are ONE balance no matter how many
// lots fund it or how many of that org's places they were bought at. This
// module groups a flat lot list (one consumer's rows, however many
// organizations they span) into one summary per organization.
//
// BALANCE IS STILL DERIVED, NEVER CACHED. Same rule the schema comment on
// credit_lots makes: nothing here is written back. `remainingCents` is
// computed fresh from paid/bonus/spent every time this module runs.
//
// THE ORGANIZATION IS THE MONEY BOUNDARY, NOT ALWAYS THE FACE (MESITA-1816).
// Pato, 2026-09-13: "too complex for one organization to manage multiple
// places too. It's just too enterprise." The ledger stays org-scoped — the
// organization is who owes the guest — but while it holds exactly ONE place
// the guest never needs the word: every balance carries `placeCount` and,
// at one, that `place` (name and its own photo), so the Wallet can title the
// card with the place and show the place's art. At two or more the card is
// the organization's, as before.

export type CreditLotRow = {
  id: string;
  organizationId: string;
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

/** The one place a single-place organization holds, for the card's face. */
export type CreditBalancePlace = {
  id: string;
  name: string;
  /** `photos[0]`, ONE string — the same rule business-web-list-places states. Null when the place has none. */
  photoUrl: string | null;
};

export type CreditOrgBalance = {
  organizationId: string;
  organizationName: string;
  /** How many places the organization holds today. 0 is possible (a place released after the purchase) and renders as the organization. */
  placeCount: number;
  /** The organization's ONE place when placeCount === 1, else null. The Wallet wears it as the balance's face (MESITA-1816). */
  place: CreditBalancePlace | null;
  currency: string;
  /** Sum of remainingCents across every lot — spendable, pending or expired. An org with only dead lots still reports what was there, the same continuity the old per-place BalanceCard kept. */
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
  /** Whether Buy would still work at this organization today (organizationsAcceptingCredits). A balance renders regardless — this only gates the "buy more" affordance. */
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

/** Every place an organization holds, name-sorted; the caller builds it from
 *  one `places` read across all the organizations on the page. */
export type OrgPlaces = ReadonlyMap<string, readonly CreditBalancePlace[]>;

export function groupCreditLotsByOrganization(
  rows: CreditLotRow[],
  orgNames: ReadonlyMap<string, string>,
  acceptsMore: ReadonlySet<string>,
  nowMs: number,
  orgPlaces: OrgPlaces = new Map(),
): CreditOrgBalance[] {
  const byOrg = new Map<string, CreditLotSummary[]>();
  const currencyByOrg = new Map<string, string>();
  for (const row of rows) {
    const list = byOrg.get(row.organizationId) ?? [];
    list.push(summarizeLot(row, nowMs));
    byOrg.set(row.organizationId, list);
    if (!currencyByOrg.has(row.organizationId)) {
      currencyByOrg.set(row.organizationId, row.currency);
    }
  }

  const out: CreditOrgBalance[] = [];
  for (const [organizationId, lots] of byOrg) {
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
    const places = orgPlaces.get(organizationId) ?? [];
    out.push({
      organizationId,
      organizationName: orgNames.get(organizationId) ?? "A Mesita organization",
      placeCount: places.length,
      place: places.length === 1 ? places[0] : null,
      currency: currencyByOrg.get(organizationId) ?? "MXN",
      totalCents,
      spendableCents,
      pendingCents,
      paidCents,
      nearestExpiryAt: Number.isFinite(nearestExpiryMs) ? new Date(nearestExpiryMs).toISOString() : null,
      nearestActivationAt: Number.isFinite(nearestActivationMs) ? new Date(nearestActivationMs).toISOString() : null,
      acceptsMoreCredits: acceptsMore.has(organizationId),
      lots: [...lots].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    });
  }
  return out;
}

/**
 * Spendable orgs first, then pending-only, then dead money — the same
 * three-tier "spendable sinks last when expired" rule BalanceList's
 * rankBalances applied per-place, now per-organization, with a middle tier
 * for money that exists but has not matured yet. Ties break on totalCents
 * desc, then name asc, so the order is fully deterministic across pages —
 * required for the offset cursor below to mean the same thing on every call.
 */
export function rankOrgBalances(orgs: CreditOrgBalance[]): CreditOrgBalance[] {
  const tier = (o: CreditOrgBalance) => (o.spendableCents > 0 ? 0 : o.pendingCents > 0 ? 1 : 2);
  return [...orgs].sort((a, b) => {
    const t = tier(a) - tier(b);
    if (t !== 0) return t;
    if (b.totalCents !== a.totalCents) return b.totalCents - a.totalCents;
    return a.organizationName.localeCompare(b.organizationName);
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
 * Offset-style cursor over the already-ranked list. "Twenty orgs" is the
 * named design case this exists for (MESITA-1674's Also) — the contract had
 * no limit before this. Ranking is recomputed once per request over this
 * consumer's own lots, which credit_lots_consumer_org_idx already makes a
 * cheap indexed scan, so there is no case here for standing up a SQL view or
 * a keyset cursor only this one read would use — an opaque decimal offset is
 * simplest, and correct as long as the caller treats it as opaque.
 */
export function paginateOrgBalances(
  ranked: CreditOrgBalance[],
  cursor: string | null,
  limit: number,
): { page: CreditOrgBalance[]; nextCursor: string | null } {
  const parsed = cursor ? parseInt(cursor, 10) : 0;
  const offset = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const page = ranked.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return { page, nextCursor: nextOffset < ranked.length ? String(nextOffset) : null };
}
