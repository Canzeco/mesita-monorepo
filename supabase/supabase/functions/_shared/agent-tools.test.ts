// _shared/agent-tools.test.ts
//
// get_reservation and a4_find_reservation find a reservation by the name it
// is under. A place says "a nombre de Ana López" — the name the guest TYPED
// on Reserve — so matching the profile name instead finds nothing (or the
// wrong person's table).

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  accentTolerantPattern,
  codeLookupKey,
  guestOwnsTicket,
  ownTicket,
  placeOwnsTicket,
  ticketMatchesGuestName,
} from "./agent-tools.ts";

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

Deno.test("inbound: get_reservation is reached only from the unknown-number lane", async () => {
  // A known place looks a code up through a4_find_reservation (its own book
  // only); a known guest reads guest.tickets. The global code lookup is for a
  // number that is nobody's (MESITA-3974).
  const { A3 } = await import("./reservationist/a3.ts");
  const wf = A3.workflow((n) => `tool_${n}`);
  const lookups = Object.entries(wf.nodes).filter(([, n]) =>
    n.type === "tool" && (n.tools as Array<{ tool_id: string }>)[0].tool_id === "tool_get_reservation"
  ).map(([id]) => id);
  assertEquals(lookups.length, 1);
  const into = Object.values(wf.edges).filter((e) => e.target === lookups[0]).map((e) => e.source);
  assertEquals(into, ["unknown"]);
});

Deno.test("inbound: tool results, not the LLM, route place → guest → unknown (MESITA-4022)", async () => {
  // A small model never decides who is calling: place lookup first, guest
  // lookup on its failure, the unknown lane on both failing.
  const { A3 } = await import("./reservationist/a3.ts");
  const wf = A3.workflow((n) => `tool_${n}`);
  const toolOf = (id: string) => (wf.nodes[id].tools as Array<{ tool_id: string }>)[0].tool_id;
  const next = (src: string, ok: boolean) =>
    Object.values(wf.edges).find((e) =>
      e.source === src && (e.forward_condition as { type: string; successful?: boolean }).type === "result" &&
      (e.forward_condition as { successful?: boolean }).successful === ok
    )?.target as string;
  const first = Object.values(wf.edges).find((e) => e.source === "start_node")!.target as string;
  assertEquals(toolOf(first), "tool_inbound_identify_place");
  assertEquals(next(first, true), "triage_place");
  const second = next(first, false);
  assertEquals(toolOf(second), "tool_inbound_identify_guest");
  assertEquals(next(second, true), "triage_guest");
  assertEquals(next(second, false), "unknown");
});

// ── Spoofing (MESITA-3973) ──────────────────────────────────────────────────
// Pato: "someone calling x guest number wanting to edit y geust number
// ticket. that should not be allowed. same for x place number".

Deno.test("spoof: a guest's number touches only that guest's ticket", () => {
  const ana = { consumer: { phone: "+5215511112222" } };
  assert(guestOwnsTicket(ana, "+525511112222"), "the same line in another MX format is the same guest");
  assert(!guestOwnsTicket(ana, "+525599998888"), "another guest's number is refused");
  assert(!guestOwnsTicket(ana, ""), "no caller id is refused");
  assert(!guestOwnsTicket(ana, "12345"), "a short caller id is refused");
  assert(!guestOwnsTicket({ consumer: null }, "+525511112222"), "a ticket with no guest phone is refused");
  assert(!guestOwnsTicket(null, "+525511112222"));
});

Deno.test("spoof: a place's number touches only that place's tickets", () => {
  const granCentral = { phone: "+525533334444", reservation_target: "+525566667777" };
  assert(placeOwnsTicket(granCentral, "+525533334444"), "its Google line");
  assert(placeOwnsTicket(granCentral, "5566667777"), "its Reservations line");
  assert(!placeOwnsTicket(granCentral, "+525500001111"), "another restaurant's number is refused");
  assert(!placeOwnsTicket(granCentral, undefined), "no caller id is refused");
  assert(!placeOwnsTicket({ phone: null, reservation_target: null }, "+525533334444"));
  assert(!placeOwnsTicket(null, "+525533334444"));
});

Deno.test("spoof: get_reservation answers a code, never a name", () => {
  assertEquals(codeLookupKey("48213907"), "48213907");
  assertEquals(codeLookupKey(""), null);
  assertEquals(codeLookupKey("4821390"), null);
  assertEquals(codeLookupKey("482139071"), null);
});

Deno.test("spoof: get_reservation's tool takes no name", async () => {
  const { toolConfigs } = await import("./reservationist/tools.ts");
  const tool = toolConfigs("u", "a", "s").find((t) => t.name === "get_reservation")!;
  const props = Object.keys(
    ((tool.config.api_schema as { request_body_schema: { properties: Record<string, unknown> } })
      .request_body_schema).properties,
  );
  assertEquals(props, ["reference_code"]);
});
