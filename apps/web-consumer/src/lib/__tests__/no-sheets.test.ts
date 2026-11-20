// NO BOTTOM SHEETS (Pato, MESITA-4094: "stop using these modals across the
// app … use subpages with own routes"). A screen that asks for input or shows
// a list or a detail is a page with its own route; the law is
// apps/web-consumer/CLAUDE.md › Overlays. This guard keeps sheets from coming
// back: it reads every source file's imports from the overlay module.
//
//   (a) `LocalSheet` may be imported only by a file still on SHEET_ALLOWLIST.
//       The list only shrinks (MESITA-4110/4111/4112/4113) and is empty after
//       MESITA-4114 deletes `LocalSheet`.
//   (b) `LocalDialog` is for a destructive yes/no confirm only: CONFIRM_FILES,
//       plus DIALOG_ALLOWLIST (the non-confirm dialogs that become pages in
//       MESITA-4112/4113; it only shrinks).
//
// Imports are read from the specifiers (aliases and re-exports included);
// comments are skipped, so a mention in prose never trips the guard.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const LAW = "apps/web-consumer/CLAUDE.md › Overlays";
const SRC = join(__dirname, "../..");
const PLACE_PROFILE = join(
  __dirname,
  "../../../../../packages/place-profile/src",
);
const DEFINITION = "components/consumer/overlay/LocalOverlay.tsx";

/** The destructive yes/no confirms (MESITA-4094). Adding one needs a
 *  one-sentence, two-button confirm and a `decision:` line on its issue. */
export const CONFIRM_FILES = [
  // Take back a gift (MESITA-4066; its own file since MESITA-4324, the
  // gift page and the waiting Gifts row share it).
  "components/consumer/activity/GiftTakeBack.tsx",
  // The first-open welcome (MESITA-4246, decision: Pato asked for a modal
  // over Home; two buttons, Sign in and Just browse since MESITA-4328).
  "components/consumer/anonymous/WelcomeModal.tsx",
  // Sign in for a gated tap (MESITA-4288: "display the modal before
  // aggressively redirecting"): Sign in or Not now.
  "components/consumer/anonymous/SignGateModal.tsx",
  // Add a card (MESITA-4398, Pato: "card must not be another page. it must
  // be a modal."): Stripe's form, Save card or close.
  "components/consumer/wallet/AddCardModal.tsx",
  // Leave for Google Maps (MESITA-4448, decision: Pato asked for a modal
  // before the redirect): Open Google Maps or Not now.
  "components/consumer/MapsLeaveModal.tsx",
  "components/consumer/me/CalendarModal.tsx",
  "components/consumer/me/InstagramModal.tsx",
  "components/consumer/pay/GuestPayScreen.tsx",
  "components/consumer/pay/GuestTabView.tsx",
  "components/consumer/pay/PayPage.tsx",
  "components/consumer/reservation-actions.tsx",
];

/** Files that still open a sheet. Remove a file when its sheet becomes a page. */
const SHEET_ALLOWLIST = [
  "components/consumer/MenuViewer.tsx",
  "components/consumer/PlaceContactSheet.tsx",
  "components/consumer/home/LocationPicker.tsx",
  "components/consumer/pay/GuestPayScreen.tsx",
  "components/consumer/pay/PayForm.tsx",
  "components/consumer/pay/SplitWithFriends.tsx",
  "components/consumer/pay/TabView.tsx",
  "components/consumer/place-detail/BoostSheet.tsx",
  "components/consumer/place-detail/PlaceMoreSheet.tsx",
  "components/consumer/place-detail/ReportSheet.tsx",
  "components/consumer/reservation-actions.tsx",
  "components/consumer/search/AddPlaceSheet.tsx",
  "components/consumer/wallet/MethodSheet.tsx",
  "components/consumer/wallet/PlaceCredit.tsx",
  "components/consumer/wallet/SendCredit.tsx",
];

/** Non-confirm dialogs that become pages (MESITA-4112/4113). Only shrinks. */
const DIALOG_ALLOWLIST = [
  // Home's Categories, floating (MESITA-4433, decision: Pato asked for
  // "modal floating"; a full-screen sheet in MESITA-4417).
  "components/consumer/home/CategoriesModal.tsx",
  "components/consumer/ComingSoonModal.tsx",
  "components/consumer/home/SocialFeed.tsx",
  // Search's Menu is Home's Categories modal (MESITA-4469). The dialog
  // import lives in CategoriesModal, so this file is off the list.
  "components/consumer/search/GeneratePlaceDialog.tsx",
  "components/consumer/wallet/AddCreditsCardDialog.tsx",
];

export type OverlayImport = { name: string; line: number; reexport: boolean };

// Drop comments of all three kinds (line, block, and JSX block comments in
// braces), keeping line breaks so reported line numbers stay true. Strings
// are kept whole.
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      out += c;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      out += src[i] ?? "";
      i++;
    } else if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") out += "\n";
        i++;
      }
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const OVERLAY_SOURCE = /(^|\/)LocalOverlay$/;

