// Supabase Edge Function — consumer-web-list-credit-balances (MESITA-1674)
//
// Naming: caller-verb-words. Caller = consumer, verb = list, words =
// credit-balances.
//
// The Wallet's real balance read. Pay > Wallet ran on a browser emulator
// (src/lib/mock/*, deleted this issue) until now — every one of the calling
// consumer's credit_lots rows, grouped by ORGANIZATION (credit_lots is
// org-scoped, MESITA-1671: one Credit balance spends at any of that
// organization's places), ranked spendable-first, paginated (this issue's
// "Also": "twenty orgs" is a named design case and the contract had no limit
// before this).
//
// PENDING LOTS SURFACE HERE, EVEN THOUGH THE BUY PATH DOES NOT WRITE ANY
// TODAY. consumer-web-buy-credits sets activates_at = now (MESITA-1676's
// "credits activate immediately" decision) — but the schema itself still
// supports a future activates_at (the hold column never left, only went
// unapplied there), so any OTHER writer of credit_lots — an admin-issued lot,
// a redeemed gift with its own hold (MESITA-1677) — can produce one, and this
// read must not assume every lot it sees is already live. The response
// carries `serverNowMs` so the client's countdowns anchor to the SAME clock
// this pending/expired split was computed against, never the guest's own.
//
// NO SPEND HERE. This is read-only; spend-at-the-table (MESITA-1678) is a
// separate, still-unbuilt engine (blocked on who funds the bonus). A balance
// this EF reports is exactly what credit_ledger already agrees it is —
// nothing here writes.
//
// Body:     { cursor?: string, limit?: number }
// Response: { ok: true, organizations: CreditOrgBalance[], nextCursor: string | null, serverNowMs: number }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { loadVisitsConfig } from "../_shared/visits-config.ts";
import { organizationsAcceptingCredits } from "../_shared/credits-readiness.ts";
import {
  clampLimit,
  type CreditLotRow,
  groupCreditLotsByOrganization,
  paginateOrgBalances,
  rankOrgBalances,
} from "../_shared/credits-balances.ts";

type Body = { cursor?: unknown; limit?: unknown };

type LotRow = {
  id: string;
  organization_id: string;
  paid_cents: number;
  bonus_cents: number;
  spent_cents: number;
  currency: string;
  activates_at: string;
  expires_at: string;
  created_at: string;
};

// A hard safety cap on the whole per-consumer scan, not a page size — this
// consumer's own lots are the ONLY rows this reads
// (credit_lots_consumer_org_idx makes it an indexed range scan), and even a
// guest who bought Credits daily for a year sits nowhere near this. It exists
// so a corrupted account can never turn this into an unbounded read; ranking
// and pagination both happen AFTER this fetch, in memory.
const MAX_LOTS_SCANNED = 2000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const cursor = typeof body.cursor === "string" && body.cursor.trim()
    ? body.cursor.trim()
    : null;
  const limit = clampLimit(body.limit);

  const admin = adminClient(envRes.env);
  const nowMs = Date.now();

  const lots = await admin
    .from("credit_lots")
    .select(
      "id, organization_id, paid_cents, bonus_cents, spent_cents, currency, activates_at, expires_at, created_at",
    )
    .eq("consumer_id", authRes.user.id)
    .order("organization_id", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(MAX_LOTS_SCANNED);
  if (lots.error) {
    return json(
      { ok: false, error: `credit_balances_lookup: ${lots.error.message}` },
      500,
    );
  }

  const rows: CreditLotRow[] = ((lots.data ?? []) as LotRow[]).map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    paidCents: r.paid_cents,
    bonusCents: r.bonus_cents,
    spentCents: r.spent_cents,
    currency: r.currency,
    activatesAt: r.activates_at,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));

  if (rows.length === 0) {
    return json({
      ok: true,
      organizations: [],
      nextCursor: null,
      serverNowMs: nowMs,
    });
  }

  const organizationIds = [...new Set(rows.map((r) => r.organizationId))];

  const [orgsRes, visitsConfig] = await Promise.all([
    admin.from("organizations").select("id, name").in("id", organizationIds),
    loadVisitsConfig(admin),
  ]);
  if (orgsRes.error) {
    return json(
      { ok: false, error: `credit_balances_orgs: ${orgsRes.error.message}` },
      500,
    );
  }
  const orgNames = new Map(
    ((orgsRes.data ?? []) as { id: string; name: string }[]).map((
      o,
    ) => [o.id, o.name]),
  );

  const acceptsMore = await organizationsAcceptingCredits(
    admin,
    organizationIds,
    visitsConfig.payCredits,
  );

  const grouped = groupCreditLotsByOrganization(
    rows,
    orgNames,
    acceptsMore,
    nowMs,
  );
  const ranked = rankOrgBalances(grouped);
  const { page, nextCursor } = paginateOrgBalances(ranked, cursor, limit);

  return json({
    ok: true,
    organizations: page,
    nextCursor,
    serverNowMs: nowMs,
  });
});
