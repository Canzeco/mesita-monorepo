// MESITA-3090: admin-web-grant-place-premier action "set" — the reply for
// each premier_set_grant refusal. The SQL raises a fixed
// "premier_set_grant: …" message per refusal (migration
// 20261030002000_premier_manual_layer.sql; Manual Premier no longer refuses
// for guests since MESITA-3091); this maps each to an HTTP status,
// a stable code and the line the Multiple Places row shows. Matched on the
// full prefixed message, most specific first, so an unrelated database
// error that happens to say "archived" stays a 500.

export type SetFailure = { status: number; code: string; error: string };

const REFUSALS: readonly { prefix: string; status: number; code: string; error: string }[] = [
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
