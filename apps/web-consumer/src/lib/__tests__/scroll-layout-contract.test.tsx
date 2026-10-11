import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/supabase/browser", () => ({ useBrowserSupabase: () => ({}) }));

import DiscoverScrollPage from "@/app/(shell)/(discovery)/discover/scroll/page";
import { HomeDeckProvider } from "@/components/consumer/home/HomeDeckContext";

// THE BLANK TAB, PINNED (MESITA-2105). Every child of the deck is absolutely
// positioned, so the deck has a height only if each box between the discover
// layout's flex column and the <ul> is DEFINITE. From a39d4f40 the page
// wrapper was a plain block, the deck root asked it for `flex-1`, got 0px, and
// the tab showed nothing but the filter disc for seventeen days — with
// typecheck, lint, 632 tests and the build all green. This is the same class
// of failure MESITA-1697 shipped once already. The node test environment
// cannot measure layout, so this pins the chain of boxes that makes the
// percentage heights resolve.
describe("Scroll's definite-height chain", () => {
  // React hoists the first photo's preload <link> to the front; the layout
  // starts after it.
  const html = renderToStaticMarkup(
    <HomeDeckProvider places={[]} fetchError={null}>
      <DiscoverScrollPage />
    </HomeDeckProvider>,
  ).replace(/^(<link [^>]*>)+/, "");

  it("the page slot is the positioned flex child", () => {
    expect(html.startsWith('<div class="relative min-h-0 flex-1 overflow-hidden">')).toBe(true);
  });

  it("the deck fills that slot absolutely, and the list fills the deck", () => {
    const deckRoot = '<div class="absolute inset-0">';
    expect(html).toContain(deckRoot);
    const afterRoot = html.slice(html.indexOf(deckRoot));
    expect(afterRoot).toMatch(
      /<ul[^>]*aria-label="Places"[^>]*class="[^"]*\babsolute inset-0\b[^"]*snap-y snap-mandatory/,
    );
  });

  it("renders full-height cards, not just the filter disc", () => {
    const cards = html.match(/<li aria-label="[^"]+, \d+ of 50"/g) ?? [];
    expect(cards).toHaveLength(50);
    expect(html).toContain('class="bg-background relative flex h-full w-full shrink-0 snap-start');
  });
});
