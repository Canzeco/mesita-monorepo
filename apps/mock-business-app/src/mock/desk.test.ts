import { beforeEach, describe, expect, it } from "vitest";
import { MENU_SECTIONS } from "@/mock/fixtures";
import { PLACES } from "@/mock/fixtures";
import { DEFAULT_SCENARIO, resolveWorld } from "@/mock/scenario";
import {
  addDish,
  applyDesk,
  generateWebsite,
  getDesk,
  menuSectionsOf,
  publishedSectionsOf,
  pickWebsiteTemplate,
  publishMenu,
  publishWebsite,
  resetDesk,
} from "@/mock/desk";

beforeEach(() => resetDesk());

describe("desk", () => {
  it("publishes a menu and keeps the new dish", () => {
    const placeId = PLACES[0].id;
    addDish(placeId, MENU_SECTIONS[0].id, {
      name: "Salsa macha",
      blurb: "Chile, peanut, oil.",
      photoUrl: null,
      table: 9000,
      pickup: 9000,
      delivery: null,
    });
    const before = PLACES[0].menuPublishedAt;
    expect(publishedSectionsOf(placeId, before).some((s) => s.dishes.some((d) => d.name === "Salsa macha"))).toBe(false);
    publishMenu(placeId);
    const world = applyDesk(resolveWorld(DEFAULT_SCENARIO), getDesk());
    const place = world.places.find((p) => p.id === placeId);
    expect(place?.menuPublishedAt).toBeTruthy();
    expect(menuSectionsOf(placeId).some((s) => s.dishes.some((d) => d.name === "Salsa macha"))).toBe(true);
    expect(publishedSectionsOf(placeId, place?.menuPublishedAt ?? null).some((s) => s.dishes.some((d) => d.name === "Salsa macha"))).toBe(true);
  });

  it("walks a site from nothing to published", () => {
    const id = "plc_pardo";
    pickWebsiteTemplate(id, "cafe", "none");
    expect(getDesk().places[id].websiteState).toBe("picked");
    expect(getDesk().places[id].websiteTemplate).toBe("cafe");
    generateWebsite(id);
    expect(getDesk().places[id].websiteState).toBe("preview");
    publishWebsite(id);
    const world = applyDesk(resolveWorld({ ...DEFAULT_SCENARIO, mode: "multi" }), getDesk());
    expect(world.places.find((p) => p.id === id)?.websiteState).toBe("published");
  });
});