/** Names this file imports or re-exports from the overlay module. */
export function overlayImports(src: string): OverlayImport[] {
  const text = stripComments(src);
  const found: OverlayImport[] = [];
  // A statement starts its line, so an import written inside a string never counts.
  const re =
    /^[ \t]*(import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/gm;
  for (const m of text.matchAll(re)) {
    if (!OVERLAY_SOURCE.test(m[3])) continue;
    const line = text.slice(0, m.index).split("\n").length;
    for (const part of m[2].split(",")) {
      const name = part
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        .trim();
      if (name) found.push({ name, line, reexport: m[1] === "export" });
    }
  }
  for (const m of text.matchAll(
    /^[ \t]*export\s+\*\s+from\s*["']([^"']+)["']/gm,
  )) {
    if (OVERLAY_SOURCE.test(m[1]))
      found.push({
        name: "*",
        line: text.slice(0, m.index).split("\n").length,
        reexport: true,
      });
  }
  for (const m of text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
    if (OVERLAY_SOURCE.test(m[1]))
      found.push({
        name: "*",
        line: text.slice(0, m.index).split("\n").length,
        reexport: false,
      });
  }
  return found;
}

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry))
        out.push(p);
    }
  };
  walk(root);
  return out;
}

function scan() {
  const roots = [SRC, PLACE_PROFILE];
  const rows: { file: string; imp: OverlayImport }[] = [];
  for (const root of roots) {
    for (const abs of sourceFiles(root)) {
      const file =
        root === SRC
          ? relative(SRC, abs)
          : `place-profile/${relative(root, abs)}`;
      if (file === DEFINITION) continue;
      for (const imp of overlayImports(readFileSync(abs, "utf8")))
        rows.push({ file, imp });
    }
  }
  return rows;
}

describe("the overlay scanner (MESITA-4094)", () => {
  it("reads aliased imports, re-exports and dynamic imports, and skips comments and strings", () => {
    const fixture = [
      "// import { LocalSheet } from '@/components/consumer/overlay/LocalOverlay';",
      "/* import { LocalSheet } from './LocalOverlay' */",
      "const s = \"import { LocalSheet } from './LocalOverlay'\";",
      "const el = <div>{/* <LocalSheet> */}</div>;",
      'import { LocalSheet as Panel, LocalDialog } from "@/components/consumer/overlay/LocalOverlay";',
      "export { LocalSheet } from './LocalOverlay';",
      "const lazy = import('./overlay/LocalOverlay');",
    ].join("\n");
    expect(overlayImports(fixture)).toEqual([
      { name: "LocalSheet", line: 5, reexport: false },
      { name: "LocalDialog", line: 5, reexport: false },
      { name: "LocalSheet", line: 6, reexport: true },
      { name: "*", line: 7, reexport: false },
    ]);
  });
});

describe("no bottom sheets (MESITA-4094)", () => {
  const rows = scan();

  it("only allowlisted files import LocalSheet; a new screen is a page with its own route", () => {
    const bad = rows
      .filter(
        ({ file, imp }) =>
          (imp.name === "LocalSheet" || imp.name === "*") &&
          !SHEET_ALLOWLIST.includes(file),
      )
      .map(
        ({ file, imp }) =>
          `${file}:${imp.line} imports ${imp.name} — make it a page with its own route (see ${LAW})`,
      );
    expect(bad).toEqual([]);
  });

  it("LocalDialog is only for destructive yes/no confirms", () => {
    const allowed = [...CONFIRM_FILES, ...DIALOG_ALLOWLIST];
    const bad = rows
      .filter(
        ({ file, imp }) =>
          imp.name === "LocalDialog" && !allowed.includes(file),
      )
      .map(
        ({ file, imp }) =>
          `${file}:${imp.line} imports LocalDialog — a screen is a page (see ${LAW}); a destructive yes/no confirm? add the file to CONFIRM_FILES with a decision: line`,
      );
    expect(bad).toEqual([]);
  });

  it("nothing re-exports the overlay primitives", () => {
    const bad = rows
      .filter(({ imp }) => imp.reexport)
      .map(
        ({ file, imp }) =>
          `${file}:${imp.line} re-exports ${imp.name} (see ${LAW})`,
      );
    expect(bad).toEqual([]);
  });

  it("the allowlists only shrink: every listed file still uses what it is listed for", () => {
    const uses = (file: string, name: string) =>
      rows.some((r) => r.file === file && r.imp.name === name);
    const stale = [
      ...SHEET_ALLOWLIST.filter((f) => !uses(f, "LocalSheet")).map(
        (f) =>
          `${f} no longer imports LocalSheet — remove it from SHEET_ALLOWLIST`,
      ),
      ...DIALOG_ALLOWLIST.filter((f) => !uses(f, "LocalDialog")).map(
        (f) =>
          `${f} no longer imports LocalDialog — remove it from DIALOG_ALLOWLIST`,
      ),
    ];
    expect(stale).toEqual([]);
  });
});
