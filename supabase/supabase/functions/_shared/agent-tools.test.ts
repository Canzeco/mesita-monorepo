// _shared/agent-tools.test.ts
//
// get_reservation and a4_find_reservation find a reservation by the name it
// is under. A place says "a nombre de Ana López" — the name the guest TYPED
// on Reserve — so matching the profile name instead finds nothing (or the
// wrong person's table).

import { assert, assertEquals } from "jsr:@std/assert@1";
import { accentTolerantPattern, ownTicket, ticketMatchesGuestName } from "./agent-tools.ts";

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

// MESITA-3622: the database half of the lookup is accent-blind too.
// `_` is ilike's one-character wildcard; this mimics it to prove the pattern
// a spoken "Lopez" sends finds a typed "López" (and the reverse).
function ilike(value: string, pattern: string): boolean {
  const re = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${re}$`, "i").test(value);
}

Deno.test("name lookup at the database: accent-blind ilike patterns", () => {
  assertEquals(accentTolerantPattern("Lopez"), "%l_p_z%");
  assert(ilike("López", accentTolerantPattern("Lopez")));
  assert(ilike("Lopez", accentTolerantPattern("López")));
  assert(ilike("Núñez", accentTolerantPattern("Nunez")));
  assert(!ilike("Ruiz", accentTolerantPattern("Lopez")));
  assertEquals(accentTolerantPattern("a,b(%)"), "%_b%", "PostgREST syntax never reaches the filter");
  assertEquals(accentTolerantPattern("  "), "");
});

Deno.test("a4 code lookup: only the verified caller's place", () => {
  const ticket = { place_id: "place-a", reference_code: "48291057" };
  assertEquals(ownTicket(ticket, "place-a"), ticket);
  assertEquals(ownTicket(ticket, "place-b"), null, "another place's code reads as not found");
  assertEquals(ownTicket(null, "place-a"), null);
});

Deno.test("a4 never reaches the global get_reservation", async () => {
  const { A4 } = await import("./reservationist/a4.ts");
  assert(!A4.toolNames.includes("get_reservation"), "a4 looks codes up through a4_find_reservation");
});
