import { assertEquals } from "jsr:@std/assert@1";
import { guestSearchFilter, readStandingBody, toGuestRow } from "./guest-standing.ts";
import { validateConsumerPatch } from "./consumer-doc.ts";
import { notWritableKey } from "../consumer-web-update-profile/update-profile-fields.ts";
import type { UpdateProfileBody } from "../consumer-web-update-profile/update-profile-fields.ts";

const ID = "3e170470-7cbf-4275-a5b0-8937beeea9ca";
const OP = "92468118-9c8e-4602-8367-ad766a9a3111";

Deno.test("guest row: name falls back, the handle shows only when proved, plain Class and Plan by default", () => {
  assertEquals(
    toGuestRow({
      id: ID,
      code: "0000-0042",
      first_name: "Diego",
      last_name: "Ruiz",
      instagram_handle: "diego",
      instagram_verified_at: null,
      guest_class: null,
      plan: "gold",
      created_at: "2026-10-21T00:00:00Z",
    }),
    {
      id: ID,
      name: "Diego Ruiz",
      code: "0000-0042",
      instagram: null,
      guestClass: "regular",
      plan: "free",
      guestClassSetAt: null,
      guestClassSetByEmail: null,
      guestClassNote: null,
      vipPartnerId: null,
      vipUntil: null,
      createdAt: "2026-10-21T00:00:00Z",
    },
  );
  assertEquals(toGuestRow({ id: ID }).name, "No name yet");
});

