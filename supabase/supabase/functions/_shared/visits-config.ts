// Visits config — the LOCAL context's policy: how THE TICKET behaves between
// the guest sitting down and the ticket closing itself.
//
// Mesita prices two contexts (visits and orders) and runs one journey for the
// local one: Bill · Reward · Task · QR · Pay · Validate · Results. The rungs
// that journey PAYS are the Promos grid's business; Ojo reads the proofs; this
// blob is everything else — the tip presets the guest is offered, how often
// each side polls, whether a screenshot is required, how many send-backs a
// ticket tolerates, which pay rails are open, and when an abandoned ticket
// gives up.
//
// The defaults MIRROR the constants the apps ship today, so the page describes
// the product as it is rather than proposing a different one:
//   tips            web-consumer `TIP_PRESETS` / `DEFAULT_TIP_PCT`
//   consumer poll   web-consumer TicketScreen, 10s
//   staff poll      web-check BASE_POLL_MS 3s, backing off to MAX_POLL_MS 30s
//   pay rails       cash live; card and Yums are STAGED panels
//
// Every knob is STAGED until the apps read it: the blob is live and editable,
// nothing consumes it yet, and the console says so. House rule is that an
// unenforced config is a bug — a staged one has to be labeled.
//
// NOT here, deliberately: the tip is always computed on the PRE-DISCOUNT bill
// and the floor never adjudicates a proof. Those are invariants (Product Rules
// §A), and an invariant with a toggle is not an invariant.

export type VisitsConfig = {
  tipEnabled: boolean;
  tipPresets: number[];
  defaultTipPct: number;
  consumerPollSeconds: number;
  staffPollSeconds: number;
  staffPollMaxSeconds: number;
  requireProofScreenshot: boolean;
  maxFixRequests: number;
  payCash: boolean;
  payCard: boolean;
  payYums: boolean;
  autoCloseHours: number;
  legacyV3Enabled: boolean;
  reportEnabled: boolean;
};

export const VISITS_DEFAULTS: VisitsConfig = {
  tipEnabled: true,
  tipPresets: [10, 15, 20],
  defaultTipPct: 15,
  consumerPollSeconds: 10,
  // The staff side polls fastest because approve is compare-and-swap: a stale
  // render disables the button, and 3s is what keeps it enabled at the table.
  staffPollSeconds: 3,
  staffPollMaxSeconds: 30,
  // The web UI already requires it; the EF still accepts a task without one.
  // Defaulting ON states the intent — Ojo has nothing to read otherwise.
  requireProofScreenshot: true,
  // One named fix is the design. Two is the room for an honest mistake; a
  // ticket that needs three has a problem the floor should settle in person.
  maxFixRequests: 2,
  payCash: true,
  payCard: false,
  payYums: false,
  // A ticket nobody validated is abandoned, not disputed. Long enough to
  // survive a slow table, short enough that the wallet isn't a graveyard.
  autoCloseHours: 12,
  // The v3 submit-bill / mark-paid pair, alive only for unbilled old tickets.
  legacyV3Enabled: true,
  reportEnabled: true,
};

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

/** 1–4 whole percents, ascending, deduped. An empty list falls back. */
function presets(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...VISITS_DEFAULTS.tipPresets];
  const clean = [
    ...new Set(
      raw
        .map((v) => Math.round(num(v, NaN, 0, 100)))
        .filter((v) => Number.isFinite(v)),
    ),
  ]
    .sort((a, b) => a - b)
    .slice(0, 4);
  return clean.length ? clean : [...VISITS_DEFAULTS.tipPresets];
}

/** Tolerant read: any missing/invalid key falls back to its default. */
export function normalizeVisitsConfig(raw: unknown): VisitsConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const tipPresets = presets(r.tipPresets);
  const staffPoll = Math.round(
    num(r.staffPollSeconds, VISITS_DEFAULTS.staffPollSeconds, 1, 120),
  );
  const wantedDefault = Math.round(
    num(r.defaultTipPct, VISITS_DEFAULTS.defaultTipPct, 0, 100),
  );
  return {
    tipEnabled: bool(r.tipEnabled, VISITS_DEFAULTS.tipEnabled),
    tipPresets,
    // The preselected tip must be one the guest is actually offered, or the
    // bill step opens on a value no chip can show.
    defaultTipPct: tipPresets.includes(wantedDefault)
      ? wantedDefault
      : tipPresets[0],
    consumerPollSeconds: Math.round(
      num(r.consumerPollSeconds, VISITS_DEFAULTS.consumerPollSeconds, 2, 120),
    ),
    staffPollSeconds: staffPoll,
    // The backoff ceiling can never sit below the base interval, or the
    // staff screen would back off to something faster than it started.
    staffPollMaxSeconds: Math.max(
      staffPoll,
      Math.round(
        num(r.staffPollMaxSeconds, VISITS_DEFAULTS.staffPollMaxSeconds, 1, 600),
      ),
    ),
    requireProofScreenshot: bool(
      r.requireProofScreenshot,
      VISITS_DEFAULTS.requireProofScreenshot,
    ),
    maxFixRequests: Math.round(
      num(r.maxFixRequests, VISITS_DEFAULTS.maxFixRequests, 0, 10),
    ),
    payCash: bool(r.payCash, VISITS_DEFAULTS.payCash),
    payCard: bool(r.payCard, VISITS_DEFAULTS.payCard),
    payYums: bool(r.payYums, VISITS_DEFAULTS.payYums),
    autoCloseHours: Math.round(
      num(r.autoCloseHours, VISITS_DEFAULTS.autoCloseHours, 1, 720),
    ),
    legacyV3Enabled: bool(r.legacyV3Enabled, VISITS_DEFAULTS.legacyV3Enabled),
    reportEnabled: bool(r.reportEnabled, VISITS_DEFAULTS.reportEnabled),
  };
}
