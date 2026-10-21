/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast }));

import { copyToClipboard, sharePlace, shareOrCopy } from "@/lib/share-place";

// Every share control goes through shareOrCopy (MESITA-2581: "make the share
// button functional"): the sheet where it opens, a copy and ONE toast where
// it is missing or fails, and silence when the guest closes it.

const DATA = {
  title: "Mesita",
  text: "Table for two?",
  url: "https://x.test/",
};
const FALLBACK = {
  text: "Table for two? https://x.test/",
  copied: "Copied",
  failed: "Nope",
};

function stubNavigator(props: {
  share?: unknown;
  canShare?: unknown;
  clipboard?: unknown;
}) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  stubNavigator({
    share: undefined,
    canShare: undefined,
    clipboard: { writeText },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("shareOrCopy", () => {
  it("opens the sheet with the data, and copies nothing", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share });
    expect(await shareOrCopy(DATA, FALLBACK)).toBe("shared");
    expect(share).toHaveBeenCalledWith(DATA);
    expect(writeText).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("stays silent when the guest closes the sheet", async () => {
    stubNavigator({
      share: vi.fn().mockRejectedValue(new DOMException("x", "AbortError")),
    });
    expect(await shareOrCopy(DATA, FALLBACK)).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each([
    ["NotAllowedError", new DOMException("x", "NotAllowedError")],
    ["InvalidStateError", new DOMException("x", "InvalidStateError")],
    ["a plain Error", new Error("boom")],
  ])("copies with one toast when the sheet throws %s", async (_, err) => {
    stubNavigator({ share: vi.fn().mockRejectedValue(err) });
    expect(await shareOrCopy(DATA, FALLBACK)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(FALLBACK.text);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Copied");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("copies with one toast where there is no sheet (desktop)", async () => {
    expect(await shareOrCopy(DATA, FALLBACK)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(FALLBACK.text);
    expect(toast.success).toHaveBeenCalledWith("Copied");
  });

  it("skips a sheet that refuses the data (canShare false)", async () => {
    const share = vi.fn();
    stubNavigator({ share, canShare: () => false });
    expect(await shareOrCopy(DATA, FALLBACK)).toBe("copied");
    expect(share).not.toHaveBeenCalled();
  });

  it("says it failed, once, when nothing can copy", async () => {
    stubNavigator({ clipboard: undefined });
    Object.defineProperty(document, "execCommand", {
      value: () => false,
      configurable: true,
    });
    expect(await shareOrCopy(DATA, FALLBACK)).toBe("failed");
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Nope");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("copyToClipboard", () => {
  it("falls back to the textarea copy when the Clipboard API refuses", async () => {
    stubNavigator({
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("focus")) },
    });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: exec,
      configurable: true,
    });
    expect(await copyToClipboard("hello")).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });
});

describe("sharePlace", () => {
  it("shares the bare place link, and copies it where there is no sheet", async () => {
    expect(
      await sharePlace({ id: "p1", slug: "taco-bar", name: "Taco Bar" }),
    ).toBe("copied");
    const url = writeText.mock.calls[0][0] as string;
    expect(new URL(url).pathname).toBe("/place/taco-bar");
    expect(new URL(url).search).toBe("");
    expect(toast.success).toHaveBeenCalledWith("Link copied");
  });
});
