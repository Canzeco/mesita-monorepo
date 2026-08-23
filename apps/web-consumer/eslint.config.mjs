import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // ── The type-role guard (MESITA-1220) ──────────────────────────────────
    // Source of truth for the roles: src/lib/type-roles.ts.
    // AST-based on purpose: a regex over source files flags the COMMENT in
    // ProfileSummaryCard that quotes the law, and misses every size inside a
    // cn() array or a cva variant map. ESLint sees string literals and
    // template chunks, so it gets both right for free.
    rules: {
      "no-restricted-syntax": [
        "error",
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
            '  USE: className="type-eyebrow" (add a colour utility if needed).\n\n' +
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
      ],
    },
  },
]);

export default eslintConfig;
