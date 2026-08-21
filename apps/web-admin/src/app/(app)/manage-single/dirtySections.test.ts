import { describe, expect, it } from "vitest";
import {
  dirtyDialogNavBody,
  dirtyDialogReenrichBody,
  dirtyDialogTitle,
  dirtySectionLabels,
} from "./dirtySections";

describe("dirtySectionLabels", () => {
  it("returns labels in UI order", () => {
    expect(
      dirtySectionLabels({
        visits: true,
        place: true,
        products: true,
      }),
    ).toEqual(["Place", "Products", "Visits"]);
  });

  it("omits falsey keys", () => {
    expect(dirtySectionLabels({ place: false, products: true })).toEqual([
      "Products",
    ]);
  });

  it("includes Settings keys", () => {
    expect(
      dirtySectionLabels({
        reservations: true,
        visits: true,
      }),
    ).toEqual(["Visits", "Reservations"]);
  });
});

describe("dirtyDialogTitle", () => {
  it("names a single section", () => {
    expect(dirtyDialogTitle(["Products"])).toBe("Unsaved Products edits");
  });

  it("uses generic title for multiple", () => {
    expect(dirtyDialogTitle(["Place", "Products"])).toBe("Unsaved edits");
  });
});

describe("dirtyDialog bodies", () => {
  it("names one section in nav copy", () => {
    expect(dirtyDialogNavBody(["Check PIN"])).toContain("Check PIN");
    expect(dirtyDialogNavBody(["Check PIN"])).toContain("Discard them to leave");
  });

  it("lists multiple sections", () => {
    const body = dirtyDialogNavBody(["Place", "Reservations"]);
    expect(body).toContain("Place, Reservations");
  });

  it("mentions sections in reenrich copy", () => {
    expect(dirtyDialogReenrichBody(["Products"])).toContain("Products");
    expect(dirtyDialogReenrichBody(["Place", "Products"])).toContain(
      "Place, Products",
    );
  });
});
