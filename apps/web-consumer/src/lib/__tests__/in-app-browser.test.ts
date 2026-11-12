import { describe, expect, it } from "vitest";
import { isInAppBrowser } from "@/lib/in-app-browser";

// Continue with Google fails inside app webviews; the sheet must hide it
// there and only there (MESITA-3777).
describe("isInAppBrowser", () => {
  it.each([
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0]",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 WhatsApp/2.24",
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 musical_ly_2023",
  ])("hides Google inside an app webview: %s", (ua) => {
    expect(isInAppBrowser(ua)).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "",
  ])("keeps Google in a real browser: %s", (ua) => {
    expect(isInAppBrowser(ua)).toBe(false);
  });

  it("treats a missing user agent as a real browser", () => {
    expect(isInAppBrowser(null)).toBe(false);
  });
});
