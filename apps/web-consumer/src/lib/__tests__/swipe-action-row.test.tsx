import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SwipeActionRow } from "@/components/consumer/home/swipe/swipe-action-row";

// Swipe's rail is shared by every card, so a place that takes no bookings
// greys Reserve out rather than dropping it: a vanished fifth button would
// re-centre the row and move Save under the thumb. Dead, labelled, and no
// longer announcing a dialog it cannot open.
const noop = () => {};
const render = (onReserve: (() => void) | null) =>
  renderToStaticMarkup(
    <SwipeActionRow
      saved={false}
      filtersActive={false}
      onOpenFilters={noop}
      onSkip={noop}
      onOpenInfo={noop}
      onSave={noop}
      onReserve={onReserve}
    />,
  );

const reserveButton = (html: string) =>
  html.match(/<button[^>]*aria-label="Reserve[^"]*"[^>]*>/)?.[0] ?? "";

describe("the swipe rail's Reserve", () => {
  it("opens the booking sheet for a place that takes bookings", () => {
    const btn = reserveButton(render(noop));
    expect(btn).toContain('aria-label="Reserve"');
    expect(btn).toContain('aria-haspopup="dialog"');
    expect(btn).not.toContain('disabled=""');
  });

  it("goes dead for a place that takes no bookings, keeping all five buttons", () => {
    const html = render(null);
    const btn = reserveButton(html);
    expect(btn).toContain('aria-label="Reserve (walk-in only)"');
    expect(btn).toContain('disabled=""');
    expect(btn).not.toContain("aria-haspopup");
    expect(html.match(/<button/g)).toHaveLength(5);
  });
});
