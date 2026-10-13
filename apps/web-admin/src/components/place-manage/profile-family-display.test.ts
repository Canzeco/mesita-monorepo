import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { shownFamily } from "./profile-family-display";
import type { ProfileRead } from "./actions";

const DIR = join(process.cwd(), "src/components/place-manage");

const profile: Pick<ProfileRead, "family" | "familyStored" | "categories"> = {
  family: { text: "🍸 Bars & Nightlife", inferred: false },
  familyStored: { text: "🍸 Bars & Nightlife", inferred: true },
  categories: [
    {
      slug: "nightclub",
      label: "Nightclub",
      section: "Nightlife",
      sort_order: 1,
      family_display: "🍸 Bars & Nightlife",
    },
    {
      slug: "karaoke",
      label: "Karaoke",
      section: "Nightlife",
      sort_order: 2,
      family_display: "🍸 Bars & Nightlife · 🎟️ Experiences",
    },
  ],
};

describe("shownFamily", () => {
  it("paints the stored resolution when the draft matches the row", () => {
    expect(shownFamily("nightclub", "nightclub", profile)).toEqual(profile.family);
  });

  it("paints the option's display when the draft category changes", () => {
    expect(shownFamily("karaoke", "nightclub", profile)).toEqual({
      text: "🍸 Bars & Nightlife · 🎟️ Experiences",
      inferred: false,
    });
  });

  it("paints the stored keys when the draft category is undefined", () => {
    expect(shownFamily("undefined", "nightclub", profile)).toEqual(profile.familyStored);
    expect(shownFamily("", "nightclub", profile)).toEqual(profile.familyStored);
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
