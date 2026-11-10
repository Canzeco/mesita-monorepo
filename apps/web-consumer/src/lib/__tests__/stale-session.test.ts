import { describe, expect, it } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { clearSessionHref, isTransientAuthError } from "@/lib/stale-session";

// MESITA-3590 (auth): a deleted user's cookie must be cleared, never a live
// guest's on an Auth outage.
describe("isTransientAuthError", () => {
  it("never treats a deleted user or a missing session as transient", () => {
    expect(isTransientAuthError(new AuthApiError("User from sub claim in JWT does not exist", 403, "user_not_found"))).toBe(false);
    expect(isTransientAuthError(new AuthSessionMissingError())).toBe(false);
    expect(isTransientAuthError(null)).toBe(false);
  });

  it("treats an unreachable or failing Auth as transient", () => {
    expect(isTransientAuthError(new AuthRetryableFetchError("fetch failed", 0))).toBe(true);
    expect(isTransientAuthError(new AuthApiError("upstream", 503, undefined))).toBe(true);
  });
});

describe("clearSessionHref", () => {
  it("keeps a safe next and drops an open redirect", () => {
    expect(clearSessionHref("/wallet")).toBe("/auth/clear-session?next=%2Fwallet");
    expect(clearSessionHref("//evil.com")).toBe("/auth/clear-session");
  });
});
