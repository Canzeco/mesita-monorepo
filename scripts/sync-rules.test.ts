// sync-rules.test.ts — the gate that guards the gates.
//
// scripts/sync-rules.ts enforces the two Development Rules §C laws (markdown
// allowlist, word budgets) plus the generated-file contract. A gate that
// silently stops biting still reports green, so every branch is exercised
// here — including the negative cases that prove a violation is actually
// rejected.
//
// Run: deno task test:rules   (CI: .github/workflows/rules.yml)

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";

import {
  budgetsFor,
  buildAllowedFiles,
  countWords,
  DEFAULT_PACKAGE_WORD_BUDGET,
  DEFAULT_SKILL_WORD_BUDGET,
  END,
  findForbiddenAssets,
  findMarkerSpan,
  findStrayMarkdown,
  FORBIDDEN_ASSET_EXTS,
  FORBIDDEN_ASSET_GLOBS,
  forbiddenAssetMessage,
  groupSkillDocs,
  MD_ALLOW_DIRS,
  MD_SCAN_GLOBS,
  overBudgetMessage,
  parseLsFiles,
  QUICKSTART_WORD_BUDGET,
  rootTail,
  SKILL_BUDGETS,
  skillBudgetCheck,
  skillNameOf,
  SKILLS_DIR,
  START,
  TARGETS,
  type Target,
} from "./sync-rules.ts";

const repoRoot = dirname(dirname(fromFileUrl(import.meta.url)));

const pkg = (label: string, budget?: number): Target => ({
  label,
  dir: `${repoRoot}/${label}`,
  quickstart: false,
  budget,
});
const root = (): Target => ({ label: "root", dir: repoRoot, quickstart: true });

// ── countWords — one tokenizer, or two budgets measure different things ──────

Deno.test("countWords collapses every whitespace run", () => {
  assertEquals(countWords("one two three"), 3);
  assertEquals(countWords("  one \n\n two \t three  "), 3);
  assertEquals(countWords(""), 0);
  assertEquals(countWords("   \n  "), 0);
});

Deno.test("countWords counts markdown punctuation as part of its word", () => {
  // Budgets are a proxy for reading cost, not a lexer — `**bold**` is one word.
  assertEquals(countWords("**bold** `code` — dash"), 4);
});

// ── findMarkerSpan — ambiguity must fail, never guess ────────────────────────

const withBlock = (body: string) => `head\n${START}\n${body}\n${END}\ntail`;

Deno.test("findMarkerSpan locates exactly one well-formed block", () => {
  const span = findMarkerSpan(withBlock("x"));
  assert(span !== null);
  assert(span.start < span.end);
});

Deno.test("findMarkerSpan rejects every ambiguous shape", () => {
  assertEquals(findMarkerSpan("no markers at all"), null, "missing both");
  assertEquals(findMarkerSpan(`only ${START} here`), null, "missing END");
  assertEquals(findMarkerSpan(`only ${END} here`), null, "missing START");
  assertEquals(findMarkerSpan(`${END}\n${START}`), null, "END before START");
  assertEquals(findMarkerSpan(`${START}\n${START}\n${END}`), null, "duplicate START");
  assertEquals(findMarkerSpan(`${START}\n${END}\n${END}`), null, "duplicate END");
});

// ── rootTail — the hand-written half of the root file ────────────────────────

Deno.test("rootTail returns only what follows the END marker", () => {
  assertEquals(rootTail(withBlock("generated body")), "\ntail");
});

Deno.test("rootTail falls back to the whole file when markers are unusable", () => {
  // A package file has no markers; budgeting its whole body is the correct
  // fallback, not a crash.
  assertEquals(rootTail("plain package rules"), "plain package rules");
});

// ── Word budgets ─────────────────────────────────────────────────────────────

Deno.test("budgetsFor measures a package file whole, against the default ceiling", () => {
  const [b] = budgetsFor(pkg("apps/web-validate"), "word ".repeat(10));
  assertEquals(b.words, 10);
  assertEquals(b.budget, DEFAULT_PACKAGE_WORD_BUDGET);
  assertEquals(b.over, false);
});

Deno.test("budgetsFor flags an over-budget package file", () => {
  const [b] = budgetsFor(pkg("apps/web-validate"), "word ".repeat(DEFAULT_PACKAGE_WORD_BUDGET + 1));
  assertEquals(b.over, true);
});

Deno.test("budgetsFor is inclusive at the limit — exactly at budget passes", () => {
  const [b] = budgetsFor(pkg("apps/web-admin"), "word ".repeat(DEFAULT_PACKAGE_WORD_BUDGET));
  assertEquals(b.words, DEFAULT_PACKAGE_WORD_BUDGET);
  assertEquals(b.over, false);
});

