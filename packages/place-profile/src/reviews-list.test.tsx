/**
 * @vitest-environment happy-dom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PlaceProfile } from "./components/PlaceProfile";
import { placeRowToDetail } from "./place-to-detail";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
});

function review(author: string, rating: number, day: number) {
  return {
    author,
    rating,
    text: `${author} liked the room.`,
    published: `2026-10-${String(day).padStart(2, "0")}`,
  };
}

function mount() {
  document.body.innerHTML = `<div id="host"></div>`;
  const host = document.getElementById("host");
  if (!host) throw new Error("missing host");
  root = createRoot(host);
  const story = "A short presentation that stays fully visible. ".repeat(8);
  const place = placeRowToDetail({
    id: "p-1",
    mesita_name: "Strana",
    enriched_at: "2026-01-01T00:00:00Z",
    description: story,
    google_stars_overall: 3.8,
    google_review_count: 484,
    instagram_followers_count: 4321,
    facebook_followers: 8900,
    google_reviews: [
      review("R1", 1, 7),
      review("R2", 2, 6),
      review("R3", 3, 5),
      review("R4", 4, 4),
      review("R5", 5, 3),
      review("R6", 1, 2),
      review("R7", 1, 1),
    ],
  });
  act(() => {
    root?.render(<PlaceProfile place={place} />);
  });
}

function clickNamed(label: string) {
  const button = [...document.querySelectorAll("button")].find((el) =>
    el.textContent?.includes(label),
  );
  if (!button) throw new Error(`missing button ${label}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("Reviews is a vertical list", () => {
  it("keeps the channel counts on Overview and on Reviews (MESITA-2334)", () => {
    mount();
    const overview = document.body.textContent ?? "";
    expect(overview).toContain("3.8");
    expect(overview).toContain("3.8 ★ (484)");
    expect(overview).toContain("4.3K");
    expect(overview).toContain("8.9K");
    expect(overview).toContain("A short presentation");
    expect(overview).not.toContain("Show more");
    expect(document.body.innerHTML).toContain("Reserve a table");
    expect(document.body.innerHTML).toContain("Directions in Google Maps");

    clickNamed("Reviews");
    const reviews = document.body.textContent ?? "";
    expect(reviews).toContain("3.8 ★ (484)");
    expect(reviews).toContain("4.3K");
    expect(reviews).toContain("8.9K");
    expect(reviews).not.toContain("Google Summary");
    expect(reviews).not.toContain("Instagram Summary");
    expect(reviews).not.toContain("Facebook Summary");
    expect(document.body.innerHTML).toContain("Reserve a table");
    expect(document.body.innerHTML).toContain("Directions in Google Maps");
    // No sort row and no count above the list (MESITA-2618): the header's
    // Google column already says how many.
    expect(reviews).not.toContain("Newest");
    expect(reviews).not.toContain("Highest");
    expect(reviews).not.toContain("Lowest");
    expect(reviews).not.toContain("484 reviews");
  });

  it("shows a first batch, then Show more reveals the next reviews", () => {
    mount();
    clickNamed("Reviews");
    // The REVIEWS list never scrolls sideways; the header's Reserve row of
    // times does, on purpose (MESITA-2633), so look inside the list only.
    const html =
      document.querySelector('section[aria-label="Reviews"]')?.outerHTML ?? "";
    expect(html).not.toContain("overflow-x-auto");
    expect(html).not.toContain("w-72");
    expect(html).not.toContain("snap-start");
    expect(html).toContain("flex-col");

    let text = document.body.textContent ?? "";
    for (const name of ["R1", "R2", "R3", "R4", "R5"]) {
      expect(text).toContain(name);
    }
    expect(text).not.toContain("R6");
    expect(text).not.toContain("R7");
    expect(text).toContain("Show more");

    clickNamed("Show more");
    text = document.body.textContent ?? "";
    expect(text).toContain("R6");
    expect(text).toContain("R7");
    expect(text).not.toContain("Show more");
  });
});