Deno.test("guest row: Class and Plan are independent; the audit maps the operator to an email", () => {
  const r = toGuestRow(
    {
      id: ID,
      full_name: "Valeria Soto",
      instagram_handle: "vale",
      instagram_verified_at: "2026-10-01T00:00:00Z",
      guest_class: "vip",
      plan: "free",
      guest_class_set_at: "2026-10-21T12:00:00Z",
      guest_class_set_by: OP,
      guest_class_note: "Agency partner",
    },
    (id) => (id === OP ? "pato@canzeco.com" : null),
  );
  assertEquals(
    [r.name, r.instagram, r.guestClass, r.plan, r.guestClassSetAt, r.guestClassSetByEmail, r.guestClassNote],
    ["Valeria Soto", "vale", "vip", "free", "2026-10-21T12:00:00Z", "pato@canzeco.com", "Agency partner"],
  );
  // An operator who no longer resolves leaves the date and no email.
  const gone = toGuestRow({ id: ID, guest_class: "vip", guest_class_set_by: OP, guest_class_set_at: "x" });
  assertEquals([gone.guestClassSetAt, gone.guestClassSetByEmail], ["x", null]);
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

/** The code a refused body comes back with. */
const codeOf = (b: unknown) => {
  const r = readStandingBody(b);
  return r.ok ? "ok" : `${r.status} ${r.code}`;
};

Deno.test("set body: every refusal has a stable code", () => {
  assertEquals(codeOf({ consumerId: ID, diamond: true }), "400 stale_client");
  assertEquals(codeOf({ guestClass: "vip" }), "400 invalid_consumer");
  assertEquals(codeOf(null), "400 invalid_consumer");
  assertEquals(codeOf({ consumerId: ID }), "400 nothing_to_set");
  assertEquals(codeOf({ consumerId: ID, guestClass: "gold" }), "400 invalid_guest_class");
  assertEquals(codeOf({ consumerId: ID, plan: "pro" }), "400 invalid_plan");
  assertEquals(codeOf({ consumerId: ID, guestClassNote: 5 }), "400 invalid_note");
  assertEquals(codeOf({ consumerId: ID, guestClassNote: "x".repeat(281) }), "400 note_too_long");
});

Deno.test("set body: the fix is in the message", () => {
  const r = readStandingBody({ consumerId: ID, guestClass: "gold" });
  assertEquals(r.ok ? "" : r.error, "guestClass must be 'regular' or 'vip' (got 'gold')");
  const n = readStandingBody({ consumerId: ID, guestClassNote: "y".repeat(312) });
  assertEquals(n.ok ? "" : n.error, "guestClassNote is 312 characters; the limit is 280");
  const s = readStandingBody({ consumerId: ID, diamond: false });
  assertEquals(s.ok ? "" : s.error, "Admin is out of date. Reload the page.");
});

Deno.test("set body: Class, Plan and the note are each optional and independent", () => {
  assertEquals(readStandingBody({ consumerId: ID, guestClass: "vip", plan: "free", phone: "1" }), {
    ok: true,
    consumerId: ID,
    patch: { guestClass: "vip", plan: "free" },
  });
  assertEquals(readStandingBody({ consumerId: ID, plan: "premium" }), {
    ok: true,
    consumerId: ID,
    patch: { plan: "premium" },
  });
  // The note is trimmed; whitespace-only or null clears it; 280 is allowed.
  assertEquals(readStandingBody({ consumerId: ID, guestClassNote: "  Agency  " }), {
    ok: true,
    consumerId: ID,
    patch: { guestClassNote: "Agency" },
  });
  assertEquals(readStandingBody({ consumerId: ID, guestClassNote: "   " }), {
    ok: true,
    consumerId: ID,
    patch: { guestClassNote: null },
  });
  assertEquals(readStandingBody({ consumerId: ID, guestClassNote: "z".repeat(280) }).ok, true);
});

Deno.test("set body: a VIP's partner and last day (MESITA-2556)", () => {
  const P = "a1b2c3d4-0000-4000-8000-000000000001";
  const T = "2026-10-28";
  const set = (b: Record<string, unknown>) => readStandingBody({ consumerId: ID, ...b }, T);
  assertEquals(set({ vipPartnerId: P, vipUntil: "2026-12-31" }), {
    ok: true,
    consumerId: ID,
    patch: { vipPartnerId: P, vipUntil: "2026-12-31" },
  });
  // null clears either; today is allowed.
  assertEquals(set({ vipPartnerId: null, vipUntil: null }).ok, true);
  assertEquals(set({ vipUntil: T }).ok, true);
  const code = (b: Record<string, unknown>) => {
    const r = set(b);
    return r.ok ? "ok" : `${r.status} ${r.code}`;
  };
  assertEquals(code({ vipPartnerId: "x" }), "400 invalid_partner");
  assertEquals(code({ vipUntil: "2026-02-30" }), "400 invalid_vip_until");
  assertEquals(code({ vipUntil: "2026-10-27" }), "400 vip_until_past");
  // Going Regular in the same call refuses a partner or a last day.
  assertEquals(code({ guestClass: "regular", vipPartnerId: P }), "400 not_vip");
  assertEquals(code({ guestClass: "regular", vipPartnerId: null }), "ok");
});

Deno.test("the consumer door cannot write Class, Plan or the VIP audit (MESITA-2553)", () => {
  for (const key of ["plan", "guest_class", "guest_class_note", "guest_class_set_at", "vip_partner_id", "vip_until", "diamond"]) {
    const r = validateConsumerPatch({ [key]: "x" });
    assertEquals(r.ok ? "accepted" : r.error, `unknown consumer field: ${key}`);
  }
});

Deno.test("consumer-web-update-profile refuses Plan and Class keys loudly", () => {
  assertEquals(notWritableKey({ first_name: "Ana", plan: "premium" }), "plan");
  assertEquals(notWritableKey({ guestClass: "vip" }), "guestClass");
  assertEquals(notWritableKey({ guest_class_note: "x" }), "guest_class_note");
  assertEquals(notWritableKey({ vip_until: "2027-01-01" }), "vip_until");
  assertEquals(notWritableKey({ first_name: "Ana" }), null);
  assertEquals(notWritableKey(null), null);
});

// Type-level: the body a guest can send has no Plan or Class key.
type HasKey<T, K extends string> = K extends keyof T ? true : false;
const _noPlan: HasKey<UpdateProfileBody, "plan"> = false;
const _noClass: HasKey<UpdateProfileBody, "guest_class"> = false;
const _noGuestClass: HasKey<UpdateProfileBody, "guestClass"> = false;
void _noPlan;
void _noClass;
void _noGuestClass;
