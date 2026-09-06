import { describe, expect, it } from "vitest";
import { placeThumbUrl } from "./place-thumb";

const SUPABASE_ORIGINAL =
  "https://yjalywfzdelacdzccpgb.supabase.co/storage/v1/object/public/place-images/images/abc.jpg";

describe("placeThumbUrl", () => {
  it("rewrites a Supabase object URL to the render endpoint", () => {
    const out = placeThumbUrl(SUPABASE_ORIGINAL, 48);
    expect(out).toContain("/storage/v1/render/image/public/place-images/");
    expect(out).not.toContain("/storage/v1/object/public/");
  });

  it("asks for 2x the rendered box so the thumb stays sharp", () => {
    expect(placeThumbUrl(SUPABASE_ORIGINAL, 48)).toContain("width=96&height=96");
    expect(placeThumbUrl(SUPABASE_ORIGINAL, 32)).toContain("width=64&height=64");
  });

  it("crops rather than squashes, and trades quality for bytes", () => {
    const out = placeThumbUrl(SUPABASE_ORIGINAL);
    expect(out).toContain("resize=cover");
    expect(out).toContain("quality=70");
  });

  // The whole point of MESITA-1553: a row must never render the original.
  it("never returns an /object/ URL for a Supabase photo", () => {
    expect(placeThumbUrl(SUPABASE_ORIGINAL)).not.toContain("object/public");
  });

  it("leaves a foreign host alone — there is no transform to guess", () => {
    const google = "https://lh3.googleusercontent.com/places/abc=s1600";
    expect(placeThumbUrl(google)).toBe(google);
  });

  it("appends with & when the URL already carries a query", () => {
    const out = placeThumbUrl(`${SUPABASE_ORIGINAL}?token=x`);
    expect(out).toContain("?token=x&width=");
  });

  it("treats missing, empty and non-string photos as no photo", () => {
    expect(placeThumbUrl(null)).toBeNull();
    expect(placeThumbUrl(undefined)).toBeNull();
    expect(placeThumbUrl("   ")).toBeNull();
  });
});
