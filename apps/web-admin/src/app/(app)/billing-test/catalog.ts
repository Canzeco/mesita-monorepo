// Shared shape for the Billing Test page. Mirrors what
// admin-web-check-api-health returns, plus the coercion the client needs so a
// half-shaped EF response renders instead of throwing.

export type Verdict = "ok" | "degraded" | "down" | "unconfigured";

export type ProbeResult = {
  id: string;
  label: string;
  impact: string;
  verdict: Verdict;
  envKeys: string[];
  httpStatus: number | null;
  latencyMs: number | null;
  detail: string;
};

/**
 * The providers the page can offer before it has ever heard from the EF.
 * Kept in sync with the PROBES registry in the Edge Function by hand — the
 * page must be able to render its cards (and its Run buttons) while the probe
 * backend is unreachable.
 *
 * There is no free/paid split here on purpose: two of these vendors expose no
 * unbilled endpoint that proves a key still works, so probing them costs a
 * token or a request unit — a rounding error against not knowing which vendor
 * went dark. One button runs the lot.
 */
export const KNOWN_PROBES: ReadonlyArray<{
  id: string;
  label: string;
  impact: string;
}> = [
  {
    id: "firecrawl",
    label: "Firecrawl",
    impact: "Enricher link discovery (S4 gather) — fails SOFT, returns no links",
  },
  { id: "apify", label: "Apify", impact: "Enricher Instagram/actor scraping" },
  {
    id: "twilio",
    label: "Twilio",
    impact: "Phone OTP — the ONLY consumer sign-in. Dead key = nobody logs in",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    impact: "Reservationist voice agents (a1–a4)",
  },
  {
    id: "openai",
    label: "OpenAI",
    impact: "Memo airlock (parked) — not yet load-bearing",
  },
  {
    id: "stripe",
    label: "Stripe",
    impact: "Business plans + consumer Premium subscriptions",
  },
  {
    id: "perplexity",
    label: "Perplexity",
    impact: "Memo answers + Enricher S5 (Agent Y link select)",
  },
  {
    id: "google-places",
    label: "Google Places",
    impact: "Identity spine for Atlas and the Enricher",
  },
];

/** Every probe id, in registry order — what the one Run button sends. */
export const ALL_PROBE_IDS: readonly string[] = KNOWN_PROBES.map((p) => p.id);

const VERDICTS: ReadonlySet<string> = new Set([
  "ok",
  "degraded",
  "down",
  "unconfigured",
]);

function pickString(row: Record<string, unknown>, key: string, fallback: string): string {
  const v = row[key];
  return typeof v === "string" && v.trim() ? v : fallback;
}

function pickNumber(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Defensive read of the EF payload — an unknown provider id still renders. */
export function coerceResults(raw: unknown): ProbeResult[] {
  if (!Array.isArray(raw)) return [];
  const out: ProbeResult[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : null;
    if (!id) continue;
    const known = KNOWN_PROBES.find((p) => p.id === id);
    const verdict = typeof row.verdict === "string" && VERDICTS.has(row.verdict)
      ? (row.verdict as Verdict)
      : "down";
    out.push({
      id,
      label: pickString(row, "label", known?.label ?? id),
      impact: pickString(row, "impact", known?.impact ?? ""),
      verdict,
      envKeys: Array.isArray(row.envKeys)
        ? row.envKeys.filter((k): k is string => typeof k === "string")
        : [],
      httpStatus: pickNumber(row, "httpStatus"),
      latencyMs: pickNumber(row, "latencyMs"),
      detail: pickString(row, "detail", "No detail returned."),
    });
  }
  return out;
}
