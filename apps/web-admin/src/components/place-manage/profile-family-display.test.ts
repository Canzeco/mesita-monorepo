import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { shownFamily } from "./profile-family-display";
import type { ProfileRead } from "./actions";

const DIR = join(process.cwd(), "src/components/place-manage");

// Not a string literal on `section:`: config-section-callers.test.ts treats
// `section: "..."` as a config key the console posts to admin-web-update-config.
const nightlife = "Nightlife";
const other = "Other";
const profile: Pick<ProfileRead, "family" | "familyStored" | "categories"> = {
  family: { text: "🍸 Bars & Nightlife", inferred: false },
  familyStored: { text: "🍸 Bars & Nightlife", inferred: true },
  categories: [
    {
      slug: "nightclub",
      label: "Nightclub",
      section: nightlife,
      sort_order: 1,
      family_display: "🍸 Bars & Nightlife",
    },
    {
      slug: "karaoke",
      label: "Karaoke",
      section: nightlife,
      sort_order: 2,
      family_display: "🍸 Bars & Nightlife · 🎟️ Experiences",
    },
    {
      slug: "undefined",
      label: "Undefined",
      section: other,
      sort_order: 99,
      family_display: "❓ Undefined",
    },
  ],
};

describe("shownFamily", () => {
  it("paints the option display for a catalog slug, even when the stored family string is stale", () => {
    const stale = {
      ...profile,
      family: { text: "☕ Cafés & Desserts", inferred: false },
    };
    expect(shownFamily("nightclub", "nightclub", stale)).toEqual({
      text: "🍸 Bars & Nightlife",
      inferred: false,
    });
  });

  it("paints the stored resolution for a slug the vocabulary does not list", () => {
    expect(shownFamily("not_a_category", "not_a_category", profile)).toEqual(profile.family);
  });

  it("paints the option's display when the draft category changes", () => {
    expect(shownFamily("karaoke", "nightclub", profile)).toEqual({
      text: "🍸 Bars & Nightlife · 🎟️ Experiences",
      inferred: false,
    });
  });

  it("paints the undefined category's mapping, not keys copied onto the place", () => {
    expect(shownFamily("undefined", "nightclub", profile)).toEqual({
      text: "❓ Undefined",
      inferred: false,
    });
    expect(shownFamily("", "nightclub", profile)).toEqual({
      text: "❓ Undefined",
      inferred: false,
    });
  });
});

describe("the profile page does not fetch a second door", () => {
  const files = [
    "PlaceFamilyField.tsx",
    "PlaceCategorySelect.tsx",
    "PlaceTagsPicker.tsx",
    "sections/PlaceSection.tsx",
    "actions.ts",
  ];

  it("never calls the atlas vocabulary door", () => {
    for (const file of files) {
      const src = readFileSync(join(DIR, file), "utf8");
      expect(src, file).not.toContain("listPlaceTagCatalog");
      expect(src, file).not.toContain("admin-web-get-atlas-fields");
    }
  });
});
