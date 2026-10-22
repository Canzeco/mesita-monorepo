// MVP test rule (MESITA-2600): only the privacy/runtime guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SharePage } from "@/components/consumer/share/SharePage";
import { APP_SHARE_URL, SHARE_JOKES, shareLinks } from "@/lib/share-app";

// Share is a page (Pato, MESITA-2566): ten plain Mesita cards, one joke each
// (MESITA-2573: "just a stupid card of mesita with nothing else … 10
// different cards/jokes"), then buttons to send it.

const html = renderToStaticMarkup(<SharePage />);
const decode = (s: string) => decodeURIComponent(s.replace(/&amp;/g, "&"));

describe("the Share page", () => {
  it("sends the joke, then the bare front-door link — nothing else", () => {
    expect(APP_SHARE_URL).toBe("https://consumer.mesita.ai/");
    for (const joke of SHARE_JOKES) {
      for (const href of Object.values(shareLinks(joke))) {
        const text = decode(href);
        expect(text).toContain(`${joke} ${APP_SHARE_URL}`);
        expect(text).not.toMatch(/ref=|code=|uid=|utm_|\?id=/);
      }
    }
    const first = shareLinks(SHARE_JOKES[0]);
    expect(first.whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    expect(first.sms.startsWith("sms:")).toBe(true);
    const whatsapp = html.match(/href="(https:\/\/wa\.me\/[^"]*)"/)?.[1] ?? "";
    expect(decode(whatsapp)).toContain(
      `text=${SHARE_JOKES[0]} ${APP_SHARE_URL}`,
    );
  });

  // Other goes through the one share helper, so a sheet that fails copies
  // (one toast) instead of ending on an error (MESITA-2581; the outcomes are
  // pinned in share-place.test.ts and share-cards.test.tsx).
  it("sends Other through shareOrCopy, not a bare navigator.share", () => {
    const src = readFileSync(
      join(__dirname, "../../components/consumer/share/SharePage.tsx"),
      "utf8",
    );
    expect(src).toContain("shareOrCopy(");
    expect(src).not.toContain("navigator.share(");
  });
});
