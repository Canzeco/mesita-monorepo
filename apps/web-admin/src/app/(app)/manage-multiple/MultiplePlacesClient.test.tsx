import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Keeps the "use server" actions.ts and its supabase-ef import out of the
// graph; never called (a static render runs no handlers). PlacesMap pulls
// the Google Maps loader, which a node render has no use for.
vi.mock("./actions", () => ({
  createPlaceFromGooglePlaceId: vi.fn(),
  deletePlace: vi.fn(),
  enrichPlace: vi.fn(),
  listAllPlaces: vi.fn(),
  searchPlacesByGoogleIds: vi.fn(),
  setPlaceListed: vi.fn(),
  setPlaceSelected: vi.fn(),
}));
vi.mock("@/components/PlacesMap", () => ({ PlacesMap: () => null }));

import { MultiplePlacesClient } from "./MultiplePlacesClient";
import { PIPELINE_STEPS } from "./pipeline";

const html = renderToStaticMarkup(<MultiplePlacesClient />);

/** The markup from one box's anchor to the next one's (or the end). */
function box(id: string): string {
  const start = html.indexOf(`id="${id}"`);
  const next = PIPELINE_STEPS.map((s) => html.indexOf(`id="${s.id}"`))
    .filter((i) => i > start)
    .sort((a, b) => a - b)[0];
  return html.slice(start, next ?? html.length);
}

/** The box's action buttons — every button but the ID field's own upload. */
function buttons(markup: string): string[] {
  return [...markup.matchAll(/<button[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/button>/g)]
    .map((m) => m[1].trim())
    .filter((label) => label !== "Upload CSV / TXT");
}

describe("Multiple Places renders six boxes (MESITA-2096, MESITA-2739)", () => {
  it("renders one anchored box per step, in rail order", () => {
    const at = PIPELINE_STEPS.map((s) => html.indexOf(`id="${s.id}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("puts Create, Enrich, Update Google and Edit actions in their own boxes", () => {
    expect(buttons(box("create"))).toEqual(["Create"]);
    expect(buttons(box("enrich"))).toEqual(["Enrich"]);
    expect(buttons(box("google-update"))).toEqual(["Update Google"]);
    expect(buttons(box("edit"))).toEqual([
      "Select",
      "Unselect",
      "Enable",
      "Disable",
      "Delete",
    ]);
  });

  it("gives every write box its own Google Place ID field", () => {
    for (const id of ["create", "enrich", "google-update", "edit"]) {
      expect(box(id)).toContain(`id="${id}-place-ids"`);
    }
  });

  it("shows the word Crenup nowhere", () => {
    expect(html).not.toMatch(/crenup/i);
  });
});
