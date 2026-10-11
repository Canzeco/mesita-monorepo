import { beforeEach, describe, expect, it, vi } from "vitest";

// NO ANONYMOUS SESSIONS (Pato, MESITA-2137: "there are no anonymous sign-ins.
// should not now"). /web and /mob both sign in by phone, so the middleware
// wall is the same on both, and nothing ever mints an anonymous session.
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
      getUser: async () => ({ data: { user: state.user } }),
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
  updateSupabaseSession(new NextRequest(`https://consumer.mesita.ai${path}`));
const location = (res: Response) =>
  new URL(res.headers.get("location") ?? "", "https://x");

describe("both surfaces sign in by phone", () => {
  beforeEach(() => {
    state.user = null;
  });

  it.each(["web", "mob"])(
    "/%s walls a signed-out visitor at its own sign-in, keeping ?next=",
    async (surface) => {
      const res = await visit(`/${surface}/me`);
      expect(location(res).pathname).toBe(`/${surface}`);
      expect(location(res).searchParams.get("next")).toBe(`/${surface}/me`);
    },
  );

  it("never mints a session for a browse page", async () => {
    const res = await visit("/web/discover/feed");
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.getAll()).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ name: expect.stringMatching(/^sb-/) }),
      ]),
    );
  });

  it.each(["web", "mob"])(
    "a leftover anonymous session does not pass /%s's wall",
    async (surface) => {
      state.user = { id: "anon-1", is_anonymous: true };
      const res = await visit(`/${surface}/me`);
      expect(location(res).pathname).toBe(`/${surface}`);
    },
  );

  it.each(["web", "mob"])(
    "a registered account goes through /%s",
    async (surface) => {
      state.user = { id: "user-1", is_anonymous: false };
      const res = await visit(`/${surface}/me`);
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it.each(["web", "mob"])(
    "a registered account on /%s's sign-in page is bounced through post-signin",
    async (surface) => {
      state.user = { id: "user-1", is_anonymous: false };
      const res = await visit(`/${surface}`);
      expect(location(res).pathname).toBe(`/${surface}/auth/post-signin`);
    },
  );
});