Deno.test("an explicit ceiling overrides the default, in both directions", () => {
  const text = "word ".repeat(600);
  assertEquals(budgetsFor(pkg("apps/web-consumer", 600), text)[0].over, false, "at its own ceiling");
  assertEquals(budgetsFor(pkg("apps/web-consumer"), text)[0].over, true, "same text, default ceiling");
  // A ceiling can also be TIGHTER than the default — nothing assumes it only relaxes.
  assertEquals(budgetsFor(pkg("apps/web-landing", 100), "word ".repeat(150))[0].over, true);
});

Deno.test("budgetsFor measures the ROOT by its tail only, ignoring the generated block", () => {
  // The block is generated from the canonical source and carries the quickstart
  // budget; counting it twice would make the root permanently over.
  const bloatedBlock = "word ".repeat(DEFAULT_PACKAGE_WORD_BUDGET * 2);
  const [b] = budgetsFor(root(), withBlock(bloatedBlock));
  assertEquals(b.over, false, "generated block must not count against the tail budget");
  assertStringIncludes(b.label, "tail");
});

Deno.test("budgetsFor flags an over-budget ROOT tail", () => {
  const text = `${START}\nsmall\n${END}\n` + "word ".repeat(DEFAULT_PACKAGE_WORD_BUDGET + 1);
  const [b] = budgetsFor(root(), text);
  assertEquals(b.over, true);
});

Deno.test("every explicit ceiling is justified by a file that actually needs it", async () => {
  // Guards the ratchet: a raised ceiling with no file near it is a budget that
  // was bumped speculatively, which is the accretion this gate exists to stop.
  for (const target of TARGETS) {
    if (target.budget === undefined) continue;
    const text = await Deno.readTextFile(join(target.dir, "CLAUDE.md"));
    const [b] = budgetsFor(target, text);
    assert(
      b.words > DEFAULT_PACKAGE_WORD_BUDGET,
      `${target.label} carries an explicit ceiling of ${target.budget} but is only ${b.words} words — drop the override`,
    );
  }
});

Deno.test("overBudgetMessage prescribes a rewrite, not a trim", () => {
  const msg = overBudgetMessage({ label: "x/CLAUDE.md", words: 900, budget: 450, over: true });
  assertStringIncludes(msg, "900 words > 450");
  assertStringIncludes(msg, "rewrite it from scratch");
  assertStringIncludes(msg, "don't trim around the edges");
});

// ── Skill budgets — the surface `.claude/` used to hide from the ruler ───────

Deno.test("parseLsFiles reads the mode and path off `git ls-files -s`", () => {
  const files = parseLsFiles(
    "100644 62a2a8b 0\t.claude/skills/doctor/SKILL.md\n" +
      "120000 b8677c6 0\t.claude/skills/gstack-ship/SKILL.md\n" +
      "\n",
  );
  assertEquals(files, [
    { mode: "100644", path: ".claude/skills/doctor/SKILL.md" },
    { mode: "120000", path: ".claude/skills/gstack-ship/SKILL.md" },
  ]);
});

Deno.test("skillNameOf names only files INSIDE a skill directory", () => {
  assertEquals(skillNameOf(`${SKILLS_DIR}doctor/SKILL.md`), "doctor");
  assertEquals(skillNameOf(`${SKILLS_DIR}doctor/references/queries.md`), "doctor");
  assertEquals(skillNameOf(`${SKILLS_DIR}loose.md`), null, "not in a skill dir");
  assertEquals(skillNameOf(".claude/launch.json"), null);
  assertEquals(skillNameOf("apps/web-admin/CLAUDE.md"), null);
});

Deno.test("groupSkillDocs budgets the whole skill DIRECTORY, not just SKILL.md", () => {
  // Otherwise the cure for an over-budget SKILL.md is to move half of it into a
  // sibling file — the same words, one more file, and the gate reports green.
  const grouped = groupSkillDocs([
    { mode: "100644", path: `${SKILLS_DIR}doctor/SKILL.md` },
    { mode: "100644", path: `${SKILLS_DIR}doctor/reference.md` },
    { mode: "100644", path: `${SKILLS_DIR}other/SKILL.md` },
  ]);
  assertEquals(grouped.get("doctor"), [
    `${SKILLS_DIR}doctor/SKILL.md`,
    `${SKILLS_DIR}doctor/reference.md`,
  ]);
  assertEquals(grouped.get("other")?.length, 1);
});

Deno.test("groupSkillDocs skips symlinks — gstack skills live in another repo", () => {
  // ~/.claude/gstack is a separate checkout symlinked in. Budgeting it would
  // measure files this repo neither owns nor can rewrite.
  const grouped = groupSkillDocs([
    { mode: "120000", path: `${SKILLS_DIR}ship/SKILL.md` },
    { mode: "100644", path: `${SKILLS_DIR}doctor/SKILL.md` },
  ]);
  assertEquals([...grouped.keys()], ["doctor"]);
});

