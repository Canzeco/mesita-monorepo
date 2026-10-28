// The guest's display name off a consumer row: full_name, else first + last,
// else the caller's fallback. A leaf (no client, no ticket shapes) so the call
// engine and the agent tools share one rule; the fallback is the caller's
// wording ("(sin nombre)" on the agent tools, "el cliente" in the engine).

export type GuestNameParts = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export function guestName(c: GuestNameParts | null | undefined, fallback: string): string {
  return c?.full_name?.trim() ||
    [c?.first_name, c?.last_name].map((s) => (s ?? "").trim()).filter(Boolean).join(" ") ||
    fallback;
}
