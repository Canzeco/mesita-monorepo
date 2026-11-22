// MESITA-4036: what a gift ticket says about the friend on the other side.
// Every profile is public (MESITA-4690): a friend's photo always shows.
import { assertEquals } from "jsr:@std/assert@1";
import { giftPeopleIds, giftTickets, type GiftRow, type PersonRow } from "./wallet-gifts.ts";

const ME = "me";
const row = (p: Partial<GiftRow>): GiftRow => ({
  id: "g1",
  sender_id: ME,
  recipient_id: null,
  place_id: "p1",
  amount_cents: 20000,
  currency: "MXN",
  status: "open",
  created_at: "2026-11-15T10:00:00Z",
  claimed_at: null,
  taken_back_at: null,
  ...p,
});
const people: PersonRow[] = [
  { id: ME, first_name: "Pato", avatar_url: "https://x/me.jpg" },
  { id: "ana", first_name: "Ana", avatar_url: "https://x/ana.jpg" },
  { id: "hid", first_name: " ", avatar_url: "https://x/hid.jpg" },
];

Deno.test("an open gift I sent has no receiver yet", () => {
  const [t] = giftTickets([row({})], people, [], ME);
  assertEquals(t.role, "sender");
  assertEquals(t.status, "open");
  assertEquals(t.recipient, null);
  assertEquals(t.sender, { name: "Pato", photo: "https://x/me.jpg", you: true });
});

Deno.test("a gift I received names its sender; the sender photo always shows", () => {
  const [a, b] = giftTickets(
    [
      row({ id: "a", sender_id: "ana", recipient_id: ME, status: "claimed", claimed_at: "2026-11-15T11:00:00Z" }),
      row({ id: "b", sender_id: "hid", recipient_id: ME, status: "claimed", claimed_at: "2026-11-15T09:00:00Z", created_at: "2026-11-14T10:00:00Z" }),
    ],
    people,
    [],
    ME,
  );
  assertEquals(a.role, "recipient");
  assertEquals(a.sender, { name: "Ana", photo: "https://x/ana.jpg", you: false });
  assertEquals(b.sender.photo, "https://x/hid.jpg");
  assertEquals(b.sender.name, "Mesita member");
});

Deno.test("someone else's gift and an unknown status are dropped; newest first", () => {
  const out = giftTickets(
    [
      row({ id: "old", created_at: "2026-11-01T00:00:00Z" }),
      row({ id: "x", sender_id: "ana", recipient_id: "hid" }),
      row({ id: "w", status: "weird" }),
      row({ id: "new", created_at: "2026-11-15T12:00:00Z" }),
    ],
    people,
    [],
    ME,
  );
  assertEquals(out.map((t) => t.gift_id), ["new", "old"]);
});

Deno.test("the entry is my latest ledger line for the gift", () => {
  const [t] = giftTickets(
    [row({ status: "taken_back", taken_back_at: "2026-11-15T12:00:00Z" })],
    people,
    [
      { gift_id: "g1", kind: "gift_out", created_at: "2026-11-15T10:00:00Z" },
      { gift_id: "g1", kind: "gift_back", created_at: "2026-11-15T12:00:00Z" },
    ],
    ME,
  );
  assertEquals(t.entry, { kind: "gift_back", at: "2026-11-15T12:00:00Z", available_at: null });
});

Deno.test("a received gift's entry says when its credit turns Available (MESITA-4066)", () => {
  const [t] = giftTickets(
    [row({ sender_id: "ana", recipient_id: ME, status: "claimed", claimed_at: "2026-11-15T12:00:00Z" })],
    people,
    [{ gift_id: "g1", kind: "gift_in", created_at: "2026-11-15T12:00:00Z", available_at: "2026-11-15T13:00:00Z" }],
    ME,
  );
  assertEquals(t.role, "recipient");
  assertEquals(t.entry, { kind: "gift_in", at: "2026-11-15T12:00:00Z", available_at: "2026-11-15T13:00:00Z" });
});

Deno.test("people ids are each sender and receiver once", () => {
  assertEquals(
    giftPeopleIds([row({ recipient_id: "ana" }), row({ sender_id: "ana", recipient_id: ME })]).sort(),
    ["ana", ME].sort(),
  );
});
