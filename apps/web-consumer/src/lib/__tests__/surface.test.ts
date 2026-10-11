import { describe, expect, it } from "vitest";

import {
  barePath,
  prefixPath,
  resolveSurface,
  surfaceOf,
} from "../surface";

describe("surface paths", () => {
  it("strips only a leading surface segment", () => {
    expect(barePath("/web")).toBe("/");
    expect(barePath("/web/search")).toBe("/search");
    expect(barePath("/mob/visit/abc")).toBe("/visit/abc");
    expect(barePath("/search")).toBe("/search");
    expect(barePath("/website")).toBe("/website");
  });

  it("prefixes in-app paths and leaves the rest", () => {
    expect(prefixPath("web", "/search")).toBe("/web/search");
    expect(prefixPath("mob", "/")).toBe("/mob");
    expect(prefixPath("web", "/web/me")).toBe("/web/me");
    expect(prefixPath("web", "/api/version")).toBe("/api/version");
    expect(prefixPath("mob", "https://mesita.ai")).toBe("https://mesita.ai");
  });

  it("reads the surface off the path", () => {
    expect(surfaceOf("/mob/discover/scroll")).toBe("mob");
    expect(surfaceOf("/web")).toBe("web");
    expect(surfaceOf("/me")).toBeNull();
  });

  it("sends a bare path to the cookie surface, defaulting to web", () => {
    expect(resolveSurface("/search", null)).toEqual({
      kind: "redirect",
      pathname: "/web/search",
      surface: "web",
    });
    expect(resolveSurface("/", "mob")).toEqual({
      kind: "redirect",
      pathname: "/mob",
      surface: "mob",
    });
    expect(resolveSurface("/web/wallet", "mob")).toEqual({
      kind: "rewrite",
      bare: "/wallet",
      surface: "web",
    });
    expect(resolveSurface("/api/version", null)).toEqual({ kind: "skip" });
  });
});
