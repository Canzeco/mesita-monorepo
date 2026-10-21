import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SharePage } from "@/components/consumer/share/SharePage";
import { APP_SHARE_LINKS, APP_SHARE_URL } from "@/lib/share-app";

// Share is a page (Pato, MESITA-2566: "create a dedicate page for share").

const html = renderToStaticMarkup(<SharePage />);
const decode = (s: string) => decodeURIComponent(s.replace(/&amp;/g, "&"));

describe("the Share page", () => {
  it("shows the app's link and the ways to send it", () => {
    expect(html).toContain("Share Mesita");
    expect(html).toContain("consumer.mesita.ai/");
    for (const row of ["whatsapp", "sms", "email", "copy"]) {
      expect(html).toContain(`data-share-row="${row}"`);
    }
  });

  it("offers the phone's sheet only where there is one (never on the server)", () => {
    expect(html).not.toContain('data-share-row="sheet"');
  });

  it("prefills every channel with the line and the bare front-door link", () => {
    expect(APP_SHARE_URL).toBe("https://consumer.mesita.ai/");
    for (const href of Object.values(APP_SHARE_LINKS)) {
      const text = decode(href);
      expect(text).toContain("Find great places to eat and book a table with Mesita.");
      expect(text).toContain(APP_SHARE_URL);
      // Nothing about the guest rides along: no referral code, no id.
      expect(text).not.toMatch(/ref=|code=|uid=|utm_|\?id=/);
    }
    expect(APP_SHARE_LINKS.whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    expect(APP_SHARE_LINKS.sms.startsWith("sms:")).toBe(true);
    expect(APP_SHARE_LINKS.email.startsWith("mailto:")).toBe(true);
  });

  // The bug that made this a page: one tap showed "Link copied" AND
  // "Couldn't share Mesita". Each tap has one outcome now.
  it("never falls from the share sheet through to the clipboard", () => {
    const src = readFileSync(
      join(__dirname, "../../components/consumer/share/SharePage.tsx"),
      "utf8",
    );
    const sheet = src.slice(src.indexOf("async function openShareSheet"), src.indexOf("export function SharePage"));
    expect(sheet).not.toContain("copyToClipboard");
    expect(sheet).not.toContain("copyLink");
  });
});
