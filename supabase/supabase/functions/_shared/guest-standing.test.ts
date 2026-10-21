import { assertEquals } from "jsr:@std/assert@1";
import { guestSearchFilter, readStandingBody, toGuestRow } from "./guest-standing.ts";
import { validateConsumerPatch } from "./consumer-doc.ts";

const ID = "3e170470-7cbf-4275-a5b0-8937beeea9ca";

Deno.test("guest row: name falls back, the handle shows only when proved, plan defaults to free", () => {
  assertEquals(
    toGuestRow({
      id: ID,
      code: "0000-0042",
      first_name: "Diego",
      last_name: "Ruiz",
      instagram_handle: "diego",
      instagram_verified_at: null,
      diamond: null,
      plan: "gold",
      created_at: "2026-10-21T00:00:00Z",
    }),
    {
      id: ID,
      name: "Diego Ruiz",
      code: "0000-0042",
      instagram: null,
      diamond: false,
      plan: "free",
      createdAt: "2026-10-21T00:00:00Z",
    },
  );
  const r = toGuestRow({
    id: ID,
    full_name: "Valeria Soto",
    instagram_handle: "vale",
    instagram_verified_at: "2026-10-01T00:00:00Z",
    diamond: true,
    plan: "premium",
  });
  assertEquals([r.name, r.instagram, r.diamond, r.plan], ["Valeria Soto", "vale", true, "premium"]);
  assertEquals(toGuestRow({ id: ID }).name, "No name yet");
});

Deno.test("search filter: nothing to search is no filter", () => {
  assertEquals(guestSearchFilter(undefined), null);
  assertEquals(guestSearchFilter("   "), null);
  assertEquals(guestSearchFilter("(),"), null);
});

Deno.test("search filter: a comma or parenthesis can never split the or() string", () => {
  const f = guestSearchFilter("ana),code.eq.1")!;
  assertEquals(f.split(",").length, 4);
  assertEquals(f.includes("("), false);
  assertEquals(f.startsWith(`full_name.ilike."%ana code.eq.1%"`), true);
});

Deno.test("search filter: @handle drops the @; eight digits also match the member number", () => {
  assertEquals(guestSearchFilter("@vale")!.includes(`instagram_handle.ilike."%vale%"`), true);
  assertEquals(guestSearchFilter("00000042")!.endsWith("code.eq.0000-0042"), true);
  assertEquals(guestSearchFilter("0000-0042")!.endsWith("code.eq.0000-0042"), true);
  assertEquals(guestSearchFilter("Diego")!.includes("code.eq"), false);
});

Deno.test("search filter: % and _ are literal, not wildcards", () => {
  assertEquals(guestSearchFilter("a_b")!.startsWith(`full_name.ilike."%a\\_b%"`), true);
});

Deno.test("set body: needs a uuid and at least one well-typed fact", () => {
  assertEquals(readStandingBody({ diamond: true }).ok, false);
  assertEquals(readStandingBody({ consumerId: ID }).ok, false);
  assertEquals(readStandingBody({ consumerId: ID, diamond: "yes" }).ok, false);
  assertEquals(readStandingBody({ consumerId: ID, plan: "gold" }).ok, false);
  assertEquals(readStandingBody(null).ok, false);
  assertEquals(readStandingBody({ consumerId: ID, diamond: true, plan: "premium", phone: "1" }), {
    ok: true,
    consumerId: ID,
    patch: { diamond: true, plan: "premium" },
  });
  assertEquals(readStandingBody({ consumerId: ID, plan: "free" }), {
    ok: true,
    consumerId: ID,
    patch: { plan: "free" },
  });
});

Deno.test("the consumer door takes diamond and plan with their DB shapes", () => {
  assertEquals(validateConsumerPatch({ diamond: true, plan: "premium" }).ok, true);
  assertEquals(validateConsumerPatch({ diamond: 1 }).ok, false);
  assertEquals(validateConsumerPatch({ plan: "pro" }).ok, false);
});
