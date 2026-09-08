// Shape of get_credit_liability's JSON, mirrored here for the client.
// Deliberately NOT in actions.ts: that file is "use server", and a Server
// Actions module may export only async functions (same reasoning
// controls-config/defaults.ts gives for its own split).

export type CreditLiabilityByCurrency = {
  currency: string;
  issuedCents: number;
  outstandingCents: number;
  /** null when no lot at this currency is still in its hold window. */
  pendingCents: number | null;
  pendingLotCount: number;
  breakageCents: number;
  lotCount: number;
};

export type CreditLiabilityByOrganization = {
  organizationId: string;
  organizationName: string;
  currency: string;
  issuedCents: number;
  outstandingCents: number;
  lotCount: number;
  /** true when a lot's own currency disagrees with its organization's —
   *  nothing upstream enforces the two match; this surfaces the drift. */
  currencyMismatch: boolean;
};

export type CreditLiability = {
  byCurrency: CreditLiabilityByCurrency[];
  byOrganization: CreditLiabilityByOrganization[];
  /** null = the forfeit-vs-return decision is still open; the expiry sweep
   *  is a documented no-op until this is set. 'forfeit' | 'return_paid'. */
  expiryDisposition: string | null;
  generatedAt: string;
};
