/**
 * @vitest-environment happy-dom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SharePage } from "@/components/consumer/share/SharePage";
import { SHARE_JOKES, nearestCard, shareBody } from "@/lib/share-app";

// Ten plain cards, one joke each (MESITA-2573). The card in view is the one
// every button sends.

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

const decode = (s: string | null | undefined) => decodeURIComponent(s ?? "");

describe("the ten cards", () => {
  it("a dot picks its card, and every button then sends that card's joke", () => {
    const host = mount();
    const scrolled = vi.fn();
    const card = host.querySelector<HTMLElement>('[data-share-card="6"]');
    if (card) card.scrollIntoView = scrolled;
    act(() => {
      host.querySelector<HTMLButtonElement>('[data-share-dot="6"]')?.click();
    });
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(
      host.querySelector('[data-share-dot="6"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    const body = shareBody(SHARE_JOKES[6]);
    for (const row of ["sms", "whatsapp"]) {
      const href = host
        .querySelector(`[data-share-row="${row}"]`)
        ?.getAttribute("href");
      expect(decode(href)).toContain(body);
    }
    expect(host.querySelector("[data-share-preview]")?.textContent).toContain(
      body,
    );
  });

  it("the card in view is the one whose centre is nearest the row's", () => {
    const centers = [100, 400, 700, 1000];
    expect(nearestCard(0, centers)).toBe(0);
    expect(nearestCard(390, centers)).toBe(1);
    expect(nearestCard(560, centers)).toBe(2);
    expect(nearestCard(5000, centers)).toBe(3);
  });
});

describe("Send it", () => {
  it("Instagram copies the joke and link, then its link opens Instagram", async () => {
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
    expect(writeText.mock.calls[0][0]).toBe(shareBody(SHARE_JOKES[0]));
  });
});
