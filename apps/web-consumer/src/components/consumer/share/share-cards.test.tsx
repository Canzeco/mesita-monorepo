/**
 * @vitest-environment happy-dom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast }));

import { SharePage } from "@/components/consumer/share/SharePage";
import {
  APP_SHARE_URL,
  INSTAGRAM_DM_URL,
  SHARE_BODY,
  SHARE_MESSAGE,
} from "@/lib/share-app";

// One plain card, one message (MESITA-2622); every button sends it.

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

describe("Send it (MESITA-2581: every button does something)", () => {
  function stub(key: string, value: unknown) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }

  afterEach(() => {
    stub("share", undefined);
    stub("canShare", undefined);
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  async function tap(host: HTMLElement, row: string) {
    await act(async () => {
      host.querySelector<HTMLElement>(`[data-share-row="${row}"]`)?.click();
    });
  }

  it("SMS opens Messages with the message and link as the body", () => {
    const host = mount();
    const href = host
      .querySelector('[data-share-row="sms"]')
      ?.getAttribute("href");
    expect(href?.startsWith("sms:?&body=")).toBe(true);
    expect(decode(href)).toContain(SHARE_BODY);
  });

  it("WhatsApp opens wa.me with the message and link, in a new tab", () => {
    const host = mount();
    const row = host.querySelector('[data-share-row="whatsapp"]');
    expect(row?.getAttribute("href")?.startsWith("https://wa.me/?text=")).toBe(
      true,
    );
    expect(row?.getAttribute("target")).toBe("_blank");
    expect(decode(row?.getAttribute("href"))).toContain(SHARE_BODY);
  });

  it("Instagram copies the message and link FIRST, says so, then opens the inbox", async () => {
    const order: string[] = [];
    const writeText = vi.fn(async () => {
      order.push("copy");
    });
    stub("clipboard", { writeText });
    const open = vi.spyOn(window, "open").mockImplementation(() => {
      order.push("open");
      return {} as Window;
    });
    const host = mount();
    await tap(host, "instagram");
    expect(writeText).toHaveBeenCalledWith(SHARE_BODY);
    expect(open).toHaveBeenCalledWith(INSTAGRAM_DM_URL, "_blank");
    expect(order).toEqual(["copy", "open"]);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success.mock.calls[0][0]).toMatch(/Instagram/);
  });

  it("Other opens the phone's share sheet with the message and the link", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stub("share", share);
    const writeText = vi.fn();
    stub("clipboard", { writeText });
    const host = mount();
    await tap(host, "other");
    expect(share).toHaveBeenCalledWith({
      title: "Mesita",
      text: SHARE_MESSAGE,
      url: APP_SHARE_URL,
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("Other copies with one toast when the sheet is missing or fails, and is silent on cancel", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub("clipboard", { writeText });
    const host = mount();

    await tap(host, "other"); // no sheet (desktop)
    stub(
      "share",
      vi.fn().mockRejectedValue(new DOMException("x", "NotAllowedError")),
    );
    await tap(host, "other"); // the sheet refuses
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenLastCalledWith(SHARE_BODY);
    expect(toast.success).toHaveBeenCalledTimes(2);
    expect(toast.error).not.toHaveBeenCalled();

    stub(
      "share",
      vi.fn().mockRejectedValue(new DOMException("x", "AbortError")),
    );
    await tap(host, "other"); // the guest closes it
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledTimes(2);
  });
});
