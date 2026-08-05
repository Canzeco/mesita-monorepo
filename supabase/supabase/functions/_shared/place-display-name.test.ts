import { assertEquals } from "jsr:@std/assert@1";
import {
  displayName,
  isStickyMesitaName,
  normalizePlaceName,
  stickyNamePatch,
  withDisplayName,
  withDisplayNames,
} from "./place-display-name.ts";

Deno.test("normalizePlaceName trims and NFKC-folds", () => {
  assertEquals(normalizePlaceName("  Café  "), "Café");
  // Compatibility: fullwidth digits fold under NFKC
  assertEquals(normalizePlaceName("\uFF11\uFF12"), "12");
});

Deno.test("displayName prefers Mesita name, then google_name", () => {
  assertEquals(
    displayName({ name: "Los Tacos Martin", google_name: "Tacos Martin" }),
    "Los Tacos Martin",
  );
  assertEquals(
    displayName({ name: "  ", google_name: "Tacos Martin" }),
    "Tacos Martin",
  );
  assertEquals(
    displayName({ name: null, google_name: "Tacos Martin" }),
    "Tacos Martin",
  );
  assertEquals(displayName({ name: null, google_name: null }), "(unnamed)");
});

Deno.test("withDisplayName overwrites name and keeps google_name", () => {
  const out = withDisplayName({
    id: "p1",
    name: "  ",
    google_name: "Tacos Martin",
    category: "tacos",
  });
  assertEquals(out.name, "Tacos Martin");
  assertEquals(out.google_name, "Tacos Martin");
  assertEquals(out.id, "p1");
  assertEquals(out.category, "tacos");
});

Deno.test("withDisplayNames maps a list", () => {
  const rows = withDisplayNames([
    { name: null, google_name: "A" },
    { name: "Custom", google_name: "B" },
  ]);
  assertEquals(rows.map((r) => r.name), ["A", "Custom"]);
});

Deno.test("isStickyMesitaName — empty tracks Google; customized does not", () => {
  assertEquals(isStickyMesitaName(null, "Tacos Martin"), true);
  assertEquals(isStickyMesitaName("", "Tacos Martin"), true);
  assertEquals(isStickyMesitaName("Tacos Martin", "Tacos Martin"), true);
  assertEquals(isStickyMesitaName("  Tacos Martin  ", "Tacos Martin"), true);
  assertEquals(isStickyMesitaName("Los Tacos Martin", "Tacos Martin"), false);
});

Deno.test("stickyNamePatch updates name only when sticky", () => {
  const sticky = stickyNamePatch({
    newGoogleName: "Tacos Martín",
    currentName: "Tacos Martin",
    previousGoogleName: "Tacos Martin",
  });
  assertEquals(sticky.sticky, true);
  assertEquals(sticky.google_name, "Tacos Martín");
  assertEquals(sticky.name, "Tacos Martín");

  const customized = stickyNamePatch({
    newGoogleName: "Tacos Martín",
    currentName: "Los Tacos Martin",
    previousGoogleName: "Tacos Martin",
  });
  assertEquals(customized.sticky, false);
  assertEquals(customized.google_name, "Tacos Martín");
  assertEquals(customized.name, undefined);
});
