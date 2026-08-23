// Supabase Edge Function — check-web-request-fix (product caller: the public
// check page)
//
// verify_jwt = FALSE — code-possession auth (see _shared/ticket-check.ts).
// THE TICKET v4 (MESITA-1090): the send-back half of the staff verdict (C1).
// ONE specific fix from a closed vocabulary — bill · proof · reward — never a
// free-text rejection, never a fourth chip. The ticket STAYS at `scanned`
// with the SAME check_code: fix_requested is a column, not a status, so
// there is no new QR and no renegotiation. The guest's matching submit
// clears it and the staff screen updates live off its poll.
//
// Body:     { code, fix: "bill"|"proof"|"reward", note?, pin?, expectedUpdatedAt }
// Response: { ok: true, already? } | 400 bad fix | 404 | 409 | 429

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  checkNotFound,
  hashRequestIp,
  isRateLimited,
  loadCheckSettings,
  loadTicketByCheckCode,
  logCheckEvent,
  requireCheckPin,
} from "../_shared/ticket-check.ts";
import { TICKET_STATUS } from "../_shared/ticket-status.ts";
import { writeTicket } from "../_shared/ticket-doc.ts";

const FIXES = new Set(["bill", "proof", "reward"]);
const MAX_NOTE = 200;

type Body = {
  code?: string;
  fix?: string;
  note?: string;
  pin?: string;
  expectedUpdatedAt?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;

  // Validate the vocabulary BEFORE any DB work (smoke-tested): an unknown
  // fix is a client bug, not a lookup.
  const fix = (bodyRes.body.fix ?? "").toString();
  if (!FIXES.has(fix)) {
    return json(
      { ok: false, error: "fix must be bill, proof, or reward" },
      400,
    );
  }
  const note = (bodyRes.body.note ?? "").toString().trim();
  if (note.length > MAX_NOTE) {
    return json(
      { ok: false, error: `note must be ${MAX_NOTE} characters or fewer` },
      400,
    );
  }

  const admin = adminClient(envRes.env);
  const code = (bodyRes.body.code ?? "").toString().trim();
  if (!code) return checkNotFound(json);
  const expectedUpdatedAt = (bodyRes.body.expectedUpdatedAt ?? "").toString();
  if (!expectedUpdatedAt) {
    return json({ ok: false, error: "expectedUpdatedAt is required" }, 400);
  }

  const ipHash = await hashRequestIp(req, envRes.env.serviceKey);
  if (await isRateLimited(admin, ipHash, { maxPerMinute: 30 })) {
    return json({ ok: false, error: "Too many requests" }, 429);
  }

  const ticket = await loadTicketByCheckCode(admin, code);
  if (!ticket) return checkNotFound(json);

  const settings = await loadCheckSettings(admin, ticket.project_id);
  const pinRes = await requireCheckPin({
    admin,
    projectId: ticket.project_id,
    ticketId: ticket.id,
    pin: bodyRes.body.pin,
    ipHash,
    userAgent: req.headers.get("user-agent"),
    json,
    settings,
  });
  if (!pinRes.ok) return pinRes.response;

  if (ticket.status !== TICKET_STATUS.scanned) {
    return json(
      {
        ok: false,
        code: "stale_state",
        status: ticket.status,
        error: `Ticket is ${ticket.status} — a fix can only be requested on a scanned ticket.`,
      },
      409,
    );
  }

  // CAS: still scanned, not approved (approve⊕fix is also a DB constraint),
  // and unchanged since the staff screen rendered.
  const update = await writeTicket(admin, {
    mode: "update",
    id: ticket.id,
    patch: { fix_requested: fix as "bill" | "proof" | "reward", fix_note: note || null },
    guard: {
      eq: { status: TICKET_STATUS.scanned, updated_at: expectedUpdatedAt },
      is: { approved_at: null },
    },
    select: "id, fix_requested",
  });
  if (!update.ok) {
    return json({ ok: false, error: `ticket_update: ${update.error}` }, 500);
  }
  if (!update.row) {
    const fresh = await admin
      .from("visit_tickets")
      .select("id, status, fix_requested")
      .eq("id", ticket.id)
      .maybeSingle();
    const row = fresh.data as { status: string; fix_requested: string | null } | null;
    if (row?.fix_requested === fix) {
      // The same fix is already outstanding — a second tap is a repeat, not
      // a failure.
      return json({ ok: true, already: true });
    }
    if (row?.status === TICKET_STATUS.approved || row?.status === TICKET_STATUS.paying) {
      return json(
        { ok: false, code: "stale_state", status: row.status, error: "The ticket was already approved." },
        409,
      );
    }
    return json(
      {
        ok: false,
        code: "stale_ticket",
        error: "The ticket changed since you last saw it — review it again.",
      },
      409,
    );
  }

  const { user } = await getOptionalAuthedUser(req, envRes.env);
  await logCheckEvent(admin, {
    ticketId: ticket.id,
    event: "fix_requested",
    selfView: user?.id === ticket.consumer_id,
    ipHash,
    userAgent: req.headers.get("user-agent"),
  });

  return json({ ok: true, fix });
});