Deno.test("skillBudgetCheck defaults, overrides, and is inclusive at the limit", () => {
  const [name, ceiling] = Object.entries(SKILL_BUDGETS)[0];
  assertEquals(skillBudgetCheck("fresh-skill", DEFAULT_SKILL_WORD_BUDGET).over, false);
  assertEquals(skillBudgetCheck("fresh-skill", DEFAULT_SKILL_WORD_BUDGET + 1).over, true);
  assertEquals(skillBudgetCheck(name, ceiling).over, false, "at its own ceiling");
  assertEquals(skillBudgetCheck(name, ceiling + 1).over, true);
  assertEquals(skillBudgetCheck("doctor", 1).label, `${SKILLS_DIR}doctor/`);
});

/** Every skill this repo owns → its total tracked-markdown word count. */
async function shippedSkills(): Promise<Map<string, number>> {
  const root = join(repoRoot, ".claude", "skills");
  const totals = new Map<string, number>();
  for await (const entry of Deno.readDir(root)) {
    // readDir does not follow symlinks: a symlinked-in gstack skill is neither
    // isDirectory nor isFile, so it drops out here exactly as mode 120000 does.
    if (!entry.isDirectory) continue;
    totals.set(entry.name, await wordsUnder(join(root, entry.name)));
  }
  return totals;
}

async function wordsUnder(dir: string): Promise<number> {
  let words = 0;
  for await (const entry of Deno.readDir(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory) words += await wordsUnder(path);
    else if (entry.isFile && /\.(md|MD|mdx|mdc)$/.test(entry.name)) {
      words += countWords(await Deno.readTextFile(path));
    }
  }
  return words;
}

Deno.test("every explicit skill ceiling is justified by a skill that needs it", async () => {
  const shipped = await shippedSkills();
  for (const [name, ceiling] of Object.entries(SKILL_BUDGETS)) {
    const words = shipped.get(name);
    assert(words !== undefined, `SKILL_BUDGETS names "${name}", which this repo does not ship`);
    assert(
      words > DEFAULT_SKILL_WORD_BUDGET,
      `${name} carries an explicit ceiling of ${ceiling} but is only ${words} words — drop the override`,
    );
  }
});

Deno.test("every shipped skill is within budget", async () => {
  const shipped = await shippedSkills();
  assert(shipped.size > 0, "no project-local skill found — the budget would be measuring nothing");
  for (const [name, words] of shipped) {
    const b = skillBudgetCheck(name, words);
    assert(!b.over, overBudgetMessage(b));
  }
});

// ── Allowlist ────────────────────────────────────────────────────────────────

const ALLOWED = buildAllowedFiles(TARGETS, repoRoot);

Deno.test("buildAllowedFiles covers the quickstart source and every generated pair", () => {
  assert(ALLOWED.has("scripts/rules-quickstart.md"));
  assert(ALLOWED.has("CLAUDE.md"));
  assert(ALLOWED.has("AGENTS.md"));
  for (const { dir } of TARGETS) {
    if (dir === repoRoot) continue;
    const rel = dir.slice(repoRoot.length + 1);
    assert(ALLOWED.has(`${rel}/CLAUDE.md`), `${rel}/CLAUDE.md missing from allowlist`);
    assert(ALLOWED.has(`${rel}/AGENTS.md`), `${rel}/AGENTS.md missing from allowlist`);
  }
});

Deno.test("findStrayMarkdown passes the instruction pairs and root tooling dirs", () => {
  const clean = [
    "CLAUDE.md",
    "AGENTS.md",
    "scripts/rules-quickstart.md",
    "supabase/CLAUDE.md",
    "apps/web-consumer/AGENTS.md",
    ".claude/skills/doctor/SKILL.md",
    ".cursor/rules/autonomy.mdc",
    ".github/workflows/rules.yml.md",
    ".codex/config.md",
  ];
  assertEquals(findStrayMarkdown(clean, ALLOWED), []);
});

Deno.test("findStrayMarkdown rejects knowledge markdown anywhere in the tree", () => {
  const strays = findStrayMarkdown(
    ["README.md", "docs/architecture.md", "apps/web-consumer/DESIGN.md", "TODOS.md"],
    ALLOWED,
  );
  assertEquals(strays.length, 4);
});

Deno.test("findStrayMarkdown rejects a NESTED tooling dir — the .mdc hole", () => {
  // Root-anchored on purpose: a rule parked in apps/<app>/.cursor/rules is read
  // by Cursor alone, so every other agent silently runs without it. This is the
  // exact file the pre-2026-08-17 gate could not see.
  const strays = findStrayMarkdown(
    ["apps/web-consumer/.cursor/rules/search-results-modal-height.mdc"],
    ALLOWED,
  );
  assertEquals(strays.length, 1);
});

