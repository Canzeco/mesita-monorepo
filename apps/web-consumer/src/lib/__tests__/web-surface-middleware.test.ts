import { beforeEach, describe, expect, it, vi } from "vitest";

// The anonymous /web session (MESITA-2066). Supabase's SSR client writes a new
// session through `setAll`, and middleware is the only place those cookies
// can reach the browser. Bugbot caught two ways this PR lost them or misused
// them; both were silent in every other gate:
//
//   · the cookies were thrown away after signInAnonymously(), so every /web
//     load minted another anonymous user and none stuck;
//   · an anonymous /web session counted as signed in on /mob, skipping the
//     phone-OTP wall.
//
// The SSR client is faked at its boundary: `signInAnonymously` does exactly
// what the real one does to cookies — calls setAll with the session.
const state = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous: boolean },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: {
      cookies: {
        setAll: (
          c: { name: string; value: string; options?: Record<string, unknown> }[],
        ) => void;
      };
    },
  ) => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      signInAnonymously: async () => {
        opts.cookies.setAll([
          { name: "sb-test-auth-token", value: "anon-session", options: { path: "/" } },
        ]);
        state.user = { id: "anon-1", is_anonymous: true };
        return { data: {}, error: null };
      },
    },
  }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_test";

const { NextRequest } = await import("next/server");
const { updateSupabaseSession } = await import("@/lib/supabase/middleware");

const visit = (path: string) =>
  updateSupabaseSession(new NextRequest(`https://consumer.mesita.ai${path}`));

describe("the /web anonymous session", () => {
  beforeEach(() => {
    state.user = null;
  });

  it("is saved on the page response, not thrown away", async () => {
    const res = await visit("/web/discover/feed");
    expect(res.cookies.get("sb-test-auth-token")?.value).toBe("anon-session");
  });

  it("survives the redirect to get-the-app", async () => {
    const res = await visit("/web/me");
    expect(res.headers.get("location")).toContain("/web/get-the-app");
    expect(res.cookies.get("sb-test-auth-token")?.value).toBe("anon-session");
  });

  it("is never minted on /mob", async () => {
    const res = await visit("/mob/discover/feed");
    expect(res.cookies.get("sb-test-auth-token")).toBeUndefined();
  });

  it("does not get an anonymous guest past /mob's phone sign-in", async () => {
    state.user = { id: "anon-1", is_anonymous: true };
    const res = await visit("/mob/me");
    const location = new URL(res.headers.get("location") ?? "", "https://x");
    expect(location.pathname).toBe("/mob");
    expect(location.searchParams.get("next")).toBe("/mob/me");
  });

  it("lets a registered account through /mob", async () => {
    state.user = { id: "user-1", is_anonymous: false };
    const res = await visit("/mob/me");
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends /web's sign-in page to Home, not a hardcoded tab", async () => {
    const res = await visit("/web");
    expect(new URL(res.headers.get("location") ?? "", "https://x").pathname).toBe(
      "/web/discover/feed",
    );
  });
});
