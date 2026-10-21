import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SharePage } from "@/components/consumer/share/SharePage";
import {
  APP_SHARE_URL,
  INSTAGRAM_DM_URL,
  SHARE_CARD_IMAGES,
  SHARE_CARD_STYLES,
  SHARE_MESSAGES,
  otherIndex,
  shareLinks,
} from "@/lib/share-app";

// Share is a page (Pato, MESITA-2566), and its top is an invite card shaped
// like a gift card — no credit — with meme messages and styles (MESITA-2568),
// built from three params: an image, a message, a style (MESITA-2570).

const html = renderToStaticMarkup(<SharePage />);
const decode = (s: string) => decodeURIComponent(s.replace(/&amp;/g, "&"));

describe("the Share page", () => {
  it("leads with the invite card: the first image, message and style", () => {
    expect(html).toContain(`data-invite-card="${SHARE_CARD_STYLES[0].id}"`);
    expect(html).toContain(`data-invite-image="${SHARE_CARD_IMAGES[0].id}"`);
    expect(html).toContain("Invite");
    expect(html).toContain("consumer.mesita.ai");
  });

  // Pato: "use meme images. use 5 … include certain backgrounds of cities …
  // imagine you have 10 images".
  it("offers ten images — five meme animals, five cities — each its own photo", () => {
    expect(SHARE_CARD_IMAGES).toHaveLength(10);
    const srcs = SHARE_CARD_IMAGES.map((i) => i.src);
    expect(new Set(srcs).size).toBe(10);
    for (const img of SHARE_CARD_IMAGES) {
      expect(img.src).toMatch(
        /^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?/,
      );
      expect(img.thumb.split("?")[0]).toBe(img.src.split("?")[0]);
    }
    const labels = SHARE_CARD_IMAGES.map((i) => i.label);
    for (const city of ["San Francisco", "New York", "Miami"]) {
      expect(labels).toContain(city);
    }
    const photo = html.match(/<img[^>]*data-invite-photo[^>]*>/)?.[0] ?? "";
    expect(photo).toContain(
      `src="${SHARE_CARD_IMAGES[0].src.replace(/&/g, "&amp;")}"`,
    );
    // Decoration: no alt text to read out, nothing drawn if it breaks.
    expect(photo).toContain('alt=""');
    expect(html.match(/data-invite-photo/g)).toHaveLength(1);
  });

  it("is a gift card without credit: no amount, no balance, no code", () => {
    const card = html.slice(
      html.indexOf("data-invite-card"),
      html.indexOf("data-share-shuffle"),
    );
    expect(card).not.toMatch(/\$|MX\$|balance|credits?\b(?!\. Just)|code/i);
  });

  it("offers every image, message and style, the chosen ones pressed", () => {
    for (const img of SHARE_CARD_IMAGES) {
      expect(html).toContain(`data-share-image="${img.id}"`);
    }
    expect(html.match(/data-share-message/g)).toHaveLength(
      SHARE_MESSAGES.length,
    );
    for (const s of SHARE_CARD_STYLES) {
      expect(html).toContain(`data-share-style="${s.id}"`);
      expect(s.tint).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    }
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(3);
  });

  it("shuffles to a different pick every time", () => {
    for (const length of [SHARE_CARD_IMAGES.length, SHARE_MESSAGES.length]) {
      for (let current = 0; current < length; current += 1) {
        for (const r of [0, 0.5, 0.999]) {
          const next = otherIndex(current, length, () => r);
          expect(next).not.toBe(current);
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThan(length);
        }
      }
    }
  });

  // Pato: "for buttons just include SMS Instagram WhatsApp or other button".
  it("sends it four ways, in order: SMS, Instagram, WhatsApp, Other", () => {
    const rows = [...html.matchAll(/data-share-row="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(rows).toEqual(["sms", "instagram", "whatsapp", "other"]);
    expect(html).toContain(`href="${INSTAGRAM_DM_URL}"`);
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
    // The rendered rows carry the default message. (Only the row's href is
    // decoded: the card's scrim carries bare "%".)
    const whatsapp = html.match(/href="(https:\/\/wa\.me\/[^"]*)"/)?.[1] ?? "";
    expect(decode(whatsapp)).toContain(
      `text=${SHARE_MESSAGES[0]} ${APP_SHARE_URL}`,
    );
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
    expect(sheet).not.toContain("copyMessage");
  });
});
