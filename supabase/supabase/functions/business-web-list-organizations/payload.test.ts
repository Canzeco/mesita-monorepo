// Source contract: the rail's places ride this payload, but `name` and
// `photos` live on place_profiles, not on places (MESITA-1781). Selecting
// them off `places` 42703s the whole Organization screen, which hides the
// create form behind "Couldn't load your organizations".
import { assert, assertEquals } from "jsr:@std/assert";

const SRC = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);

const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

Deno.test("the rail embed reads name and photos from place_profiles", () => {
  assert(
    CODE.includes("place_profiles!inner(name, photos)"),
    "name/photos must come from the generated profile column, not places",
  );
});

Deno.test("places is not asked for name or photos as own columns", () => {
  // The MESITA-1779 select that broke prod. A comment may still name it;
  // CODE has the prose stripped so the explanation cannot satisfy this.
  assertEquals(
    /select\(\s*["']id,\s*organization_id,\s*name,\s*photos["']\s*\)/.test(
      CODE,
    ),
    false,
  );
  assert(
    !/\.order\(\s*["']name["']/.test(CODE),
    "ordering places.name is the same 42703; sort the rail rows in memory",
  );
});

Deno.test("photos are narrowed to ONE url, never the array", () => {
  assert(SRC.includes("photoUrl:"), "payload must carry photoUrl");
  assert(
    !/\bphotos:\s*p\.photos/.test(SRC),
    "payload must not ship the array",
  );
});

Deno.test("the org list carries the Partner switch facts (MESITA-1798)", () => {
  assert(SRC.includes("partnered: r.organizations.partnered === true"));
  assert(
    SRC.includes("mesitaPayEnabled: r.organizations.mesita_pay_enabled === true"),
  );
  assert(
    SRC.includes("partnered, mesita_pay_enabled"),
    "the embed must select both columns",
  );
});

Deno.test("the org list carries the Membership behind Partner (MESITA-1877)", () => {
  // The renewal date and the dunning state, so the Products banner can say
  // WHEN it renews without a second round trip.
  assert(SRC.includes('.from("partner_memberships")'));
  assert(SRC.includes("LIVE_MEMBERSHIP_STATES"), "only live rows are billing");
  assert(SRC.includes("renewsAt: membership.current_period_end"));
  assert(SRC.includes("cancelAtPeriodEnd:"));
  // The catalog price rides the ENVELOPE, not every row: it is a console-wide
  // fact, and repeating it per organization is how two of them drift.
  assert(SRC.includes("membershipPrice,"));
});

Deno.test("a failed billing read ships null, and never fails the call", () => {
  // The rail, the switcher and the create form all ride this payload. A
  // billing read must never be what takes them down (MESITA-1793's law), and
  // `membership: null` is already a real state — a partner from the operator
  // switch has no subscription either — so the console needs no new branch.
  const start = SRC.indexOf('.from("partner_memberships")');
  const window = SRC.slice(start, start + 1200);
  assert(
    window.includes("console.error"),
    "a failed membership read is logged, not thrown",
  );
  assert(
    !/memberships\.error\)\s*return json/.test(window),
    "a failed membership read must not 500 the whole payload",
  );
});
