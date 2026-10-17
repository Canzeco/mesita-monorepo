import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModeSignalProvider, ModeSignals } from "./ModeSignals";
import { DEFAULT_CONFIG } from "./catalog";
import { modeSignalViews } from "./mode-signals";

describe("mode signal views", () => {
  it("gives Word one scoring signal at 100% and hides randomness", () => {
    const views = modeSignalViews("word", DEFAULT_CONFIG);
    const name = views.find((view) => view.key === "name");
    expect(name?.active).toBe(true);
    expect(name?.contribution).toBe("Effective contribution: 100%");
    expect(name?.weightLabel).toBeNull();
    expect(views.find((view) => view.key === "randomness")?.hidden).toBe(true);
    expect(views.find((view) => view.key === "proximity")?.active).toBe(false);
  });

  it("hides randomness on Map and shows weights for its two scores", () => {
    const views = modeSignalViews("map", DEFAULT_CONFIG);
    expect(views.find((view) => view.key === "randomness")?.hidden).toBe(true);
    expect(views.find((view) => view.key === "proximity")?.weightLabel).toBe("Weight 1");
    expect(views.find((view) => view.key === "popularity")?.weightLabel).toBe("Weight 1");
    expect(views.find((view) => view.key === "timing")?.weightLabel).toBeNull();
    expect(views.find((view) => view.key === "category")?.label).toBe("Family");
  });

  it("gives Catalog the three live scores and leaves timing inactive", () => {
    const views = modeSignalViews("catalog", DEFAULT_CONFIG);
    expect(views.find((view) => view.key === "proximity")?.weightLabel).toBe("Weight 1 · Share 50%");
    expect(views.find((view) => view.key === "popularity")?.weightLabel).toBe("Weight 1 · Share 50%");
    expect(views.find((view) => view.key === "randomness")?.weightLabel).toBe("Weight 0 · Share Off");
    expect(views.find((view) => view.key === "timing")?.active).toBe(false);
    expect(views.find((view) => view.key === "category")?.active).toBe(true);
    expect(views.find((view) => view.key === "enriched")?.typeLabel).toBe("Binary gate");
    expect(views.find((view) => view.key === "name")?.active).toBe(false);
  });

  it("renders the Word contribution line", () => {
    const html = renderToStaticMarkup(
      <ModeSignalProvider initialConfig={DEFAULT_CONFIG} initialUpdatedAt={null} loadError={null}>
        <ModeSignals modeKey="word" />
      </ModeSignalProvider>,
    );
    expect(html).toContain("Effective contribution: 100%");
    expect(html).toContain("Name");
    expect(html).toContain("Relevance");
    expect(html).toContain("Inactive:");
    expect(html).not.toContain("Randomness");
  });
});