Deno.test("findStrayMarkdown treats a package CLAUDE.md of an unregistered package as a stray", () => {
  // Adding a package without a TARGETS entry must fail loudly rather than leave
  // its instruction files ungenerated and unbudgeted.
  const strays = findStrayMarkdown(["apps/web-newthing/CLAUDE.md"], ALLOWED);
  assertEquals(strays, ["apps/web-newthing/CLAUDE.md"]);
});

// ── The cross-file coupling that YAML cannot import ──────────────────────────

Deno.test("MD_SCAN_GLOBS scans .mdc — Cursor reads it as rules (ASDM §K4)", () => {
  assert(MD_SCAN_GLOBS.includes("*.mdc"));
});

Deno.test("every scanned extension also triggers rules.yml, on BOTH events", async () => {
  // An extension scanned here but absent from the workflow filter is worse than
  // not scanning it: the workflow never fires, so the gate reports green because
  // it never ran. This test is the only thing holding the two files together.
  // Both scan sets are covered: the markdown allowlist and the forbidden assets
  // run off the same `git ls-files` machinery and need the same trigger.
  const yml = await Deno.readTextFile(join(repoRoot, ".github", "workflows", "rules.yml"));
  for (const glob of [...MD_SCAN_GLOBS, ...FORBIDDEN_ASSET_GLOBS]) {
    const occurrences = yml.split(`"**/${glob}"`).length - 1;
    assert(
      occurrences >= 2,
      `rules.yml must list "**/${glob}" under both push and pull_request paths (found ${occurrences})`,
    );
  }
});

Deno.test("MD_ALLOW_DIRS entries are root-anchored directory prefixes", () => {
  for (const d of MD_ALLOW_DIRS) {
    assert(d.endsWith("/"), `${d} must end with / so it cannot prefix-match a sibling file`);
    assert(!d.startsWith("/"), `${d} must be repo-relative`);
  }
});

// ── Forbidden assets (MESITA-1077) ───────────────────────────────────────────

Deno.test("FORBIDDEN_ASSET_GLOBS spells out both cases of every extension", () => {
  // git pathspecs and GitHub path filters are both case-sensitive, and the
  // likeliest arrival of a HEIC is an iPhone export named IMG_1234.HEIC.
  for (const ext of FORBIDDEN_ASSET_EXTS) {
    assert(FORBIDDEN_ASSET_GLOBS.includes(`*${ext}`), `*${ext} missing`);
    assert(FORBIDDEN_ASSET_GLOBS.includes(`*${ext.toUpperCase()}`), `*${ext.toUpperCase()} missing`);
  }
});

Deno.test("findForbiddenAssets catches every vulnerable format, in any case", () => {
  const tracked = [
    "assets/brand/icon.icns",
    "apps/web-consumer/public/hero.JXL",
    "assets/shot.heif",
    "apps/mobile-consumer/assets/IMG_0042.HEIC",
  ];
  assertEquals(findForbiddenAssets(tracked), tracked);
});

Deno.test("findForbiddenAssets passes the formats the repo actually ships", () => {
  assertEquals(
    findForbiddenAssets([
      "assets/brand/logo.svg",
      "apps/web-landing/public/og.png",
      "assets/deck.pdf",
      // Substring, not suffix: a directory named after the format is not one.
      "assets/heic-conversions/README.png",
    ]),
    [],
  );
});

Deno.test("the forbidden-asset message names the file and the issue", () => {
  const msg = forbiddenAssetMessage("assets/brand/icon.icns");
  assertStringIncludes(msg, "assets/brand/icon.icns");
  assertStringIncludes(msg, "MESITA-1077");
});

// ── The live repo must satisfy its own gates ─────────────────────────────────

Deno.test("the shipped quickstart is within budget", async () => {
  const canonical = await Deno.readTextFile(join(repoRoot, "scripts", "rules-quickstart.md"));
  const words = countWords(canonical);
  assert(
    words <= QUICKSTART_WORD_BUDGET,
    `scripts/rules-quickstart.md is ${words} words > ${QUICKSTART_WORD_BUDGET}`,
  );
});

Deno.test("every shipped CLAUDE.md is within budget", async () => {
  for (const target of TARGETS) {
    const text = await Deno.readTextFile(join(target.dir, "CLAUDE.md"));
    for (const b of budgetsFor(target, text)) {
      assert(!b.over, overBudgetMessage(b));
    }
  }
});

Deno.test("no package CLAUDE.md carries the quickstart markers", async () => {
  for (const { label, dir, quickstart } of TARGETS) {
    if (quickstart) continue;
    const text = await Deno.readTextFile(join(dir, "CLAUDE.md"));
    assert(
      !text.includes("RULES-QUICKSTART:"),
      `${label}/CLAUDE.md carries quickstart markers — the block lives at the root only`,
    );
  }
});
