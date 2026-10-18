import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PlaceCreatingPanel } from "./PlaceCreatingPanel";

describe("the Enrich slot while a Google-only profile is being created (MESITA-2307)", () => {
  it("spins and says the profile is being created", () => {
    const html = renderToStaticMarkup(<PlaceCreatingPanel error={null} />);
    expect(html).toContain("Creating profile");
    expect(html).toContain('aria-label="Creating profile"');
    expect(html).toContain('data-creating="creating"');
    expect(html).not.toContain("Vote to enrich");
  });

  it("says why when the create was refused, and stops spinning", () => {
    const html = renderToStaticMarkup(
      <PlaceCreatingPanel error="Google reports this place as permanently closed." />,
    );
    expect(html).toContain("Couldn&#x27;t create this profile");
    expect(html).toContain("permanently closed");
    expect(html).toContain('data-creating="failed"');
    expect(html).not.toContain('aria-label="Creating profile"');
    expect(html).not.toContain("Try again");
  });

  it("offers Try again when the screen can run the create again", () => {
    const html = renderToStaticMarkup(
      <PlaceCreatingPanel error="Over quota." onRetry={() => {}} />,
    );
    expect(html).toContain("Try again");
  });
});
