import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { consumerSchema } from "./api";
import { readLink } from "./links";
import { COUNTRIES, countryOf } from "./countries";
import { authMessage, gateOf, SIGNED_OUT, toE164, type Profile, type Session } from "./model";
import { isAppPath, ME_PAGES, ROUTE_GROUPS } from "./routes";

const ANA: Profile = {
  id: "g1", firstName: "Ana", lastName: "López", sex: "female", birthYear: 1990, phone: null, isVip: false,
};
const at = (patch: Partial<Session>): Session => ({ ...SIGNED_OUT, settled: true, ...patch });

describe("the gate", () => {
  test("starts until the device's own storage has answered, whatever else is true", () => {
    expect(gateOf({ ...SIGNED_OUT, updateRequired: true }, undefined)).toBe("starting");
  });
  test("a visitor is in the open gate", () => {
    expect(gateOf(at({}), undefined)).toBe("open");
  });
  test("a member with a whole profile is in the open gate", () => {
    expect(gateOf(at({ guestId: "g1" }), ANA)).toBe("open");
  });
  test.each(["firstName", "lastName", "sex", "birthYear"] as const)("a read profile with no %s is onboarding", (key) => {
    expect(gateOf(at({ guestId: "g1" }), { ...ANA, [key]: null })).toBe("onboarding");
  });
  test("a sex a newer backend sends is not a missing one's twin: it asks again", () => {
    expect(gateOf(at({ guestId: "g1" }), { ...ANA, sex: "unknown" })).toBe("onboarding");
  });
  test("a failed profile read never sends anyone to onboarding", () => {
    expect(gateOf(at({ guestId: "g1" }), undefined)).toBe("open");
  });
  test("sign-in saying onboarded: false is onboarding until a profile is read", () => {
    expect(gateOf(at({ guestId: "g1", onboarded: false }), undefined)).toBe("onboarding");
    expect(gateOf(at({ guestId: "g1", onboarded: false }), ANA)).toBe("open");
  });
  test("the higher gate wins", () => {
    const all = at({ guestId: "g1", onboarded: false, suspended: "No.", updateRequired: true });
    expect(gateOf(all, undefined)).toBe("update");
    expect(gateOf({ ...all, updateRequired: false }, undefined)).toBe("suspended");
  });
});

test("a profile keeps only what it can read", () => {
  expect(consumerSchema.parse({ id: "g1", first_name: "Ana", birth_year: "1990", new_field: {} })).toMatchObject({
    id: "g1", firstName: "Ana", birthYear: null, isVip: false,
  });
  expect(consumerSchema.safeParse({ first_name: "Ana" }).success).toBe(false);
});

test("a phone number is sent whole or not at all", () => {
  expect(COUNTRIES[0][0]).toBe("MX");
  expect(countryOf("MX")).toMatchObject({ dial: "52", flag: "🇲🇽" });
  expect(toE164("+52 55 1234 5678")).toBe("+525512345678");
  expect(toE164("+1 (415) 555-0100")).toBe("+14155550100");
  for (const bad of ["55 1234 5678", "+52 55", "+52 1 55 1234 5678", "", "+", "+0012345678"]) expect(toE164(bad)).toBeNull();
});

test("a wrong and an expired code share one message", () => {
  const wrong = authMessage({ code: "otp_expired", message: "Token has expired or is invalid" });
  expect(authMessage({ message: "Invalid token" })).toBe(wrong);
  expect(authMessage({ status: 429 })).not.toBe(wrong);
});

