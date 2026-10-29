// consumer-web-join-class's decisions (MESITA-3054), kept out of index.ts so
// every exit is tested with no network: the two reads and the write come in
// as functions.
//
//   body ──parseJoinBody──> {via:"code",code} | {via:"instagram"} | null (400)
//          │
//          ▼ readRow (one read: class, Instagram, note)
//   error → 500 join_failed · none → 404 · VIP → 200 joined:false
//          │
//          ▼ via instagram: decideInstagram (the STORED handle and count)
//   no handle → 403 · null count → 403 · < bar → 403 · ≥ bar ─┐
//          ▼ via code: only EMULATOR_CODE (twelve zeros, MESITA-3071) │
//            joins; any other twelve digits → 403 invalid_code    │
//   writeClass("vip", note) ◄─────────────────────────────────────┘
//   error → 500 join_failed · ok → 200 joined:true
//
//   via leave (after the row read): not VIP → 200 left:false ·
//   writeClass("regular", "[left] …") → 200 left:true
//
// The note is tagged, [code:emulated] or [instagram:typed], so the VIPs of
// the testing period are found and demoted in one query before VIP grants
// anything real (MESITA-3055). It goes in front of any operator note.

import type { ClassJoinRow } from "../_shared/consumer-doc.ts";
import { INSTAGRAM_REACH_FOLLOWERS } from "../_shared/instagram-reach.ts";
import { parseClassCode } from "./class-code.ts";

/** The one code the emulator accepts until partners issue real ones
 *  (Pato, MESITA-3071: "for the moment use emulator code … 12 zeros to
 *  accept upgrade"; real one-use codes are MESITA-3055). */
export const EMULATOR_CODE = "000000000000";

export type JoinBody =
  | { via: "code"; code: string }
  | { via: "instagram" }
  | { via: "leave" };

export type JoinOutcome =
  | "joined"
  | "already_vip"
  | "left"
  | "already_regular"
  | "bad_request"
  | "bad_code"
  | "invalid_code"
  | "consumer_not_found"
  | "instagram_not_connected"
  | "followers_unknown"
  | "not_enough_followers"
  | "error";

export type JoinLog = {
  via: "code" | "instagram" | "leave" | null;
  outcome: JoinOutcome;
  cause?: "consumer_read" | "consumer_write";
  message?: string;
  request_id?: string;
  code_last4?: string;
};

export type JoinResult = { status: number; body: Record<string, unknown>; log: JoinLog };

export type JoinDeps = {
  readRow: () => Promise<{ ok: true; row: ClassJoinRow | null } | { ok: false; message: string }>;
  writeClass: (
    guestClass: "vip" | "regular",
    note: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  requestId: string;
};

const NOTE_MAX = 280; // consumers_guest_class_note_check

/** `null` = not a join body. Only `via` and `code` are read: a handle or a
 *  follower count in the body is never looked at. A malformed code still
 *  parses as `via:"code"` so the guest hears "Enter the 12-digit code.". */
export function parseJoinBody(body: unknown): JoinBody | { via: "code"; code: null } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.via === "instagram") return { via: "instagram" };
  if (b.via === "leave") return { via: "leave" };
  if (b.via === "code") {
    const code = parseClassCode(b.code);
    return code ? { via: "code", code } : { via: "code", code: null };
  }
  return null;
}

export type InstagramDecision =
  | { ok: true; handle: string; followers: number }
  | { ok: false; code: "instagram_not_connected" | "followers_unknown" }
  | { ok: false; code: "not_enough_followers"; followers: number };

/** The bar is inclusive: exactly `needed` followers joins. */
export function decideInstagram(
  row: Pick<ClassJoinRow, "instagram_handle" | "instagram_followers_count">,
  needed: number = INSTAGRAM_REACH_FOLLOWERS,
): InstagramDecision {
  const handle = row.instagram_handle;
  if (!handle) return { ok: false, code: "instagram_not_connected" };
  const followers = row.instagram_followers_count;
  if (followers === null || followers === undefined) return { ok: false, code: "followers_unknown" };
  if (followers < needed) return { ok: false, code: "not_enough_followers", followers };
  return { ok: true, handle, followers };
}

export function codeJoinNote(code: string): string {
  return `[code:emulated] Joined with code …${code.slice(-4)}`;
}

export function instagramJoinNote(handle: string, followers: number): string {
  return `[instagram:typed] Joined via Instagram @${handle} (${followers.toLocaleString("en-US")} followers)`;
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
    return fail(400, "bad_request", 'Body must be {via:"code",code} or {via:"instagram"}.', {
      via: null,
      outcome: "bad_request",
    });
  }
  const via = body.via;
  if (body.via === "code" && body.code === null) {
    return fail(400, "bad_code", "Enter the 12-digit code.", { via, outcome: "bad_code" });
  }
  const last4 = body.via === "code" ? { code_last4: body.code.slice(-4) } : {};
  if (body.via === "code" && body.code !== EMULATOR_CODE) {
    return fail(403, "invalid_code", "That code isn't valid.", {
      via,
      outcome: "invalid_code",
      ...last4,
    });
  }

  const read = await deps.readRow();
  if (!read.ok) {
    return fail(500, "join_failed", JOIN_FAILED, {
      via,
      outcome: "error",
      cause: "consumer_read",
      message: read.message,
      request_id: deps.requestId,
      ...last4,
    }, { request_id: deps.requestId });
  }
  const row = read.row;
  if (!row) {
    return fail(404, "consumer_not_found", "Your account isn't active. Sign in again.", {
      via,
      outcome: "consumer_not_found",
    });
  }
  // Leaving VIP (Pato, MESITA-3054: "in the weird case someone wishes to"):
  // back to Regular, the partner and last day cleared by the RPC.
  if (body.via === "leave") {
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

  // Before any follower check: a VIP whose cached page still says Regular
  // must land on VIP, not on "Needs 1,000 followers".
  if (row.guest_class === "vip") {
    return {
      status: 200,
      body: { ok: true, guest_class: "vip", joined: false },
      log: { via, outcome: "already_vip", ...last4 },
    };
  }

  let joinNote: string;
  if (body.via === "instagram") {
    const d = decideInstagram(row);
    if (!d.ok) {
      if (d.code === "instagram_not_connected") {
        return fail(403, d.code, "Connect Instagram first.", { via, outcome: d.code });
      }
      if (d.code === "followers_unknown") {
        return fail(403, d.code, "We couldn't read your follower count.", { via, outcome: d.code });
      }
      if (d.code !== "not_enough_followers") throw new Error("unreachable");
      return fail(
        403,
        d.code,
        `Needs ${INSTAGRAM_REACH_FOLLOWERS.toLocaleString("en-US")} followers.`,
        { via, outcome: d.code },
        { followers: d.followers, needed: INSTAGRAM_REACH_FOLLOWERS },
      );
    }
    joinNote = instagramJoinNote(d.handle, d.followers);
  } else {
    joinNote = codeJoinNote(body.code);
  }

  const write = await deps.writeClass("vip", mergeNote(joinNote, row.guest_class_note));
  if (!write.ok) {
    return fail(500, "join_failed", JOIN_FAILED, {
      via,
      outcome: "error",
      cause: "consumer_write",
      message: write.message,
      request_id: deps.requestId,
      ...last4,
    }, { request_id: deps.requestId });
  }
  return {
    status: 200,
    body: { ok: true, guest_class: "vip", joined: true },
    log: { via, outcome: "joined", ...last4 },
  };
}
