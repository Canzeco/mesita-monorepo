import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/supabase/browser", () => ({ useBrowserSupabase: () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/discover",
}));

import DiscoverScrollPage from "@/app/(shell)/(discovery)/discover/scroll/page";
import DiscoverSwipePage from "@/app/(shell)/(discovery)/discover/swipe/page";
import { HomeDeckProvider } from "@/components/consumer/home/HomeDeckContext";

// THE EMPTY CATALOG IS A SCREEN, NOT A BLANK (MESITA-2095). The sample deck
// that stood in for the catalog is deleted, and on the day it went the live
// catalog held zero places — so this is the first thing a guest sees on Swipe
// and Scroll until real places land. Both modes must say so in words, draw no
// card, and keep "the request failed" apart from "there is nothing yet".

const MODES: Array<[string, () => ReactElement]> = [
  ["Swipe", () => <DiscoverSwipePage />],
  ["Scroll", () => <DiscoverScrollPage />],
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

  // Scroll's page slot is a positioned block; EmptyState needs a flex column
  // around it or it hugs the top edge instead of sitting in the middle.
  it("Scroll centres the message in a positioned flex column", () => {
    const html = render(<DiscoverScrollPage />);
    expect(html).toContain(
      '<div class="relative min-h-0 flex-1 overflow-hidden"><div class="absolute inset-0 flex flex-col"><div class="flex min-h-0 flex-1 flex-col items-center justify-center',
    );
  });
});
