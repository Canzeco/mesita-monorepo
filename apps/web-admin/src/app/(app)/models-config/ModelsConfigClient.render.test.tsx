import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Keeps the "use server" actions and their supabase-ef import out of the graph;
// a static render runs no handlers.
vi.mock("./actions", () => ({
  updateModelsConfig: vi.fn(),
  updateEnricherModelSettings: vi.fn(),
}));

import { ModelsConfigClient } from "./ModelsConfigClient";
import { coerceModelsConfig, type EnricherModelSettings } from "./types";

const ENRICHER: EnricherModelSettings = {
  synthesisQuality: "economy",
  visionQuality: "standard",
  perplexityPreset: "pro-search",
};

const render = (props: Parameters<typeof ModelsConfigClient>[0]) =>
  renderToStaticMarkup(<ModelsConfigClient {...props} />);

const radiosIn = (html: string) => (html.match(/role="radio"/g) ?? []).length;

describe("Models page (MESITA-2126)", () => {
  const html = render({
    initialConfig: coerceModelsConfig({ embeddings: { model: "text-embedding-3-small" } }),
    initialEnricher: ENRICHER,
    loadError: null,
  });

  it("asks four questions, each named by its job", () => {
    for (const label of [
      "Discovery chat",
      "Enricher writing",
      "Enricher photos",
      "Enricher web search",
    ]) {
      expect(html).toContain(`>${label}</label>`);
    }
    expect(html).toContain("Memo, the chat on Home › Chat.");
  });

  it("names each tier by model and price, two choices per tier row", () => {
    expect(html).toContain("gpt-4o-mini · ~$0.002 per place");
    expect(html).toContain("gpt-4o · ~$0.028 per place");
    expect(html).toContain("gpt-4o · ~$0.008 per photo");
    expect(radiosIn(html)).toBe(4);
  });

  it("shows the fixed models read-only", () => {
    expect(html).toContain("Not editable here");
    expect(html).toContain("Place search index");
    expect(html).toContain("text-embedding-3-small");
    expect(html).toContain("Enricher sorting and tagging");
  });

  it("no longer asks the dead questions", () => {
    expect(html).not.toContain("Edge Functions");
    expect(html).not.toContain("Ojo");
    expect(html).not.toContain("Visits");
    expect(html).not.toContain("high (=std)");
    expect(html).not.toContain("web answers");
  });

  it("shows a stored model that is off the list as current", () => {
    const off = render({
      initialConfig: coerceModelsConfig({ memo: { model: "gpt-4.5-preview" } }),
      initialEnricher: ENRICHER,
      loadError: null,
    });
    expect(off).toContain("gpt-4.5-preview (current, not in list)");
  });

  it("says there is no photos choice when both options run the same model", () => {
    const same = render({
      initialConfig: coerceModelsConfig({ enricher: { model: "gpt-4o" } }),
      initialEnricher: ENRICHER,
      loadError: null,
    });
    expect(same).toContain("Both options run gpt-4o.");
    expect(radiosIn(same)).toBe(2);
  });

  it("shows unavailable, never a default, when the load failed", () => {
    const failed = render({ initialConfig: null, initialEnricher: null, loadError: "EF down" });
    expect(failed).toContain("EF down");
    expect(failed).toContain("unavailable");
    expect(failed).not.toContain("gpt-4o");
    expect(failed).not.toContain("text-embedding");
    expect(radiosIn(failed)).toBe(0);
  });
});
