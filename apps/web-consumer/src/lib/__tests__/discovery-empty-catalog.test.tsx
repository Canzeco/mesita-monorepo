import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/supabase/browser", () => ({ useBrowserSupabase: () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/discover",
}));

import DiscoverSwipePage from "@/app/(shell)/(discovery)/discover/swipe/page";
import { HomeDeckProvider } from "@/components/consumer/home/HomeDeckContext";

// THE EMPTY CATALOG IS A SCREEN, NOT A BLANK (MESITA-2095). The sample deck
// that stood in for the catalog is deleted, and on the day it went the live
// catalog held zero places — so this is the first thing a guest sees on Swipe
// until real places land. Swipe must say so in words, draw no
// card, and keep "the request failed" apart from "there is nothing yet".

const MODES: Array<[string, () => ReactElement]> = [
  ["Swipe", () => <DiscoverSwipePage />],
];

const render = (page: ReactElement, fetchError: string | null = null) =>
  renderToStaticMarkup(
    <HomeDeckProvider places={[]} fetchError={fetchError}>
      {page}
    </HomeDeckProvider>,
  );

describe("an empty catalog", () => {
  it.each(MODES)("%s says there are no places yet and draws no card", (_mode, page) => {
    const html = render(page());
    expect(html).toContain("No places yet");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/<li aria-label="[^"]+, \d+ of \d+"/);
    expect(html).not.toContain('aria-label="Places"');
  });

  it.each(MODES)("%s tells a failed fetch apart from an empty catalog", (_mode, page) => {
    const html = render(page(), "consumer-web-recommend-swipe 502");
    expect(html).toContain("Couldn&#x27;t load");
    expect(html).not.toContain("No places yet");
  });

  // The deck is fetched once in the /discover layout, and a link to the URL
  // already on screen never re-runs it, so a retry that NAVIGATES draws this
  // same screen again. The retry is a button (router.refresh()), never a link.
  it.each(MODES)("%s offers a Try again that refreshes rather than navigates", (_mode, page) => {
    const html = render(page(), "consumer-web-recommend-swipe 502");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>(?:(?!<\/button>).)*Try again<\/button>/);
    expect(html).not.toMatch(/<a [^>]*>(?:(?!<\/a>).)*Try again/);
  });
});
