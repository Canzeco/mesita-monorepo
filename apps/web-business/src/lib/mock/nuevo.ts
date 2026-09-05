// Mock org #2 — the DAY-ONE story: just claimed a place, no payment
// account, nobody invited, nothing has happened. Every route must render
// this org too; it is the state the first real user will actually see.
import type { OrgData } from "@/lib/model/types";

export const nuevo: OrgData = {
  organization: {
    id: "org-nuevo",
    name: "La Nueva",
    legalName: "La Nueva (mock)",
    rfc: "RFC-MOCK-NV2026",
    currency: "MXN",
    rung: "verified",
  },
  paymentAccount: {
    state: "none",
    bank: null,
    clabeLast4: null,
    payoutSchedule: null,
    creditsLiabilityCents: 0,
    creditsBonusPct: 5,
    creditsRecurringBonusPct: 10,
    creditsHoldHours: 3,
    creditsExpiryDays: 90,
  },
  commercial: {
    aggression: 0,
    discountCapMxn: null,
    pass: null,
    orderFees: null,
  },
  members: [
    {
      id: "m1",
      name: "Nuevo Dueño",
      email: "dueno@mock.mx",
      role: "owner",
      placeIds: null,
    },
  ],
  places: [],
  events: [],
  viewerRole: "owner",
  statsToday: { covers: 0, discountsFundedCents: 0 },
};
