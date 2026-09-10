// The identity the proxy resolves, forwarded instead of bought twice
// (MESITA-1731).
//
// `auth.getUser()` is a network call — 114ms warm p50 against production — and
// the proxy pays it on every request the matcher covers. The render then paid
// it again, because a `cache()` cannot reach across the proxy/render boundary.
// Now the proxy writes what it resolved onto the forwarded request and
// `getServerUser` reads it.
//
// That makes a REQUEST HEADER load-bearing for identity, and a browser can put
// any header it likes on a request. Everything in the first describe below is
// about the one line that makes it safe.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  forwardedIdentityHeaders,
  USER_EMAIL_HEADER,
  USER_ID_HEADER,
} from "./supabase/middleware";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

/** Comments here explain the mechanism and therefore quote the very calls the
 *  structural rules forbid or require; the rules read code only. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const USER = { id: "6f1b0c62-1f4e-4a2f-9d3e-1c0a5b7e9f00", email: "op@example.com" };

describe("a forwarded identity cannot be forged", () => {
  it("drops an inbound identity header from a signed-out request", () => {
    // The attack, in one line: send the header yourself and be read as
    // whoever you named. Without the strip, `getServerUser` returns this id.
    const inbound = new Headers({ [USER_ID_HEADER]: "attacker-supplied" });
    const out = forwardedIdentityHeaders(inbound, null);
    expect(out.get(USER_ID_HEADER)).toBeNull();
  });

  it("overwrites an inbound identity header rather than trusting it", () => {
    const inbound = new Headers({
      [USER_ID_HEADER]: "attacker-supplied",
      [USER_EMAIL_HEADER]: "attacker@example.com",
    });
    const out = forwardedIdentityHeaders(inbound, USER);
    expect(out.get(USER_ID_HEADER)).toBe(USER.id);
    expect(out.get(USER_EMAIL_HEADER)).toBe(USER.email);
  });

  it("strips whatever the casing was", () => {
    // Header lookup is case-insensitive per the fetch spec, but a strip
    // written as an exact-name comparison would still miss this — and the
    // miss is silent.
    const inbound = new Headers({ "X-Mesita-User-Id": "attacker-supplied" });
    expect(forwardedIdentityHeaders(inbound, null).get(USER_ID_HEADER)).toBeNull();
  });

  it("strips every x-mesita-* name, not just the two it sets", () => {
    // The prefix is the rule, so a third forwarded fact added later is
    // covered the day it is added rather than the day someone remembers.
    const inbound = new Headers({ "x-mesita-super-admin": "true" });
    const out = forwardedIdentityHeaders(inbound, USER);
    expect(out.get("x-mesita-super-admin")).toBeNull();
  });

  it("leaves every other header alone", () => {
    const inbound = new Headers({
      cookie: "sb-access-token=abc",
      "user-agent": "probe/1.0",
      "x-forwarded-for": "203.0.113.7",
    });
    const out = forwardedIdentityHeaders(inbound, USER);
    expect(out.get("cookie")).toBe("sb-access-token=abc");
    expect(out.get("user-agent")).toBe("probe/1.0");
    expect(out.get("x-forwarded-for")).toBe("203.0.113.7");
  });
});

describe("what the header says", () => {
  it("carries id and email for a signed-in request", () => {
    const out = forwardedIdentityHeaders(new Headers(), USER);
    expect(out.get(USER_ID_HEADER)).toBe(USER.id);
    expect(out.get(USER_EMAIL_HEADER)).toBe(USER.email);
  });

  it("omits the email header entirely when the user has none", () => {
    // Absent and empty are different facts: the Account screen renders
    // `user.email ?? "—"`, and an empty string would print as blank instead.
    const out = forwardedIdentityHeaders(new Headers(), { id: USER.id, email: null });
    expect(out.get(USER_ID_HEADER)).toBe(USER.id);
    expect(out.has(USER_EMAIL_HEADER)).toBe(false);
  });

  it("writes nothing at all for a signed-out request", () => {
    const out = forwardedIdentityHeaders(new Headers(), null);
    expect(out.has(USER_ID_HEADER)).toBe(false);
    expect(out.has(USER_EMAIL_HEADER)).toBe(false);
  });
});

describe("the proxy still refreshes the session it validated", () => {
  const MIDDLEWARE = codeOnly(read("lib/supabase/middleware.ts"));

  it("attaches the refreshed cookies to every response, redirects included", () => {
    // The bug this rule exists for, found while writing this change: the
    // response has to be built AFTER getUser() (the identity goes in its
    // request headers), and building a NextResponse discards the cookies set
    // on the previous one. A near-expired token would then be refreshed,
    // thrown away, and refreshed again on the next navigation — supabase-ssr's
    // "random logouts" failure, arriving as a slow leak rather than a crash.
    const answers = MIDDLEWARE.match(/return\s+[\s\S]{0,40}?NextResponse\.(next|redirect)\(/g) ?? [];
    expect(answers.length).toBeGreaterThan(0);
    for (const answer of answers) {
      // The one exception is the env-var bail-out, which returns before a
      // Supabase client exists and so has no cookies to carry.
      if (/NextResponse\.next\(/.test(answer) && !/withRefreshedCookies/.test(answer)) continue;
      expect(answer).toContain("withRefreshedCookies");
    }
    // Both redirects specifically — the signed-out wall and the signed-in
    // bounce are the two paths a reader is most likely to add a bare
    // `NextResponse.redirect` to.
    const redirects = MIDDLEWARE.match(/NextResponse\.redirect\(/g) ?? [];
    expect(redirects).toHaveLength(2);
    expect(MIDDLEWARE.match(/withRefreshedCookies\(NextResponse\.redirect\(/g)).toHaveLength(2);
  });

  it("resolves the identity before it builds the response, and not before getUser", () => {
    // Supabase's SSR docs: no code between createServerClient() and
    // getUser(), or sessions randomly drop. This change adds nothing there —
    // it only removes what came after.
    const created = MIDDLEWARE.indexOf("createServerClient<Database>(");
    const gotUser = MIDDLEWARE.indexOf("supabase.auth.getUser()");
    const forwarded = MIDDLEWARE.indexOf("forwardedIdentityHeaders(request.headers");
    expect(created).toBeGreaterThan(-1);
    expect(gotUser).toBeGreaterThan(created);
    expect(forwarded).toBeGreaterThan(gotUser);
  });
});

describe("the render reads the header instead of revalidating", () => {
  const SERVER = codeOnly(read("lib/supabase/server.ts"));

  it("getServerUser answers from the header before it ever builds a client", () => {
    const body = SERVER.slice(SERVER.indexOf("export const getServerUser"));
    const headerRead = body.indexOf(`forwarded.get(USER_ID_HEADER)`);
    const clientBuild = body.indexOf("createServerSupabase()");
    expect(headerRead).toBeGreaterThan(-1);
    expect(clientBuild).toBeGreaterThan(headerRead);
  });

  it("keeps the revalidating fallback", () => {
    // Not dead code: a route the proxy's matcher skips, or the build's
    // page-data pass, has no forwarded header and must still get a real
    // answer rather than a silent signed-out.
    const body = SERVER.slice(SERVER.indexOf("export const getServerUser"));
    expect(body).toContain("supabase.auth.getUser()");
  });
});
