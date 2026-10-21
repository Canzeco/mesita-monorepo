import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SharePage } from "@/components/consumer/share/SharePage";
import {
  APP_SHARE_URL,
  INSTAGRAM_DM_URL,
  SHARE_JOKES,
  shareLinks,
} from "@/lib/share-app";

// Share is a page (Pato, MESITA-2566): ten plain Mesita cards, one joke each
// (MESITA-2573: "just a stupid card of mesita with nothing else … 10
// different cards/jokes"), then buttons to send it.

const html = renderToStaticMarkup(<SharePage />);
const decode = (s: string) => decodeURIComponent(s.replace(/&amp;/g, "&"));

describe("the Share page", () => {
  it("is ten cards, each a different joke, the first one picked", () => {
    expect(SHARE_JOKES).toHaveLength(10);
    expect(new Set(SHARE_JOKES).size).toBe(10);
    expect(html.match(/data-share-card=/g)).toHaveLength(10);
    expect(html.match(/data-share-dot=/g)).toHaveLength(10);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    for (const joke of SHARE_JOKES) {
      expect(html).toContain(
        joke.replace(/&/g, "&amp;").replace(/'/g, "&#x27;"),
      );
    }
  });

  it("is a plain card: the mark, the joke, the link — no photo, no style, no credit", () => {
    expect(html).toContain("consumer.mesita.ai");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(
      /data-share-style|data-share-message|data-share-shuffle/,
    );
    const cards = html.slice(
      html.indexOf("data-share-cards"),
      html.indexOf("data-share-dot"),
    );
    expect(cards).not.toMatch(/\$|balance|credits?\b|code/i);
  });

  it("sends with four buttons in order: SMS, Instagram, WhatsApp, Other", () => {
    const rows = [...html.matchAll(/data-share-row="(\w+)"/g)].map((m) => m[1]);
    expect(rows).toEqual(["sms", "instagram", "whatsapp", "other"]);
    expect(html).toContain(`href="${INSTAGRAM_DM_URL}"`);
  });

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

  // Every button wears its channel's own icon (MESITA-2581: "add the share
  // icons and all that").
  it("draws each channel's icon in its own circle", () => {
    const icons = [...html.matchAll(/data-share-icon="(\w+)"/g)].map(
      (m) => m[1],
    );
    expect(icons).toEqual(["sms", "instagram", "whatsapp", "other"]);
    expect(html).toContain("bg-[#25D366]");
    expect(html).toContain("bg-[#34C759]");
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
