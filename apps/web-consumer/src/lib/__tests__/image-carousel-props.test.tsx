import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ImageCarousel } from "@/components/consumer/ImageCarousel";

// ImageCarousel serves two masters (MESITA-2105, eng review R1). The place
// page pages its photos with a single tap on the left or right third; Scroll
// needs a single tap to do NOTHING so a double tap can save. The opt-out props
// default to the place page's behaviour, and this pins both sides.
const PHOTOS = [
  "https://images.unsplash.com/photo-1-a?w=10",
  "https://images.unsplash.com/photo-2-b?w=10",
  "https://images.unsplash.com/photo-3-c?w=10",
];

describe("ImageCarousel's tap paging", () => {
  it("defaults keep the place page exactly as it was", () => {
    const html = renderToStaticMarkup(
      <ImageCarousel photos={PHOTOS} alt="Lupita" />,
    );
    expect(html).toContain('aria-label="Previous photo"');
    expect(html).toContain('aria-label="Next photo"');
    expect(html).toContain(">1 / 3</div>");
    // Passive dots: no buttons named for a photo, and no focusable track.
    expect(html).not.toContain("Lupita, photo 1 of 3");
    expect(html).not.toContain('tabindex="0"');
  });

  it("Scroll's props drop the tap zones and make the dots buttons", () => {
    const html = renderToStaticMarkup(
      <ImageCarousel
        photos={PHOTOS}
        alt="Lupita"
        tapToPage={false}
        interactiveDots
      />,
    );
    expect(html).not.toContain('aria-label="Previous photo"');
    expect(html).not.toContain('aria-label="Next photo"');
    for (const n of [1, 2, 3]) {
      expect(html).toContain(`<button type="button" aria-label="Lupita, photo ${n} of 3"`);
    }
    // The dots say where you are, so the "1 / 3" counter goes.
    expect(html).not.toContain(">1 / 3</div>");
    expect(html).toContain('tabindex="0"');
  });

  it("one photo has no paging at all, in either mode", () => {
    for (const props of [{}, { tapToPage: false, interactiveDots: true }]) {
      const html = renderToStaticMarkup(
        <ImageCarousel photos={PHOTOS.slice(0, 1)} alt="Lupita" {...props} />,
      );
      expect(html).not.toContain("Previous photo");
      expect(html).not.toContain("photo 1 of 1");
      expect(html).not.toContain('tabindex="0"');
    }
  });
});
