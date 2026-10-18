import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Keeps the "use server" actions.ts and its supabase-ef import out of the graph; never called (static render runs no effects).
vi.mock("./actions", () => ({
  getAtlasSettings: vi.fn(),
  updateAtlasConfig: vi.fn(),
}));

import { CrenupClient } from "./CrenupClient";
import type { CrenupSettings } from "./crenup-guards";

const SETTINGS: CrenupSettings = {
  gatherGoogleImages: 10,
  gatherInstagramDepth: 10,
  gatherReviews: 100,
  imageVisionEnabled: true,
  saveImagesToStorage: true,
  saveTotalImages: 10,
  analyzeGoogleImages: 10,
  analyzeInstagramImages: 10,
  imageAnalysisPrompt: "",
  imageSortingPrompt: "",
  synthesisQuality: "economy",
  visionQuality: "economy",
  perplexityPreset: "pro-search",
  discoverWebsiteN: 5,
  discoverInstagramN: 5,
  discoverFacebookN: 3,
  discoverOpentableN: 3,
  discoverUbereatsN: 0,
  requestThreshold: 5,
  createOnOpenConsumer: true,
  createOnOpenAdmin: false,
  consumerCreatesPerDay: 1000,
};

describe("Creation › Create asks the two Create-on-open questions (MESITA-2298)", () => {
  it("draws one switch per app, each carrying its state", () => {
    const html = renderToStaticMarkup(
      <CrenupClient
        view="creation"
        initialSettings={SETTINGS}
        settingsUpdatedAt="2026-10-17T00:00:00.000Z"
        settingsLoadError={null}
        prompts={[]}
      />,
    );
    expect(html).toContain("Create the profile on open · consumer app");
    expect(html).toContain("Create the profile on open · admin app");
    expect(html).toContain("A guest opens a Google-only place from Map, the Feed, or Word.");
    expect(html).toContain("An admin opens a Google-only row from Single Place › Find.");
    expect(html).toMatch(
      /aria-pressed="true"[^>]*aria-label="Create the profile on open · consumer app"/,
    );
    expect(html).toMatch(
      /aria-pressed="false"[^>]*aria-label="Create the profile on open · admin app"/,
    );
    // Opening a list, a pin or a card never creates; the full profile does.
    expect(html).toContain("Opening the full profile");
  });
});
