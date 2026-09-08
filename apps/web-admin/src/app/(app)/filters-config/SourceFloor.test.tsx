import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "./catalog";
import { floorNumber, GENERAL_FLOOR_OWNER } from "./source-floor-copy";

vi.mock("./actions", () => ({
  getDiscoveryConfig: vi.fn(async () => ({
    ok: true,
    config: DEFAULT_CONFIG,
    updatedAt: "2026-09-08T00:00:00.000Z",
  })),
  updateDiscoveryConfig: vi.fn(),
}));

import {
  FiltersFloorOwner,
  FloorMirror,
  FloorSoonNote,
  GeneralFloorOwner,
  MapFloorOwner,
} from "./SourceFloor";

const seed = {
  initialConfig: DEFAULT_CONFIG,
  initialUpdatedAt: "2026-09-08T00:00:00.000Z",
  loadError: null,
};

describe("The quality floor inside a source box", () => {
  it("Autocomplete owns the General wipe — switch and count, both editable", () => {
    const html = renderToStaticMarkup(<GeneralFloorOwner seed={seed} />);
    expect(html).toContain("Only active places");
    expect(html).toContain("Minimum Google reviews");
    expect(html).toContain("unknown is not active");
    // It owns a Mesita source too: the name-embedding pool rides the same wipe.
    expect(html).toContain("Mesita Places Name Search");
    expect(html).toContain("<input");
  });

  it("a mirror shows the number and names its owner, with no input", () => {
    const html = renderToStaticMarkup(
      <FloorMirror
        rows={[{ label: "Minimum Google reviews", value: floorNumber(0) }]}
        ownedBy={GENERAL_FLOOR_OWNER}
      />,
    );
    expect(html).toContain("Minimum Google reviews");
    expect(html).toContain("0 — off");
    expect(html).toContain(GENERAL_FLOOR_OWNER);
    // The whole point of owner/mirror: redundancy is repetition, never a
    // second input that silently moves the first box's number.
    expect(html).not.toContain("<input");
    expect(html).not.toContain("Save");
  });

  it("a Soon source states the fact and never offers a field", () => {
    const html = renderToStaticMarkup(<FloorSoonNote />);
    expect(html).toContain("none");
    expect(html).toContain("No engine reads this source yet");
    expect(html).not.toContain("<input");
  });

  it("the two owned pool floors say what else they cut", () => {
    const map = renderToStaticMarkup(<MapFloorOwner seed={seed} />);
    expect(map).toContain("Minimum rating");
    expect(map).toContain("maxed with the listed-pool floor");

    const filters = renderToStaticMarkup(<FiltersFloorOwner seed={seed} />);
    // filters is not confined to this source — an operator must see that.
    expect(filters).toContain("Home rails");
    expect(filters).toContain("Swipe");
    expect(filters).toContain("reach for the count first");
  });

  it("0 reads as off rather than as a bare number", () => {
    expect(floorNumber(0)).toBe("0 — off");
    expect(floorNumber(25)).toBe("25");
  });
});
