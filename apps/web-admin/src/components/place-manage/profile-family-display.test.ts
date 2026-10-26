// MVP test rule (MESITA-2600): only the EF contract guard stays; UI pins were removed (MESITA-2601).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "src/components/place-manage");

describe("the profile page does not fetch a second door", () => {
  const files = [
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
