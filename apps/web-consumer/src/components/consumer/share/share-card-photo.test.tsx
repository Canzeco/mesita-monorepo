/**
 * @vitest-environment happy-dom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SharePage } from "@/components/consumer/share/SharePage";
import { SHARE_CARD_IMAGES, SHARE_CARD_STYLES } from "@/lib/share-app";

// The card is three params: image, message, style (MESITA-2570). A photo that
// fails to load leaves the card as the plain style: message, link and pickers
// untouched.

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
  vi.restoreAllMocks();
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

const tap = (host: HTMLElement, selector: string) =>
  act(() => {
    host.querySelector<HTMLElement>(selector)?.click();
  });
const photo = (host: HTMLElement) =>
  host.querySelector<HTMLImageElement>("[data-invite-photo]");
const card = (host: HTMLElement) =>
  host.querySelector<HTMLElement>("[data-invite-card]");

describe("the invite card's three params", () => {
  it("the image picker changes the photo; the style changes only the tint", () => {
    const host = mount();
    for (const img of SHARE_CARD_IMAGES) {
      tap(host, `[data-share-image="${img.id}"]`);
      expect(photo(host)?.getAttribute("src")).toBe(img.src);
    }
    const last = SHARE_CARD_IMAGES[SHARE_CARD_IMAGES.length - 1];
    for (const s of SHARE_CARD_STYLES) {
      tap(host, `[data-share-style="${s.id}"]`);
      expect(card(host)?.dataset.inviteCard).toBe(s.id);
      expect(photo(host)?.getAttribute("src")).toBe(last.src);
    }
  });

  it("Shuffle changes all three at once", () => {
    const host = mount();
    const before = {
      image: card(host)?.dataset.inviteImage,
      style: card(host)?.dataset.inviteCard,
      message: host.querySelector("[data-invite-message]")?.textContent,
    };
    tap(host, "[data-share-shuffle]");
    expect(card(host)?.dataset.inviteImage).not.toBe(before.image);
    expect(card(host)?.dataset.inviteCard).not.toBe(before.style);
    expect(host.querySelector("[data-invite-message]")?.textContent).not.toBe(
      before.message,
    );
  });

  it("drops a photo that fails, and the card keeps working", () => {
    const host = mount();
    const first = photo(host);
    expect(first).not.toBeNull();
    act(() => {
      first?.dispatchEvent(new Event("error"));
    });
    expect(photo(host)).toBeNull();
    expect(card(host)?.textContent).toContain("No credit. Just vibes.");
    expect(host.querySelector("[data-invite-message]")?.textContent).not.toBe(
      "",
    );

    // Another image still shows its own photo; the failed one stays off.
    const second = SHARE_CARD_IMAGES[1];
    tap(host, `[data-share-image="${second.id}"]`);
    expect(photo(host)?.getAttribute("src")).toBe(second.src);
    tap(host, `[data-share-image="${SHARE_CARD_IMAGES[0].id}"]`);
    expect(photo(host)).toBeNull();
  });
});

describe("Send it", () => {
  it("Instagram copies the message and link, then its link opens Instagram", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const host = mount();
    const row = host.querySelector<HTMLAnchorElement>(
      '[data-share-row="instagram"]',
    );
    expect(row?.getAttribute("target")).toBe("_blank");
    row?.addEventListener("click", (e) => e.preventDefault());
    await act(async () => {
      row?.click();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("https://consumer.mesita.ai/");
  });
});
