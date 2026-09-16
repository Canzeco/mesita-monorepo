import { assertEquals } from "jsr:@std/assert@1";
import {
  dropPlacePatch,
  joinPlacePatch,
  type PlacePartnershipRow,
} from "./place-partnership.ts";

const FREE: PlacePartnershipRow = {
  id: "p1",
  plan: "free",
  listing_type: "web",
  plan_forfeited_at: null,
};

const MEMBER: PlacePartnershipRow = {
  id: "p2",
  plan: "pro",
  listing_type: "web",
  plan_forfeited_at: null,
};

const FORFEITED: PlacePartnershipRow = {
  id: "p3",
  plan: "free",
  listing_type: "web",
  plan_forfeited_at: "2026-09-01T00:00:00.000Z",
};

Deno.test("join writes plan=pro and skips an already-member place", () => {
  const join = joinPlacePatch(FREE);
  assertEquals(join?.plan, "pro");
  assertEquals(joinPlacePatch(MEMBER), null);
});

Deno.test("join of a forfeited place clears the forfeit stamps", () => {
  const join = joinPlacePatch(FORFEITED);
  assertEquals(join?.plan, "pro");
  assertEquals(join?.plan_forfeited_at, null);
  assertEquals(join?.strike_count, 0);
});

Deno.test("join at Zero does not promote listing_type to partner", () => {
  // listing_type='partner' iff plan ≠ free AND strategy ≠ zero.
  const join = joinPlacePatch(FREE);
  assertEquals(join?.listing_type, undefined);
});

Deno.test("drop writes plan=free and zeros rates, and skips a free place", () => {
  const drop = dropPlacePatch(MEMBER);
  assertEquals(drop?.plan, "free");
  assertEquals(drop?.welcome_free_rate, null);
  assertEquals(drop?.free_rate, null);
  assertEquals(dropPlacePatch(FREE), null);
});

Deno.test("the label on the wire is never Not Partner", () => {
  // Pin the product copy decision in the module that owns the fact:
  // the switch is Partner, on or off. This file has no UI, so the pin
  // is that join/drop never invent a third state name.
  assertEquals(joinPlacePatch(FREE)?.plan, "pro");
  assertEquals(dropPlacePatch(MEMBER)?.plan, "free");
});
