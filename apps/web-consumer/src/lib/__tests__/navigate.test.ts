// navigateTo is a plain push or replace since MESITA-3013: the app lives at
// its real paths, so there is no prefix to add and no reload to fall back to.

import { describe, expect, it, vi } from "vitest";
import { navigateTo } from "../navigate";

describe("navigateTo", () => {
  it("pushes the href as is", () => {
    const router = { push: vi.fn(), replace: vi.fn() };
    navigateTo(router, "/place/casa");
    expect(router.push).toHaveBeenCalledWith("/place/casa");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("replaces when asked, keeping Back clean", () => {
    const router = { push: vi.fn(), replace: vi.fn() };
    navigateTo(router, "/place/casa", { replace: true });
    expect(router.replace).toHaveBeenCalledWith("/place/casa");
    expect(router.push).not.toHaveBeenCalled();
  });
});
