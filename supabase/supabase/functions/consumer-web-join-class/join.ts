// consumer-web-join-class's decisions (MESITA-3054, MESITA-3540), kept out of
// index.ts so every exit is tested with no network: the database calls come
// in as functions.
//
//   body ──parseJoinBody──> {via:"code",code} | {via:"leave"} | null (400)
//
//   via code: redeemCode (consumer_redeem_vip_invitation, one transaction:
//   lock the guest, 10 wrong codes an hour, use the code once, make VIP)
//     joined → 200 joined:true · already_vip → 200 joined:false ·
//     invalid → 403 invalid_code · rate_limited → 429 too_many_attempts ·
//     consumer_not_found → 404 · error → 500 join_failed
//
//   via leave: readRow (class, note) → not VIP → 200 left:false ·
//   writeClass("regular", "[left] …") → 200 left:true
//
// VIP pays for the room, a guest a partner vouches for, so followers never make
// a VIP (MESITA-3224 closed via:"instagram"; followers are Instagram Story's
// bar). Codes are issued on Admin › Guests; twelve zeros, the emulator code
// of MESITA-3071, joins nothing since MESITA-3540.

import type { ClassJoinRow, VipRedeemOutcome } from "../_shared/consumer-doc.ts";
import { parseClassCode } from "./class-code.ts";

export type JoinBody =
  | { via: "code"; code: string }
  | { via: "leave" };

export type JoinOutcome =
  | "joined"
  | "already_vip"
  | "left"
  | "already_regular"
  | "bad_request"
  | "bad_code"
  | "invalid_code"
  | "too_many_attempts"
  | "consumer_not_found"
  | "error";

export type JoinLog = {
  via: "code" | "leave" | null;
  outcome: JoinOutcome;
  cause?: "consumer_read" | "consumer_write" | "redeem";
  message?: string;
  request_id?: string;
  code_last4?: string;
};

export type JoinResult = { status: number; body: Record<string, unknown>; log: JoinLog };

export type JoinDeps = {
  redeemCode: (
    code: string,
  ) => Promise<{ ok: true; outcome: VipRedeemOutcome } | { ok: false; message: string }>;
  readRow: () => Promise<{ ok: true; row: ClassJoinRow | null } | { ok: false; message: string }>;
  writeClass: (
    guestClass: "vip" | "regular",
    note: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  requestId: string;
};

const NOTE_MAX = 280; // consumers_guest_class_note_check

/** `null` = not a join body. Only `via` and `code` are read. A malformed code
 *  still parses as `via:"code"` so the guest hears "Enter the 12-digit code.". */
export function parseJoinBody(body: unknown): JoinBody | { via: "code"; code: null } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.via === "leave") return { via: "leave" };
  if (b.via === "code") {
    const code = parseClassCode(b.code);
    return code ? { via: "code", code } : { via: "code", code: null };
  }
  return null;
}

/** The join note first, then any operator note, cut to the column's 280. */
export function mergeNote(joinNote: string, existing: string | null): string {
  const old = existing?.trim();
  const merged = old ? `${joinNote} · ${old}` : joinNote;
  return merged.length <= NOTE_MAX ? merged : `${merged.slice(0, NOTE_MAX - 1)}…`;
}

const fail = (
  status: number,
  code: string,
  error: string,
  log: JoinLog,
  extra: Record<string, unknown> = {},
): JoinResult => ({ status, body: { ok: false, code, error, ...extra }, log });

const JOIN_FAILED = "Couldn't change your class right now. Try again.";
const LEFT_NOTE = "[left] Left VIP";

export async function handleJoin(rawBody: unknown, deps: JoinDeps): Promise<JoinResult> {
  const body = parseJoinBody(rawBody);
  if (!body) {
    return fail(400, "bad_request", 'Body must be {via:"code",code} or {via:"leave"}.', {
      via: null,
      outcome: "bad_request",
    });
  }
  if (body.via === "code") {
    if (body.code === null) {
      return fail(400, "bad_code", "Enter the 12-digit code.", { via: "code", outcome: "bad_code" });
    }
    return await joinWithCode(body.code, deps);
  }
  return await leave(deps);
}

async function joinWithCode(code: string, deps: JoinDeps): Promise<JoinResult> {
  const via = "code" as const;
  const last4 = { code_last4: code.slice(-4) };
  const res = await deps.redeemCode(code);
  if (!res.ok) {
    return fail(500, "join_failed", JOIN_FAILED, {
      via,
      outcome: "error",
      cause: "redeem",
      message: res.message,
      request_id: deps.requestId,
      ...last4,
    }, { request_id: deps.requestId });
  }
  switch (res.outcome) {
    case "joined":
      return {
        status: 200,
        body: { ok: true, guest_class: "vip", joined: true },
        log: { via, outcome: "joined", ...last4 },
      };
    // A VIP whose cached page still says Regular lands on VIP; the code is
    // left unused.
    case "already_vip":
      return {
        status: 200,
        body: { ok: true, guest_class: "vip", joined: false },
        log: { via, outcome: "already_vip", ...last4 },
      };
    // Unknown, used and revoked read the same, so a typed code never says
    // whether it exists. The attempt log keeps which.
    case "invalid":
      return fail(403, "invalid_code", "That code isn't valid.", {
        via,
        outcome: "invalid_code",
        ...last4,
      });
    case "rate_limited":
      return fail(429, "too_many_attempts", "Too many codes tried. Try again in an hour.", {
        via,
        outcome: "too_many_attempts",
        ...last4,
      });
    case "consumer_not_found":
      return fail(404, "consumer_not_found", "Your account isn't active. Sign in again.", {
        via,
        outcome: "consumer_not_found",
      });
  }
}

// Leaving VIP (Pato, MESITA-3054: "in the weird case someone wishes to"):
// back to Regular, the partner and last day cleared by the RPC.
async function leave(deps: JoinDeps): Promise<JoinResult> {
  const via = "leave" as const;
  const read = await deps.readRow();
  if (!read.ok) {
    return fail(500, "join_failed", JOIN_FAILED, {
      via,
      outcome: "error",
      cause: "consumer_read",
      message: read.message,
      request_id: deps.requestId,
    }, { request_id: deps.requestId });
  }
  const row = read.row;
  if (!row) {
    return fail(404, "consumer_not_found", "Your account isn't active. Sign in again.", {
      via,
      outcome: "consumer_not_found",
    });
  }
  if (row.guest_class !== "vip") {
    return {
      status: 200,
      body: { ok: true, guest_class: "regular", left: false },
      log: { via, outcome: "already_regular" },
    };
  }
  const left = await deps.writeClass("regular", mergeNote(LEFT_NOTE, row.guest_class_note));
  if (!left.ok) {
    return fail(500, "join_failed", JOIN_FAILED, {
      via,
      outcome: "error",
      cause: "consumer_write",
      message: left.message,
      request_id: deps.requestId,
    }, { request_id: deps.requestId });
  }
  return {
    status: 200,
    body: { ok: true, guest_class: "regular", left: true },
    log: { via, outcome: "left" },
  };
}
