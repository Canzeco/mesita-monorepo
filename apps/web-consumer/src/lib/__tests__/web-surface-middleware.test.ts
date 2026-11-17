import { beforeEach, describe, expect, it, vi } from "vitest";

// NO ANONYMOUS SESSIONS (Pato, MESITA-2137: "there are no anonymous sign-ins.
// should not now"). One sign-in, by phone, and nothing ever mints an
// anonymous session. Since MESITA-3013 the app has one address space (no /web
// or /mob), and every shell tab is walled at the edge.
//
// The SSR client is faked at its boundary. `signInAnonymously` throws, so a
// regression that calls it again fails here loudly instead of quietly
// 422-ing against production, which has anonymous sign-ins off.
const state = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous: boolean },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      // The proxy verifies the JWT locally (MESITA-2784); a signed-out
      // request has no claims.
      getClaims: async () => ({
        data: state.user
          ? {
              claims: {
                sub: state.user.id,
                is_anonymous: state.user.is_anonymous,
              },
            }
          : null,
      }),
      signInAnonymously: async () => {
        throw new Error("anonymous sign-in must never be called (MESITA-2137)");
      },
    },
  }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_test";

const { NextRequest } = await import("next/server");
const { updateSupabaseSession } = await import("@/lib/supabase/middleware");

const visit = (path: string) =>
  updateSupabaseSession(new NextRequest(`https://mesita.ai${path}`));
const location = (res: Response) =>
  new URL(res.headers.get("location") ?? "", "https://x");

describe("the edge wall", () => {
  beforeEach(() => {
    state.user = null;
  });

  it.each(["/me", "/pay", "/wallet", "/place/abc/reserve"])(
    "%s walls a signed-out visitor at Sign, keeping ?next=",
    async (path) => {
      const res = await visit(`${path}?ref=ig`);
      expect(location(res).pathname).toBe("/sign");
      expect(location(res).searchParams.get("next")).toBe(`${path}?ref=ig`);
    },
  );

  // Anonymous mode (MESITA-4246): browsing needs no session.
  it.each(["/home/places", "/home/social", "/search", "/place/abc", "/sign"])(
    "%s opens for a signed-out visitor",
    async (path) => {
      const res = await visit(path);
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it("a signed-out / opens Home, or Sign when it carries a next", async () => {
    expect(location(await visit("/")).pathname).toBe("/home/places");
    const res = await visit("/?next=%2Fpay");
    expect(location(res).pathname).toBe("/sign");
    expect(location(res).searchParams.get("next")).toBe("/pay");
  });

  it("never mints a session for the sign-in page", async () => {
    const res = await visit("/sign");
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.getAll()).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ name: expect.stringMatching(/^sb-/) }),
      ]),
    );
  });

  it("a leftover anonymous session does not pass the wall", async () => {
    state.user = { id: "anon-1", is_anonymous: true };
    const res = await visit("/me");
    expect(location(res).pathname).toBe("/sign");
  });

  it("a registered account goes through, with its path stamped", async () => {
    state.user = { id: "user-1", is_anonymous: false };
    const res = await visit("/me");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-request-x-pathname")).toBe("/me");
  });

  it("a registered account on the sign-in page is bounced through post-signin", async () => {
    state.user = { id: "user-1", is_anonymous: false };
    const res = await visit("/");
    expect(location(res).pathname).toBe("/auth/post-signin");
  });
});
