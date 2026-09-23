// Supabase Edge Function — business-web-list-reviews
//
// Authenticated. Returns Mesita guest reviews for a held place, newest first,
// paginated. Scoped to the place's own membership, viewers included (it used
// to be the HOLDING ORGANIZATION's membership; MESITA-1892 removed that layer
// and `place_members` is the whole grant now). Google reviews are not proxied
// — operators open Google directly.
//
// check_code is a possession token for check.mesita.ai (verify_jwt=false).
// Same rule as business-web-list-tickets: never return it to viewers.
// Editors and owners get a visitUrl; viewers see reviews only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  clampIntRange,
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";
import { consumerDisplayName } from "../_shared/consumer-lookup.ts";
import { one } from "../_shared/postgrest.ts";

const CHECK_URL_BASE = "https://check.mesita.ai/";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type Body = {
  placeId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
};

type ConsumerJoin = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
};

type TicketJoin = {
  check_code?: string | null;
};

type ReviewRow = {
  id: string;
  food: number;
  service: number;
  ambience: number;
  value: number | null;
  overall: number | null;
  comments: string | null;
  created_at: string;
  ticket_id: string;
  consumer: ConsumerJoin | ConsumerJoin[] | null;
  ticket?: TicketJoin | TicketJoin[] | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const limit = clampIntRange(
    Number(bodyRes.body.limit ?? DEFAULT_LIMIT),
    1,
    MAX_LIMIT,
  );
  const offset = clampIntRange(Number(bodyRes.body.offset ?? 0), 0, 10_000);

  const admin = adminClient(envRes.env);

  // The 404 and the 403 answer two different questions, so both reads happen
  // — in parallel, because neither needs the other. `orgIdForPlace` used to
  // collapse them: a place in no organization was reported as "not found"
  // whether it existed or not, which is the honest answer to neither caller.
  //
  // THE 403 IS ANSWERED FIRST. Both reads run together, but a caller who is
  // not a member is told only that, whether the id exists or not — otherwise
  // the pair of status codes is an oracle for which place ids are real. That
  // matters less here than it would for the organization this replaced, since
  // a place's existence is public by design (the consumer catalog lists them,
  // and `business-web-list-places` scope=public answers any bearer token), so
  // this is the cheap posture rather than a hole being closed. The 404 stays
  // reachable for the caller it was written for: `requireMembership` passes a
  // super-admin with no membership row, and an operator's console asking about
  // an id that is genuinely gone deserves to be told so.
  const [placeRow, roleRes] = await Promise.all([
    admin.from("places").select("id").eq("id", placeId).maybeSingle(),
    requireMembership(admin, authRes.user, placeId),
  ]);
  if (!roleRes.ok) return roleRes.response;
  if (placeRow.error) return json({ ok: false, error: placeRow.error.message }, 500);
  if (!placeRow.data) {
    return json({ ok: false, error: "Place not found" }, 404);
  }

  // A super-admin reads as an owner would; otherwise the role IS the row.
  const mayLinkVisit = roleRes.membership.isSuperAdmin ||
    roleRes.membership.role === "owner" ||
    roleRes.membership.role === "editor";

  const select =
    "id, food, service, ambience, value, overall, comments, created_at, ticket_id, " +
    "consumer:consumers(first_name, last_name, full_name)" +
    (mayLinkVisit ? ", ticket:visit_tickets(check_code)" : "");

  const { data, error, count } = await admin
    .from("ticket_reviews")
    .select(select, { count: "exact" })
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return json({ ok: false, error: error.message }, 500);

  const rows = (data ?? []) as unknown as ReviewRow[];
  const reviews = rows.map((row) => {
    const consumer = one(row.consumer);
    let visitUrl: string | null = null;
    if (mayLinkVisit) {
      const ticket = one(row.ticket);
      const code = ticket?.check_code?.trim() ?? "";
      visitUrl = code ? `${CHECK_URL_BASE}${code}` : null;
    }
    return {
      id: row.id,
      food: row.food,
      service: row.service,
      ambience: row.ambience,
      value: row.value,
      overall: row.overall,
      comments: row.comments,
      createdAt: row.created_at,
      ticketId: row.ticket_id,
      guestName: consumer ? (consumerDisplayName(consumer) ?? "Guest") : "Guest",
      visitUrl,
    };
  });

  return json({
    ok: true,
    reviews,
    total: count ?? reviews.length,
    limit,
    offset,
  });
});
