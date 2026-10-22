// MVP test rule (MESITA-2600): only the privacy/runtime guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SharePage } from "@/components/consumer/share/SharePage";
import {
  APP_SHARE_URL,
  SHARE_BODY,
  SHARE_LINKS,
  SHARE_MESSAGE,
} from "@/lib/share-app";

// Share is a page (Pato, MESITA-2566): one plain Mesita card, one message
// (MESITA-2622: "just one card. keep it clearer."), then buttons to send it.

const html = renderToStaticMarkup(<SharePage />);
const decode = (s: string) => decodeURIComponent(s.replace(/&amp;/g, "&"));

describe("the Share page", () => {
  it("sends the message, then the bare front-door link — nothing else", () => {
    expect(APP_SHARE_URL).toBe("https://consumer.mesita.ai/");
    expect(SHARE_BODY).toBe(`${SHARE_MESSAGE} ${APP_SHARE_URL}`);
    for (const href of Object.values(SHARE_LINKS)) {
      const text = decode(href);
      expect(text).toContain(SHARE_BODY);
      expect(text).not.toMatch(/ref=|code=|uid=|utm_|\?id=/);
    }
    expect(SHARE_LINKS.whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    expect(SHARE_LINKS.sms.startsWith("sms:")).toBe(true);
    const whatsapp = html.match(/href="(https:\/\/wa\.me\/[^"]*)"/)?.[1] ?? "";
    expect(decode(whatsapp)).toContain(`text=${SHARE_BODY}`);
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
