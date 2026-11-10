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

/** The name a ticket is booked under (MESITA-3607): the name the guest typed
 *  on the Reserve sheet, else (older tickets) the consumer's profile name. */
export type TicketNameParts = {
  guest_first_name?: string | null;
  guest_last_name?: string | null;
  consumer?: GuestNameParts | null;
};

export function ticketGuestName(t: TicketNameParts | null | undefined, fallback: string): string {
  const typed = [t?.guest_first_name, t?.guest_last_name].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
  return typed || guestName(t?.consumer, fallback);
}
