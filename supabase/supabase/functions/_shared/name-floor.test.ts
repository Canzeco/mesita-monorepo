// The Name box's Minimum Popularity (MESITA-3086): it only sorts Google
// places under it last on the guest Search bar; nothing is removed and no
// row carries a mark (the `underFloor` card rule of MESITA-2849 retired).
import { assertEquals } from "jsr:@std/assert@1";
import { demoteGoogleUnderFloor, type LaneItem } from "./name-pipeline.ts";

const row = (placeId: string, over: Partial<LaneItem> = {}): LaneItem => ({
  placeId,
  mainText: placeId,
  secondaryText: "",
  state: "not_in_mesita",
  ...over,
});

Deno.test("Google places under the floor sort last, in their own order; Mesita rows and Locations never move", () => {
  const thin = row("thin", { rating: 4, reviewCount: 4 }); // (1 + 16)^0.33 ≈ 2.55
  const ok = row("ok", { rating: 4, reviewCount: 5 }); // (1 + 20)^0.33 ≈ 2.73
  const unrated = row("unrated");
  const mesita = row("mesita", { state: "web_listed", rating: 1, reviewCount: 1 });
  const city = row("city", { kind: "location" });
  const out = demoteGoogleUnderFloor([thin, mesita, unrated, ok, city], 2.7, 0.33);
  assertEquals(out.items.map((i) => i.placeId), ["mesita", "ok", "city", "thin", "unrated"]);
  assertEquals(out.demoted, 2);
  assertEquals(out.unknown, 1);
  for (const item of out.items) assertEquals("underFloor" in item, false);
});

Deno.test("a floor of 0 keeps Google's order; the root moves the reading", () => {
  const thin = row("thin", { rating: 4, reviewCount: 4 });
  const ok = row("ok", { rating: 4, reviewCount: 500 });
  assertEquals(demoteGoogleUnderFloor([thin, ok], 0, 0.33).items.map((i) => i.placeId), ["thin", "ok"]);
  // At the square root 4★ × 4 reads (1 + 16)^0.5 ≈ 4.1, over 2.7: kept in front.
  assertEquals(demoteGoogleUnderFloor([thin, ok], 2.7, 0.5).demoted, 0);
});
