// The TARGET business model (decided 2026-09-05 — see gstack decisions
// 8ae0d87b/4acf5a92/b359c41d/7011ee70). This file is the CONTRACT: the
// mock layer implements it today, and the future Edge Function client must
// satisfy the exact same types. It deliberately diverges from the shipped
// `projects` schema — that divergence is the point of the mock era.
//
//   Organization = one legal person = one RFC = one Stripe account
//   ├── Members      who can touch it
//   ├── Finances     payment account + Credits ledger/terms (pooled → account)
//   ├── Commercial   what a guest pays (org-wide, never per place)
//   ├── Places       what each address is and does
//   └── Activity     what happened (events stamp organization_id)

/** Ladder rung. Listed = Atlas found it · Verified = ownership proven ·
 *  Partner = live Stripe Connect (funds guests + takes money). */
export type Rung = "listed" | "verified" | "partner";

/** Stripe Connect account lifecycle — not a boolean. `charges_only` means
 *  money can land but not pay out: cash-in must stay blocked there. */
export type PaymentAccountState =
  | "none"
  | "pending"
  | "charges_only"
  | "live"
  | "restricted";

/** Future auth gating rides on this from day one (mock era: always owner). */
export type ViewerRole = "owner" | "manager" | "staff";

export interface Organization {
  id: string;
  name: string;
  legalName: string;
  rfc: string;
  currency: "MXN";
  rung: Rung;
}

/** Finances. Credits terms live HERE, not in Commercial: anything pooled
 *  is configured where it is pooled, and the balance pools at the account. */
export interface PaymentAccount {
  state: PaymentAccountState;
  bank: string | null;
  clabeLast4: string | null;
  payoutSchedule: string | null;
  creditsLiabilityCents: number;
  creditsBonusPct: number;
  creditsRecurringBonusPct: number;
  creditsHoldHours: number;
  creditsExpiryDays: number;
}

/** Commercial config is org-wide. It must NEVER grow a placeId — a
 *  per-place price override would reinvent Programs. */
export interface Commercial {
  /** 0-100. Replaces the four named presets; landmarks are labels only. */
  aggression: number;
  discountCapMxn: number | null;
  pass: {
    enabled: boolean;
    priceCents: number;
    period: "month";
    grantsBonusPct: number;
  } | null;
  orderFees: {
    pickupFeeCents: number;
    pickupMinCents: number;
    deliveryFeeCents: number;
    deliveryMinCents: number;
    freeOverCents: number | null;
  } | null;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "editor";
  /** null = every place in the org. */
  placeIds: string[] | null;
}

/** What this address DOES. Capability bits only — never prices. */
export interface PlaceServices {
  reservations: boolean;
  pickup: boolean;
  delivery: boolean;
  acceptsCards: boolean;
  acceptsCredits: boolean;
  sellsCreditsCash: boolean;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  coversToday: number;
  services: PlaceServices;
  verified: boolean;
  verifiedAt: string | null;
}

export type EventKind = "ticket" | "reservation" | "order";

/** Events stamp organization_id (denormalized on purpose): history stays
 *  with whoever owned the place at the time. Config joins, events stamp. */
export interface EventRow {
  id: string;
  kind: EventKind;
  placeId: string;
  organizationId: string;
  at: string;
  label: string;
  amountCents: number | null;
  discountPct: number | null;
}

export interface OrgData {
  organization: Organization;
  paymentAccount: PaymentAccount;
  commercial: Commercial;
  members: Member[];
  places: Place[];
  events: EventRow[];
  viewerRole: ViewerRole;
  statsToday: { covers: number; discountsFundedCents: number };
}
