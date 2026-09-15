// Supabase Edge Function — consumer-web-list-credit-balances (MESITA-1674)
//
// Naming: caller-verb-words. Caller = consumer, verb = list, words =
// credit-balances.
//
// The Wallet's real balance read. Pay > Wallet ran on a browser emulator
// (src/lib/mock/*, deleted in MESITA-1674) until then — every one of the
// calling consumer's credit_lots rows, grouped by PLACE (credit_lots is
// place-scoped, MESITA-1892: a balance is a debt to this guest at ONE
// venue), ranked spendable-first, paginated (MESITA-1674's "Also": "twenty
// orgs" was a named design case and the contract had no limit before it;
// twenty PLACES is if anything the likelier shape).
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
// THE PLACE IS THE MONEY BOUNDARY *AND* THE FACE. MESITA-1816 gave a
// one-place organization's balance the place's name and photo, and kept an
// else-branch for the multi-place case. MESITA-1892 removed the layer that
// branch described, so every balance simply carries its place's `name` and
// `photos[0]` — ONE `place_profiles` read across the whole page, keyed by the
// place ids the lots already name. No `places` hop is needed any more: the
// lot names the place directly, and name/photos live on place_profiles
// (selecting them off `places` 42703s, MESITA-1781).
//
// NO GRAND TOTAL, BY CONSTRUCTION. This response is a PAGE, so any sum across
// `places` would be a sum of an arbitrary slice presented as the guest's
// whole position. Currencies can differ per place too. The client renders per
// balance and nothing else.
//
// NO SPEND HERE. This is read-only; spend-at-the-table (MESITA-1678) is a
// separate engine. A balance this EF reports is exactly what credit_ledger
// already agrees it is — nothing here writes.
//
// Body:     { cursor?: string, limit?: number }
// Response: { ok: true, places: CreditPlaceBalance[], nextCursor: string | null, serverNowMs: number }
//   CreditPlaceBalance carries placeName and photoUrl — see _shared/credits-balances.ts.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { loadVisitsConfig } from "../_shared/visits-config.ts";
import { placesAcceptingCredits } from "../_shared/credits-readiness.ts";
import {
  clampLimit,
  type CreditBalanceFace,
  type CreditLotRow,
  groupCreditLotsByPlace,
  paginatePlaceBalances,
  rankPlaceBalances,
} from "../_shared/credits-balances.ts";

type Body = { cursor?: unknown; limit?: unknown };

type LotRow = {
  id: string;
  place_id: string;
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
// (credit_lots_consumer_place_idx makes it an indexed range scan), and even a
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
      "id, place_id, paid_cents, bonus_cents, spent_cents, currency, activates_at, expires_at, created_at",
    )
    .eq("consumer_id", authRes.user.id)
    .order("place_id", { ascending: true })
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
    placeId: r.place_id,
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
      places: [],
      nextCursor: null,
      serverNowMs: nowMs,
    });
  }

  const placeIds = [...new Set(rows.map((r) => r.placeId))];

  const [profilesRes, visitsConfig] = await Promise.all([
    admin.from("place_profiles").select("id, name, photos").in("id", placeIds),
    loadVisitsConfig(admin),
  ]);
  if (profilesRes.error) {
    return json(
      { ok: false, error: `credit_balances_places: ${profilesRes.error.message}` },
      500,
    );
  }
  const faces = new Map<string, CreditBalanceFace>();
  for (
    const p of (profilesRes.data ?? []) as {
      id: string;
      name: string;
      photos: string[] | null;
    }[]
  ) {
    faces.set(p.id, {
      name: p.name ?? "",
      photoUrl: Array.isArray(p.photos) && p.photos.length > 0
        ? p.photos[0]
        : null,
    });
  }

  const acceptsMore = await placesAcceptingCredits(
    admin,
    placeIds,
    visitsConfig.payCredits,
  );

  const grouped = groupCreditLotsByPlace(rows, faces, acceptsMore, nowMs);
  const ranked = rankPlaceBalances(grouped);
  const { page, nextCursor } = paginatePlaceBalances(ranked, cursor, limit);

  return json({
    ok: true,
    places: page,
    nextCursor,
    serverNowMs: nowMs,
  });
});
