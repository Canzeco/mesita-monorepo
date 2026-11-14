import { readFileSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ── The type-role guard (MESITA-1220) ────────────────────────────────────────
// Source of truth for the roles: src/lib/type-roles.ts.
// AST-based on purpose: a regex over source files flags the COMMENT in
// ProfileSummaryCard that quotes the law, and misses every size inside a
// cn() array or a cva variant map. ESLint sees string literals and
// template chunks, so it gets both right for free.
//
// A shared const because a later flat-config block for the same rule
// REPLACES an earlier block's options on overlapping files: the kit block
// below spreads these so no file loses them (MESITA-3948).
const TYPE_ROLE_SELECTORS = [
  {
    selector:
      "Literal[value=/text-\\[(?!clamp\\(|length:var\\(|[\\d.]+rem\\])/]",
    message:
      "Off-scale font size.\n\n" +
      "  WHY: an arbitrary px size is frozen for every guest, while a rem\n" +
      "  size scales with their browser font-size setting. Both ticket\n" +
      "  files once used zero named sizes, so THE TICKET ignored that\n" +
      "  setting entirely.\n\n" +
      "  USE: text-xs/sm/base/lg/2xl... (named, already rem), or a role:\n" +
      "    type-meta     0.625rem  (10px)  dense meta, the FLOOR\n" +
      "    type-label    0.6875rem (11px)  group label\n" +
      "    type-body     0.8125rem (13px)  field label / body\n" +
      "    type-eyebrow  12px + uppercase + 0.14em + weight 500\n\n" +
      "  Do NOT round to the nearest px — read the block and pick the ROLE.\n" +
      "  clamp() is allowed for fluid display type; a fractional size a\n" +
      "  machine computed is fine, one a human typed is always a bug.\n\n" +
      "  THE LAW LIVES IN NOTION: Docs > Design §C/§D. src/lib/type-roles.ts\n" +
      "  mirrors it. Widening the set is a Notion edit FIRST, then that\n" +
      "  file, same session — a role that exists only in code is drift\n" +
      "  with a nicer name.",
  },
  {
    selector:
      "Literal[value=/^(?=.*\\buppercase\\b)(?=.*\\btracking-)(?=.*\\btext-xs\\b)(?!.*\\btype-)/]",
    message:
      "Hand-rolled eyebrow.\n\n" +
      "  A 12px uppercase tracked label IS §C's eyebrow role. Spelled by\n" +
      "  hand it drifts: this app reached 8 tracking values and 21 font\n" +
      "  sizes that way, and a 0.5px step cannot carry rank — it reads as\n" +
      "  misalignment, not hierarchy.\n\n" +
      "  USE: className=\"type-eyebrow\" (add a colour utility if needed).\n\n" +
      "  NOT this rule: §D dense CHIPS are type-meta + uppercase + a named\n" +
      "  tracking. Those are a different role with their own latitude.\n\n" +
      "  THE LAW LIVES IN NOTION: Docs > Design §C/§D.",
  },
  {
    selector:
      "Literal[value=/^(?=.*\\btype-eyebrow\\b)(?=.*\\bfont-(thin|light|normal|medium|semibold|bold|extrabold|black)\\b)/]",
    message:
      "This role already sets font-weight.\n\n" +
      "  type-eyebrow sets 500. A font-* alongside it lands in the same utilities layer at equal specificity, so\n" +
      "  the winner is emission order, not what you wrote — the silent\n" +
      "  trap that made .eyebrow lose to its own call sites.\n\n" +
      "  Drop the font-*, or add a role in src/lib/type-roles.ts.\n\n" +
      "  (type-meta, type-label and type-body set SIZE only — pairing\n" +
      "  those with a weight or a colour is correct and intended.)",
  },
  {
    selector:
      "Literal[value=/^(?=.*\\btype-eyebrow\\b)(?=.*\\btracking-)/]",
    message:
      "type-eyebrow already sets letter-spacing (0.14em, per §C).\n\n" +
      "  Same equal-specificity race. If you need the other legal value\n" +
      "  (0.12em), add it as a role rather than overriding this one.",
  },
];

// ── The kit guard (MESITA-3948) ──────────────────────────────────────────────
// Outside src/components/admin-ui, chrome comes from the kit only. Each pattern
// is written once with String.raw (so \b, \d, \[ keep their backslashes) and
// becomes two selectors: a string literal and a template-literal chunk. Every
// class pattern starts at a class boundary, so "context-red-1" passes.
// esquery regexes cannot hold a "/", so a path separator is written ".".
const SECTION_C =
  "THE LAW LIVES IN NOTION: Docs > Design §C (web-admin map).\n" +
  "  Never add files to legacy-kit-files.txt; it only shrinks (CI compares it with main).";
const B = String.raw`(^|\s|:|!)`;
const KIT_PATTERNS = [
  {
    tag: "raw-palette",
    re: B + String.raw`(bg|text|border|ring|outline|divide|from|via|to|fill|stroke|accent|caret|decoration|placeholder)-(red|green|emerald|amber|yellow|sky|violet|blue|rose|zinc|slate|gray|neutral|stone|orange|lime|teal|cyan|indigo|purple|fuchsia|pink)-\d`,
    why: "a raw Tailwind palette colour bypasses the tokens, so status colours drift page by page.",
    use: 'import { Chip, Notice } from "@/components/admin-ui": red → <Notice tone="error"> or <Chip tone="danger">,\n' +
      '  green → tone="success", amber → tone="warning", sky/slate/grey → muted (info has no hue).',
  },
  {
    tag: "arbitrary-colour",
    re: B + String.raw`(bg|text|border|ring|fill|stroke)-\[(#|oklch|rgb|hsl)`,
    why: "an arbitrary colour value is a token nobody can find or change.",
    use: "a semantic token class (foreground, muted-foreground, destructive, success, warning, border, card).",
  },
  {
    tag: "white-black",
    re: B + String.raw`(bg-white|bg-black)(?![\w-])`,
    why: "white and black are not tokens; the card is bg-card and the scrim belongs to ConfirmDialog.",
    use: 'import { SectionCard, ConfirmDialog } from "@/components/admin-ui"; or bg-card / bg-background.',
  },
  {
    tag: "white-black",
    brandAllowed: true,
    re: B + String.raw`text-white(?![\w-])`,
    why: "white text is not a token; on an ink fill the label colour is text-background.",
    use: 'import { Button } from "@/components/admin-ui" (tone="primary" draws ink with the right label).',
  },
  {
    tag: "shadow",
    brandAllowed: true,
    re: B + String.raw`shadow-`,
    why: "the admin card has no shadow; only overlays float.",
    use: 'import { OVERLAY_SURFACE_CLASS } from "@/components/admin-ui" for a popover, or <SectionCard> for a card.',
  },
  {
    tag: "brand-bg",
    brandAllowed: true,
    re: B + String.raw`(bg-pink-gradient|bg-brand|bg-hero)(?![\w-])`,
    why: "the brand backgrounds belong to the sign-in screen, the access gate and the brand page only.",
    use: 'import { SectionCard, Stat } from "@/components/admin-ui".',
  },
  {
    tag: "hand-card",
    re: String.raw`^(?=.*\brounded-2xl\b)(?=.*(^|\s)border(\s|$))`,
    why: "a hand-built card drifts in padding, radius and title size from the one SectionCard.",
    use: 'import { SectionCard } from "@/components/admin-ui".',
  },
];

const kitMessage = (p) =>
  `[kit/${p.tag}] Chrome outside the admin kit.\n\n  WHY: ${p.why}\n\n  USE: ${p.use}\n\n  ${SECTION_C}`;

const classSelectors = (patterns) =>
  patterns.flatMap((p) => [
    { selector: `Literal[value=/${p.re}/]`, message: kitMessage(p) },
    { selector: `TemplateElement[value.raw=/${p.re}/]`, message: kitMessage(p) },
  ]);

const RAW_CONTROL = {
  selector: "JSXOpeningElement[name.name=/^(button|input|select|textarea)$/]",
  message: kitMessage({
    tag: "raw-control",
    why: "a raw control misses the kit's focus ring, 44px hit area and disabled/pending states.",
    use: 'import { Button, TextField, SelectField, TextAreaField, SearchField } from "@/components/admin-ui".',
  }),
};
const KIT_IMPORT = {
  selector: "ImportDeclaration[source.value=/admin-ui.ui(.|$)/]",
  message: kitMessage({
    tag: "kit-internal",
    why: "the shadcn primitives in admin-ui/ui are kit internals; their skin lives in the named components.",
    use: 'import { … } from "@/components/admin-ui" (the barrel), never admin-ui/ui/*.',
  }),
};

const KIT_SELECTORS = [...classSelectors(KIT_PATTERNS), RAW_CONTROL, KIT_IMPORT];
// The sign-in card, the access gate and the brand page keep the brand
// backgrounds, white text on them, and their one shadow.
const KIT_SELECTORS_BRAND = [
  ...classSelectors(KIT_PATTERNS.filter((p) => !p.brandAllowed)),
  RAW_CONTROL,
  KIT_IMPORT,
];

// The ratchet (MESITA-3948): files that broke the kit guard on Wave 1's merge
// day. It only shrinks (scripts/check-legacy-kit.mjs compares it with main);
// Wave 3 deletes it. KIT_LEGACY_AUDIT=1 empties it so the check can prove
// every listed file still has a kit error.
const LEGACY_KIT_FILES =
  process.env.KIT_LEGACY_AUDIT === "1"
    ? []
    : readFileSync(new URL("./legacy-kit-files.txt", import.meta.url), "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));

const BRAND_FILES = ["src/app/page.tsx", "src/app/(app)/layout.tsx", "src/app/(app)/brand/page.tsx"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Underscore-prefix is the intentional-unused convention here —
      // honour it on vars, args, destructured rest discriminants, and
      // caught errors. Cleans up the `void _foo` workaround pattern.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...TYPE_ROLE_SELECTORS],
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [
      "src/components/admin-ui/**",
      "src/lib/type-roles.ts",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      ...BRAND_FILES,
      ...LEGACY_KIT_FILES,
    ],
    rules: {
      "no-restricted-syntax": ["error", ...TYPE_ROLE_SELECTORS, ...KIT_SELECTORS],
    },
  },
  {
    // A later block replaces the earlier one's options, so the legacy
    // ignores are repeated here for any of these three still listed.
    files: BRAND_FILES,
    ignores: [...LEGACY_KIT_FILES],
    rules: {
      "no-restricted-syntax": ["error", ...TYPE_ROLE_SELECTORS, ...KIT_SELECTORS_BRAND],
    },
  },
  {
    files: ["src/components/admin-ui/**/*.ts", "src/components/admin-ui/**/*.tsx"],
    rules: {
      "import/no-cycle": "error",
    },
  },
]);

export default eslintConfig;
