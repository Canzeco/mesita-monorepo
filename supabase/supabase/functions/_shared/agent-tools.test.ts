// _shared/agent-tools.test.ts
//
// get_reservation and a4_find_reservation find a reservation by the name it
// is under. A place says "a nombre de Ana López" — the name the guest TYPED
// on Reserve — so matching the profile name instead finds nothing (or the
// wrong person's table).

import { assert } from "jsr:@std/assert@1";
import { ticketMatchesGuestName } from "./agent-tools.ts";

const booked = {
  guest_first_name: "Ana",
  guest_last_name: "López",
  consumer: { full_name: "Pedro Ruiz", first_name: "Pedro", last_name: "Ruiz" },
};

Deno.test("name lookup: the typed name wins, accent-insensitive", () => {
  assert(ticketMatchesGuestName(booked, "ana lopez"));
  assert(ticketMatchesGuestName(booked, "López"));
  assert(!ticketMatchesGuestName(booked, "Pedro Ruiz"), "the profile name must not match a typed reservation");
});

Deno.test("name lookup: an older reservation without a typed name falls back to the profile", () => {
  const older = { guest_first_name: null, guest_last_name: null, consumer: booked.consumer };
  assert(ticketMatchesGuestName(older, "pedro ruiz"));
  assert(!ticketMatchesGuestName(older, "ana"));
});
