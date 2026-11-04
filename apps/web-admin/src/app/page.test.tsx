import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The door to the console (MESITA-3261): a session goes on, no session gets the
// Google button, a failed sign-in says why. Real Google sign-in is not proved
// here; Supabase is mocked.
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { getUser } }),
}));
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@/components/auth/GoogleSignInButton", () => ({
  GoogleSignInButton: () => <button>Google</button>,
}));

import AdminRootPage from "./page";

const open = async (error?: string) =>
  renderToStaticMarkup(await AdminRootPage({ searchParams: Promise.resolve({ error }) }));

describe("admin sign-in", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockClear();
  });

  it("sends a session on to Multiple Places", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await expect(open()).rejects.toThrow("redirect:/manage-multiple");
  });

  it("shows the Google button and no error without a session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const html = await open();
    expect(html).toContain("Google");
    expect(html).not.toContain("failed");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("says why a failed sign-in failed", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await open("oauth_failed")).toContain("Google sign-in failed");
  });
});
