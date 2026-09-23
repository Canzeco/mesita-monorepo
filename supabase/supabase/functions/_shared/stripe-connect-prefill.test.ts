import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  ALLOWED_CONNECT_MCCS,
  CONNECT_MCCS,
  DEFAULT_CONNECT_MCC,
  asHttpsUrl,
  deterministicConnectPrefill,
  mccFromPlace,
  mccFromPlaces,
  rfcIfValid,
  sortPlacesForPrefill,
  trimProductDescription,
} from "./stripe-connect-prefill.ts";

Deno.test("MCC: Atlas category maps hospitality, never Software", () => {
  assertEquals(mccFromPlace({ category: "mexican" }), CONNECT_MCCS.restaurants);
  assertEquals(mccFromPlace({ category: "taco" }), CONNECT_MCCS.restaurants);
  assertEquals(mccFromPlace({ category: "bar" }), CONNECT_MCCS.bars);
  assertEquals(mccFromPlace({ category: "night_club" }), CONNECT_MCCS.bars);
  assertEquals(mccFromPlace({ category: "bakery" }), CONNECT_MCCS.bakery);
  assertEquals(mccFromPlace({ category: "spa" }), CONNECT_MCCS.spa);
  assertEquals(mccFromPlace({ category: "gym" }), CONNECT_MCCS.sports);
  assertEquals(mccFromPlace({ category: "movie_theater" }), CONNECT_MCCS.theater);
  assert(!ALLOWED_CONNECT_MCCS.has("5734"));
});

Deno.test("MCC: stored supers fill in when category is undefined", () => {
  assertEquals(
    mccFromPlace({ category: "undefined", family_keys: ["bars_nightlife"] }),
    CONNECT_MCCS.bars,
  );
  assertEquals(
    mccFromPlace({ category: "undefined", family_keys: ["undefined"] }),
    null,
  );
});

Deno.test("MCC: org majority, restaurant/bar tie prefers restaurants", () => {
  assertEquals(
    mccFromPlaces([
      { category: "mexican" },
      { category: "taco" },
      { category: "bar" },
    ]),
    CONNECT_MCCS.restaurants,
  );
  assertEquals(
    mccFromPlaces([{ category: "bar" }, { category: "mexican" }]),
    CONNECT_MCCS.restaurants,
  );
  assertEquals(mccFromPlaces([{ category: "undefined" }]), null);
});

Deno.test("website prefills from https or a bare host; @handles are skipped", () => {
  assertEquals(asHttpsUrl("https://cabaret.mx"), "https://cabaret.mx/");
  assertEquals(asHttpsUrl("www.cabaret.mx"), "https://www.cabaret.mx/");
  assertEquals(asHttpsUrl("@cabaret"), null);
  assertEquals(asHttpsUrl(""), null);
  assertEquals(asHttpsUrl("not a url"), null);
});

Deno.test("product description is 2–3 sentences, capped, short copy dropped", () => {
  assertEquals(trimProductDescription("too short"), null);
  assertEquals(
    trimProductDescription("  Cabaret is a late-night restaurant in Roma.  "),
    "Cabaret is a late-night restaurant in Roma.",
  );
  const long = "A".repeat(500);
  assert((trimProductDescription(long) ?? "").length <= 400);
});

Deno.test("RFC is an allowlist, not a passthrough", () => {
  assertEquals(rfcIfValid("XAXX010101000"), "XAXX010101000");
  assertEquals(rfcIfValid("xaxx010101000"), "XAXX010101000");
  assertEquals(rfcIfValid("not-an-rfc"), null);
  assertEquals(rfcIfValid(""), null);
});

Deno.test("deterministic prefill: restaurant website + RFC", () => {
  const out = deterministicConnectPrefill(
    { name: "Cabaret", legalName: "Cabaret Social Room SA de CV", rfc: "CSR010101ABC" },
    [{
      name: "Cabaret",
      category: "mexican",
      description: "Late-night Mexican restaurant and cocktail bar in Roma Norte.",
      website_url: "cabaret.mx",
      phone: "+52 55 1234 5678",
      email: "hola@cabaret.mx",
    }],
  );
  assertEquals(out.businessProfile.mcc, CONNECT_MCCS.restaurants);
  assertEquals(out.businessProfile.url, "https://cabaret.mx/");
  assertEquals(out.email, "hola@cabaret.mx");
  assertEquals(out.taxId, "CSR010101ABC");
  assertEquals(out.businessProfile.support_phone, "+52 55 1234 5678");
  assertEquals(
    out.businessProfile.product_description,
    "Late-night Mexican restaurant and cocktail bar in Roma Norte.",
  );
});

Deno.test("no places still sends restaurant MCC so Stripe cannot fall back to Software", () => {
  const out = deterministicConnectPrefill(
    { name: "Empty Org", legalName: "", rfc: null },
    [],
  );
  assertEquals(out.businessProfile.mcc, DEFAULT_CONNECT_MCC);
  assertEquals(out.businessProfile.url, undefined);
});

Deno.test("Instagram is the URL when the place has no website", () => {
  const out = deterministicConnectPrefill(
    { name: "Bar X", legalName: "", rfc: null },
    [{ category: "bar", instagram_url: "https://instagram.com/barx" }],
  );
  assertEquals(out.businessProfile.mcc, CONNECT_MCCS.bars);
  assertEquals(out.businessProfile.url, "https://instagram.com/barx");
});

Deno.test("firstOf is stable across shuffled place rows (Stripe create idempotency)", () => {
  const a = { id: "aaa", website_url: "https://first.mx", category: "mexican" };
  const b = { id: "bbb", website_url: "https://second.mx", category: "bar" };
  assertEquals(
    deterministicConnectPrefill({ name: "Org", legalName: "", rfc: null }, [b, a])
      .businessProfile.url,
    deterministicConnectPrefill({ name: "Org", legalName: "", rfc: null }, [a, b])
      .businessProfile.url,
  );
  assertEquals(sortPlacesForPrefill([b, a]).map((p) => p.id), ["aaa", "bbb"]);
});

Deno.test("an unclassified place still gets the restaurant MCC, never Software", () => {
  const out = deterministicConnectPrefill(
    { name: "Mystery", legalName: "", rfc: null },
    [{ id: "p1", category: "undefined" }],
  );
  assertEquals(out.businessProfile.mcc, DEFAULT_CONNECT_MCC);
  assertEquals(out.businessProfile.product_description, undefined);
});