describe("links", () => {
  const path = (address: string) => readLink(address, false);
  test.each([
    ["https://mesita.ai/", "/"],
    ["https://www.mesita.ai/home?view=social", "/?view=social"],
    ["mesita://me", "/me"],
    ["mesita:///search", "/search"],
    ["mesita://place/123", "/place/123"],
    ["mesita://reserve/pinto", "/reserve/pinto"],
    ["https://mesita.ai/reservations", "/reservations"],
    ["https://mesita.ai/place/pinto/menu", "/place/pinto/menu"],
    ["/location", "/location"],
    ["https://mesita.ai/sign", "/sign-in"],
  ])("%s opens %s", (address, to) => {
    expect(path(address)).toEqual({ kind: "path", path: to });
  });
  test.each([
    ["https://mesita.ai/wallet/gift/abc?x=1", "/wallet/gift/abc?x=1"],
    ["https://mesita.ai/pay/place/9", "/pay/place/9"],
    ["https://mesita.ai/open?page=https://evil.test", "/open?page=https://evil.test"],
  ])("%s has no screen: it opens the web page", (address, page) => {
    expect(path(address)).toEqual({ kind: "path", path: `/open?page=${encodeURIComponent(page)}` });
  });
  test("Stripe's return and another site are not the app's", () => {
    expect(path("mesita://stripe-redirect?payment_intent=pi_1")).toEqual({ kind: "ignore" });
    expect(path("https://evil.test/me")).toEqual({ kind: "ignore" });
  });
  test("an address that is none opens Home", () => {
    expect(path("::")).toEqual({ kind: "path", path: "/" });
  });
  test("a gate is forced in development and preview only", () => {
    expect(readLink("mesita://gate/update", true)).toEqual({ kind: "gate", gate: "update" });
    expect(readLink("mesita://gate/update", false)).toEqual({ kind: "path", path: "/" });
    expect(readLink("mesita://gate/starting", true)).toEqual({ kind: "path", path: "/" });
  });
});

describe("the remembered target", () => {
  let target: typeof import("./target");
  beforeEach(() => {
    jest.resetModules();
    target = jest.requireActual("./target");
  });
  test("keeps its params and is used once, when the gate is open and the guest is a member", () => {
    target.settleTarget(false);
    target.rememberTarget("/me?when=past");
    expect(target.takeTarget("open", false)).toBeNull();
    expect(target.takeTarget("onboarding", true)).toBeNull();
    expect(target.takeTarget("open", true)).toBe("/me?when=past");
    expect(target.takeTarget("open", true)).toBeNull();
  });
  test("a path outside the tree is refused", () => {
    target.settleTarget(false);
    for (const bad of ["/admin", "https://evil.test", "//evil.test", "/sign-in", "/me/../x"]) target.rememberTarget(bad);
    expect(target.takeTarget("open", true)).toBeNull();
  });
  test("a link opened on a slow start: kept for a visitor, left to the router for a member", () => {
    target.rememberTarget("/me");
    target.settleTarget(false);
    expect(target.takeTarget("open", true)).toBe("/me");
    jest.resetModules();
    target = jest.requireActual("./target");
    target.rememberTarget("/me");
    target.settleTarget(true);
    expect(target.takeTarget("open", true)).toBeNull();
  });
  test("a session adopted late still returns the guest to their link", () => {
    target.rememberTarget("/me");
    target.settleTarget(false);
    target.settleTarget(true);
    expect(target.takeTarget("open", true)).toBe("/me");
  });
});

describe("the route groups", () => {
  const APP = join(__dirname, "../../app");
  const names = (dir: string) =>
    readdirSync(dir)
      .filter((f) => !f.startsWith("_") && !f.startsWith("+"))
      .map((f) => (statSync(join(dir, f)).isDirectory() ? f : f.replace(/\.tsx$/, "")))
      .sort();
  test("every root route is in exactly one group", () => {
    expect(Object.values(ROUTE_GROUPS).flat().sort()).toEqual(names(APP));
  });
  test("every Me page but index is behind Me's guard", () => {
    expect([...ME_PAGES, "index"].sort()).toEqual(names(join(APP, "(tabs)/me")));
  });
  test("a path in the tree is one whatever its params", () => {
    expect(isAppPath("/me/?a=1#b")).toBe(true);
    expect(isAppPath("/me/x")).toBe(false);
  });
});
