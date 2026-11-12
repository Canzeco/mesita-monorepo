import { describe, expect, it } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import {
  LEAVE_EVERY_MS,
  clearSessionHref,
  isTransientAuthError,
  shouldLeaveDeadSession,
} from "@/lib/stale-session";

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

// MESITA-3808 (auth): a revoked session leaves for sign-in once, never loops.
describe("shouldLeaveDeadSession", () => {
  it("leaves a signed-in screen the first time", () => {
    expect(shouldLeaveDeadSession("/home/rows", null, 1_000)).toBe(true);
  });

  it("never leaves the sign-in screen or an /auth hop", () => {
    expect(shouldLeaveDeadSession("/", null, 1_000)).toBe(false);
    expect(shouldLeaveDeadSession("/auth/post-signin", null, 1_000)).toBe(false);
    expect(shouldLeaveDeadSession("/onboard", null, 1_000)).toBe(false);
  });

  it("waits a minute before leaving again", () => {
    expect(shouldLeaveDeadSession("/home/rows", 1_000, 1_000 + LEAVE_EVERY_MS - 1)).toBe(false);
    expect(shouldLeaveDeadSession("/home/rows", 1_000, 1_000 + LEAVE_EVERY_MS)).toBe(true);
  });
});
