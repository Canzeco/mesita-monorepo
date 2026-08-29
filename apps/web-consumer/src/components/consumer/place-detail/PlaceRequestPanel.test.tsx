import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  isPlaceRequestSurface,
  PlaceRequestPanelView,
  requestProgressLabel,
} from "./PlaceRequestPanel";

describe("request progress copy", () => {
  it("zero requests", () => {
    expect(requestProgressLabel(0, 3)).toBe("0 of 3 requests");
  });

  it("below-threshold requests", () => {
    expect(requestProgressLabel(2, 3)).toBe("2 of 3 requests");
  });

  it("threshold crossing", () => {
    expect(requestProgressLabel(3, 3)).toBe("3 of 3 requests");
  });
});

describe("request surface gate", () => {
  it("Listed-but-not-Enriched is the request interface", () => {
    expect(isPlaceRequestSurface({ is_profile_ready: false })).toBe(true);
    expect(isPlaceRequestSurface({ is_profile_ready: true })).toBe(false);
  });
});

describe("PlaceRequestPanel", () => {
  it("is the request interface, not a profile", () => {
    const html = renderToStaticMarkup(
      <PlaceRequestPanelView
        count={2}
        threshold={3}
        requested={false}
        enriching={false}
        pending={false}
        error={null}
      />,
    );
    expect(html).toContain("Profile not created yet");
    expect(html).toContain(
      "This place is on Mesita, but its profile hasn&#x27;t been created yet.",
    );
    expect(html).toContain("Request the profile");
    expect(html).toContain("2 of 3 requests");
    expect(html).not.toContain("Visit");
    expect(html).not.toContain("Reserve");
  });

  it("shows Requested after this consumer already voted", () => {
    const html = renderToStaticMarkup(
      <PlaceRequestPanelView
        count={1}
        threshold={3}
        requested={true}
        enriching={false}
        pending={false}
        error={null}
      />,
    );
    expect(html).toContain("Requested");
  });
});
