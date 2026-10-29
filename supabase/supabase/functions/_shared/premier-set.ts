// MESITA-3090: admin-web-grant-place-premier action "set" — the reply for
// each premier_set_grant refusal. The SQL raises a fixed
// "premier_set_grant: …" message per refusal (migration
// 20261030001000_premier_set_grant.sql); this maps each to an HTTP status,
// a stable code and the line the Multiple Places row shows. Matched on the
// full prefixed message, most specific first, so an unrelated database
// error that happens to say "archived" stays a 500.

export type SetFailure = { status: number; code: string; error: string };

const REFUSALS: readonly { prefix: string; status: number; code: string; error: string }[] = [
  {
    prefix: "premier_set_grant: a guest is checking out",
    status: 409,
    code: "guest_checking_out",
    error: "A guest is paying for this place's Premier right now — try again in 30 minutes or use Single Place",
  },
  {
    prefix: "premier_set_grant: a guest pays",
    status: 409,
    code: "guest_pays",
    error: "A guest pays for this place's Premier — change it in Single Place",
  },
  {
    prefix: "premier_set_grant: guests are waiting to pay",
    status: 409,
    code: "guests_waiting",
    error: "Guests are waiting to pay for this place's Premier — change it in Single Place",
  },
  { prefix: "premier_set_grant: archived", status: 409, code: "place_archived", error: "Archived — not granted" },
  { prefix: "premier_set_grant: no such place", status: 404, code: "place_not_found", error: "Not on Mesita" },
];

export function setFailure(message: string, placeId: string): SetFailure {
  for (const r of REFUSALS) {
    if (message.includes(r.prefix)) return { status: r.status, code: r.code, error: r.error };
  }
  // The RPC's own tier/months checks are the backstop to the EF's; their
  // message carries the value received.
  if (message.includes("premier_set_grant: tier must")) {
    return { status: 400, code: "tier_invalid", error: message.slice(message.indexOf("premier_set_grant: ")) };
  }
  if (message.includes("premier_set_grant: months must")) {
    return { status: 400, code: "months_invalid", error: message.slice(message.indexOf("premier_set_grant: ")) };
  }
  return {
    status: 500,
    code: "set_failed",
    error: `Couldn't set Premier for ${placeId}: ${message.slice(0, 120)}. Nothing changed — run again.`,
  };
}
