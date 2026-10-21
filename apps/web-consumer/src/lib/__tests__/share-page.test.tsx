import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SharePage } from "@/components/consumer/share/SharePage";
import {
  APP_SHARE_URL,
  SHARE_CARD_STYLES,
  SHARE_MESSAGES,
  shareLinks,
} from "@/lib/share-app";

// Share is a page (Pato, MESITA-2566), and its top is an invite card shaped
// like a gift card — no credit — with meme messages and styles (MESITA-2568).

const html = renderToStaticMarkup(<SharePage />);
const decode = (s: string) => decodeURIComponent(s.replace(/&amp;/g, "&"));

describe("the Share page", () => {
  it("leads with the invite card: the first message, the first style", () => {
    expect(html).toContain(`data-invite-card="${SHARE_CARD_STYLES[0].id}"`);
    expect(html).toContain("Invite");
    expect(html).toContain("consumer.mesita.ai");
  });

  it("is a gift card without credit: no amount, no balance, no code", () => {
    const card = html.slice(html.indexOf("data-invite-card"), html.indexOf("data-share-shuffle"));
    expect(card).not.toMatch(/\$|MX\$|balance|credits?\b(?!\. Just)|code/i);
  });

  it("offers every message and every style, the chosen ones pressed", () => {
    expect(html.match(/data-share-message/g)).toHaveLength(SHARE_MESSAGES.length);
    for (const s of SHARE_CARD_STYLES) {
      expect(html).toContain(`data-share-style="${s.id}"`);
    }
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
  });

  it("keeps the ways to send it, the phone's sheet only where there is one", () => {
    for (const row of ["whatsapp", "sms", "email", "copy"]) {
      expect(html).toContain(`data-share-row="${row}"`);
    }
    expect(html).not.toContain('data-share-row="sheet"');
  });

  it("sends the chosen message, then the bare front-door link — nothing else", () => {
    expect(APP_SHARE_URL).toBe("https://consumer.mesita.ai/");
    for (const message of SHARE_MESSAGES) {
      for (const href of Object.values(shareLinks(message))) {
        const text = decode(href);
        expect(text).toContain(`${message} ${APP_SHARE_URL}`);
        expect(text).not.toMatch(/ref=|code=|uid=|utm_|\?id=/);
      }
    }
    const first = shareLinks(SHARE_MESSAGES[0]);
    expect(first.whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    expect(first.sms.startsWith("sms:")).toBe(true);
    expect(first.email.startsWith("mailto:")).toBe(true);
    // The rendered rows carry the default message.
    expect(decode(html)).toContain(`text=${SHARE_MESSAGES[0]} ${APP_SHARE_URL}`);
  });

  // The bug that made this a page: one tap showed "Link copied" AND
  // "Couldn't share Mesita". Each tap has one outcome now.
  it("never falls from the share sheet through to the clipboard", () => {
    const src = readFileSync(
      join(__dirname, "../../components/consumer/share/SharePage.tsx"),
      "utf8",
    );
    const sheet = src.slice(
      src.indexOf("async function openShareSheet"),
      src.indexOf("export function SharePage"),
    );
    expect(sheet).not.toContain("copyToClipboard");
    expect(sheet).not.toContain("copyLink");
  });
});
