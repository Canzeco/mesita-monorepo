/**
 * @vitest-environment happy-dom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { SharePage } from "@/components/consumer/share/SharePage";
import { SHARE_CARD_STYLES } from "@/lib/share-app";

// Each style wears a meme photo (MESITA-2570). A photo that fails to load
// leaves the card as the plain style: message, link and swatches untouched.

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

function mount(): HTMLElement {
  document.body.innerHTML = `<div id="host"></div>`;
  const host = document.getElementById("host");
  if (!host) throw new Error("missing host");
  root = createRoot(host);
  act(() => {
    root?.render(<SharePage />);
  });
  return host;
}

const photo = (host: HTMLElement) =>
  host.querySelector<HTMLImageElement>("[data-invite-photo]");

describe("the invite card's photo", () => {
  it("changes with the style swatch", () => {
    const host = mount();
    for (const s of SHARE_CARD_STYLES) {
      act(() => {
        host
          .querySelector<HTMLButtonElement>(`[data-share-style="${s.id}"]`)
          ?.click();
      });
      expect(
        host
          .querySelector("[data-invite-card]")
          ?.getAttribute("data-invite-card"),
      ).toBe(s.id);
      expect(photo(host)?.getAttribute("src")).toBe(s.photo);
    }
  });

  it("drops a photo that fails, and the card keeps working", () => {
    const host = mount();
    const first = photo(host);
    expect(first).not.toBeNull();
    act(() => {
      first?.dispatchEvent(new Event("error"));
    });
    expect(photo(host)).toBeNull();
    const card = host.querySelector("[data-invite-card]");
    expect(card?.textContent).toContain("No credit. Just vibes.");
    expect(host.querySelector("[data-invite-message]")?.textContent).not.toBe(
      "",
    );

    // Another style still shows its own photo; the failed one stays off.
    const second = SHARE_CARD_STYLES[1];
    act(() => {
      host
        .querySelector<HTMLButtonElement>(`[data-share-style="${second.id}"]`)
        ?.click();
    });
    expect(photo(host)?.getAttribute("src")).toBe(second.photo);
    act(() => {
      host
        .querySelector<HTMLButtonElement>(
          `[data-share-style="${SHARE_CARD_STYLES[0].id}"]`,
        )
        ?.click();
    });
    expect(photo(host)).toBeNull();
  });
});
