// deno test supabase/functions/_shared/consumer-search-lane.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import {
  laneDedupeKeys,
  membershipTone,
  mergeSearchLane,
  SEARCH_LANE_CAP,
  type LaneItem,
} from "./consumer-search-lane.ts";

function item(over: Partial<LaneItem> & Pick<LaneItem, "placeId" | "mainText">): LaneItem {
  return {
    secondaryText: over.secondaryText ?? "",
    status: over.status ?? "not_in_mesita",
    partner: over.partner ?? false,
    ...over,
  };
}

function emptyLanes(): Record<
  "autocomplete" | "text" | "name" | "summary",
  LaneItem[]
> {
  return { autocomplete: [], text: [], name: [], summary: [] };
}

Deno.test("membershipTone: partner red, listed gray, google-only yellow", () => {
  assertEquals(
    membershipTone({ status: "web_listed", partner: true }),
    "partner",
  );
  assertEquals(
    membershipTone({ status: "web_listed", partner: false }),
    "listed",
  );
  assertEquals(
    membershipTone({ status: "not_in_mesita", partner: true }),
    "google",
  );
  assertEquals(
    membershipTone({ status: "verified_partner_other", partner: true }),
    "partner",
  );
});

Deno.test("laneDedupeKeys prefers google_place_id then Mesita id", () => {
  assertEquals(laneDedupeKeys({ placeId: "ChIJ1", mesitaId: "uuid-1" }), [
    "g:ChIJ1",
    "m:uuid-1",
  ]);
  assertEquals(laneDedupeKeys({ placeId: "", mesitaId: "uuid-1" }), [
    "m:uuid-1",
  ]);
});

Deno.test("mergeSearchLane: Autocomplete wins over Text Search for the same google id", () => {
  const lanes = emptyLanes();
  lanes.autocomplete = [
    item({ placeId: "ChIJ1", mainText: "Auto Strana" }),
  ];
  lanes.text = [
    item({
      placeId: "ChIJ1",
      mainText: "Text Strana",
      secondaryText: "Río Caura",
    }),
  ];
  const out = mergeSearchLane(lanes);
  assertEquals(out.length, 1);
  assertEquals(out[0].mainText, "Auto Strana");
  assertEquals(out[0].secondaryText, "Río Caura");
});

Deno.test("mergeSearchLane: rank is Autocomplete, then Text, then Name, then Summary", () => {
  const lanes = emptyLanes();
  lanes.summary = [item({ placeId: "g4", mainText: "Summary" })];
  lanes.name = [item({ placeId: "g3", mainText: "Name", mesitaId: "m3" })];
  lanes.text = [item({ placeId: "g2", mainText: "Text" })];
  lanes.autocomplete = [item({ placeId: "g1", mainText: "Auto" })];
  const out = mergeSearchLane(lanes);
  assertEquals(out.map((p) => p.mainText), ["Auto", "Text", "Name", "Summary"]);
});

Deno.test("mergeSearchLane: same Mesita id from name + summary keeps the name slot", () => {
  const lanes = emptyLanes();
  lanes.name = [
    item({
      placeId: "ChIJ-name",
      mainText: "Strana",
      mesitaId: "mesita-1",
      status: "web_listed",
    }),
  ];
  lanes.summary = [
    item({
      placeId: "ChIJ-summary-alias",
      mainText: "Strana vibe",
      mesitaId: "mesita-1",
      status: "web_listed",
    }),
  ];
  const out = mergeSearchLane(lanes);
  assertEquals(out.length, 1);
  assertEquals(out[0].mainText, "Strana");
  assertEquals(out[0].placeId, "ChIJ-name");
});

Deno.test("mergeSearchLane: later Mesita hit grafts partner onto an Autocomplete slot", () => {
  const lanes = emptyLanes();
  lanes.autocomplete = [
    item({ placeId: "ChIJ1", mainText: "Strana" }),
  ];
  lanes.name = [
    item({
      placeId: "ChIJ1",
      mainText: "Strana",
      mesitaId: "mesita-1",
      mesitaSlug: "strana",
      status: "web_listed",
      partner: true,
      lat: 25.65,
      lng: -100.4,
    }),
  ];
  const out = mergeSearchLane(lanes);
  assertEquals(out.length, 1);
  assertEquals(out[0].status, "web_listed");
  assertEquals(out[0].partner, true);
  assertEquals(out[0].mesitaId, "mesita-1");
  assertEquals(out[0].lat, 25.65);
  assertEquals(membershipTone(out[0]), "partner");
});

Deno.test("mergeSearchLane: Autocomplete filling 10 unique ids leaves no room for later sources", () => {
  const lanes = emptyLanes();
  lanes.autocomplete = Array.from({ length: 12 }, (_, i) =>
    item({ placeId: `auto-${i}`, mainText: `A${i}` })
  );
  lanes.text = [item({ placeId: "text-only", mainText: "Text only" })];
  lanes.name = [item({ placeId: "name-only", mainText: "Name only", mesitaId: "n1" })];
  const out = mergeSearchLane(lanes);
  assertEquals(out.length, SEARCH_LANE_CAP);
  assertEquals(out[0].placeId, "auto-0");
  assertEquals(out[9].placeId, "auto-9");
  assertEquals(out.some((p) => p.placeId === "text-only"), false);
  assertEquals(out.some((p) => p.placeId === "name-only"), false);
});

Deno.test("mergeSearchLane: after Autocomplete < 10, later unique places fill remaining slots", () => {
  const lanes = emptyLanes();
  lanes.autocomplete = [
    item({ placeId: "a1", mainText: "A1" }),
    item({ placeId: "a2", mainText: "A2" }),
  ];
  lanes.text = [
    item({ placeId: "a1", mainText: "A1-dup" }),
    item({ placeId: "t1", mainText: "T1" }),
  ];
  lanes.name = [item({ placeId: "n1", mainText: "N1", mesitaId: "m-n1" })];
  const out = mergeSearchLane(lanes);
  assertEquals(out.map((p) => p.placeId), ["a1", "a2", "t1", "n1"]);
});

Deno.test("mergeSearchLane: cap stays 10 when a later source only upgrades an existing slot", () => {
  const lanes = emptyLanes();
  lanes.autocomplete = Array.from({ length: 10 }, (_, i) =>
    item({ placeId: `g${i}`, mainText: `G${i}` })
  );
  lanes.name = [
    item({
      placeId: "g0",
      mainText: "G0 mesita",
      mesitaId: "mesita-0",
      status: "web_listed",
      partner: true,
    }),
    item({ placeId: "extra", mainText: "Should not appear", mesitaId: "x" }),
  ];
  const out = mergeSearchLane(lanes);
  assertEquals(out.length, 10);
  assertEquals(out[0].partner, true);
  assertEquals(out[0].mesitaId, "mesita-0");
  assertEquals(out.some((p) => p.placeId === "extra"), false);
});
