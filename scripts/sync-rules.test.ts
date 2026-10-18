// sync-rules.test.ts — the gate that guards the gates.
//
// scripts/sync-rules.ts enforces the two Rules §0 laws (markdown
// allowlist, word budgets) plus the generated-file contract. A gate that
// silently stops biting still reports green, so every branch is exercised
// here — including the negative cases that prove a violation is actually
// rejected.
//
// Run: deno task test:rules   (CI: .github/workflows/rules.yml)

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { parse as parseYaml } from "@std/yaml";

import {
  budgetsFor,
  buildAllowedFiles,
  CHAT_INSTRUCTIONS_WORD_BUDGET,
  REDEYE_WORD_BUDGET,
  countWords,
  DEFAULT_PACKAGE_WORD_BUDGET,
  DEFAULT_SKILL_WORD_BUDGET,
  END,
  findForbiddenAssets,
  findMarkerSpan,
  findStamp,
  findStrayMarkdown,
  FORBIDDEN_ASSET_EXTS,
  FORBIDDEN_ASSET_GLOBS,
  forbiddenAssetMessage,
  GITHUB_CARD_BUDGETS,
  githubCardBudgetCheck,
  groupSkillDocs,
  isGithubMarkdown,
  MD_ALLOW_DIRS,
  MD_SCAN_GLOBS,
  missingStampMessage,
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
  unbudgetedGithubCardMessage,
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
  const [b] = budgetsFor(pkg("apps/web-admin"), "word ".repeat(10));
  assertEquals(b.words, 10);
  assertEquals(b.budget, DEFAULT_PACKAGE_WORD_BUDGET);
  assertEquals(b.over, false);
});

Deno.test("budgetsFor flags an over-budget package file", () => {
  const [b] = budgetsFor(pkg("apps/web-admin"), "word ".repeat(DEFAULT_PACKAGE_WORD_BUDGET + 1));
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
  assertEquals(budgetsFor(pkg("apps/web-admin", 100), "word ".repeat(150))[0].over, true);
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
  const overrides = { "big-skill": 3000 };
  assertEquals(skillBudgetCheck("fresh-skill", DEFAULT_SKILL_WORD_BUDGET).over, false);
  assertEquals(skillBudgetCheck("fresh-skill", DEFAULT_SKILL_WORD_BUDGET + 1).over, true);
  assertEquals(skillBudgetCheck("big-skill", 3000, overrides).over, false, "at its own ceiling");
  assertEquals(skillBudgetCheck("big-skill", 3001, overrides).over, true);
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

// ── GitHub cards (MESITA-1775) ─────────────────────────────────────────────

Deno.test("isGithubMarkdown is root .github/ only, markdown extensions only", () => {
  assertEquals(isGithubMarkdown(".github/README.md"), true);
  assertEquals(isGithubMarkdown(".github/PULL_REQUEST_TEMPLATE.md"), true);
  assertEquals(isGithubMarkdown(".github/workflows/rules.yml"), false);
  assertEquals(isGithubMarkdown("apps/web-admin/.github/README.md"), false);
  assertEquals(isGithubMarkdown("README.md"), false);
});

Deno.test("githubCardBudgetCheck uses the named ceiling and trips one word over", () => {
  assertEquals(githubCardBudgetCheck(".github/README.md", 150).over, false);
  assertEquals(githubCardBudgetCheck(".github/README.md", 151).over, true);
  assertEquals(githubCardBudgetCheck(".github/SECURITY.md", 100).over, false);
  assertEquals(githubCardBudgetCheck(".github/PULL_REQUEST_TEMPLATE.md", 61).over, true);
  assertEquals(githubCardBudgetCheck(".github/UNKNOWN.md", 1).over, true);
  assertEquals(githubCardBudgetCheck(".github/UNKNOWN.md", 1).budget, 0);
});

Deno.test("unbudgetedGithubCardMessage names the file and the table", () => {
  const msg = unbudgetedGithubCardMessage(".github/copilot-instructions.md");
  assertStringIncludes(msg, "UNBUDGETED GITHUB CARD");
  assertStringIncludes(msg, ".github/copilot-instructions.md");
  assertStringIncludes(msg, "GITHUB_CARD_BUDGETS");
});

Deno.test("every GITHUB_CARD_BUDGETS path is a shipped file within its ceiling", async () => {
  for (const [path, budget] of Object.entries(GITHUB_CARD_BUDGETS)) {
    const text = await Deno.readTextFile(join(repoRoot, path));
    const words = countWords(text);
    assert(
      words <= budget,
      overBudgetMessage({ label: path, words, budget, over: true }),
    );
  }
});

// ── Allowlist ────────────────────────────────────────────────────────────────

const ALLOWED = buildAllowedFiles(TARGETS, repoRoot);

Deno.test("buildAllowedFiles covers the quickstart source and every generated pair", () => {
  assert(ALLOWED.has("scripts/rules-quickstart.md"));
  assert(ALLOWED.has("scripts/chat-instructions.md"));
  assert(ALLOWED.has("scripts/redeye.md"));
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

Deno.test("MD_SCAN_GLOBS scans .mdc — Cursor reads it as rules (SADLC adapters)", () => {
  assert(MD_SCAN_GLOBS.includes("*.mdc"));
});

Deno.test("every scanned extension also triggers rules.yml on push, and pull_request stays unfiltered", async () => {
  // An extension scanned here but absent from the `push` filter is worse than
  // not scanning it: the workflow never fires, so the gate reports green because
  // it never ran. This test is the only thing holding the two files together.
  // Both scan sets are covered: the markdown allowlist and the forbidden assets
  // run off the same `git ls-files` machinery and need the same trigger.
  //
  // `pull_request` is deliberately unfiltered (MESITA-1576): a required check
  // a path filter skips shows as Expected and blocks the PR forever, so every
  // PR triggers this workflow and its `changes` job decides whether there's
  // anything to check. That trivially covers every glob on the PR side — only
  // `push` still filters by path, so only push needs each glob spelled out.
  const yml = await Deno.readTextFile(join(repoRoot, ".github", "workflows", "rules.yml"));
  assert(
    /pull_request:\s*\{\}/.test(yml),
    "rules.yml's pull_request trigger must stay unfiltered (MESITA-1576) — a path filter here means the required check never reports on an out-of-scope PR",
  );
  for (const glob of [...MD_SCAN_GLOBS, ...FORBIDDEN_ASSET_GLOBS]) {
    assert(
      yml.includes(`"**/${glob}"`),
      `rules.yml must list "**/${glob}" under push paths`,
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
    "apps/web-admin/public/IMG_0042.HEIC",
  ];
  assertEquals(findForbiddenAssets(tracked), tracked);
});

Deno.test("findForbiddenAssets passes the formats the repo actually ships", () => {
  assertEquals(
    findForbiddenAssets([
      "assets/brand/logo.svg",
      "apps/web-consumer/public/og.png",
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

// ── The §0 stamp — the hand mirror's one machine-checkable fact ─────────────

Deno.test("findStamp reads exactly one `stamp: v<N> <date>` and refuses none or two", () => {
  assertEquals(findStamp("mirrors Rules §0 (`stamp: v2 2026-09-12`; unequal stamps are drift)"), { version: 2, date: "2026-09-12", raw: "`stamp: v2 2026-09-12`" });
  assertEquals(findStamp("no stamp here"), null);
  assertEquals(findStamp("`stamp: v1 2026-09-12` and again `stamp: v2 2026-09-13`"), null, "two stamps say nothing");
  assertEquals(findStamp("stamp: v2 2026-09-12"), null, "the stamp is code-formatted, as the Mirror line writes it");
});

Deno.test("the shipped quickstart carries the stamp, and the message names the fix", async () => {
  const text = await Deno.readTextFile(join(repoRoot, "scripts", "rules-quickstart.md"));
  const stamp = findStamp(text);
  assert(stamp !== null && stamp.version >= 2, "the quickstart shipped with stamp v2 on 2026-09-12");
  const msg = missingStampMessage();
  assertStringIncludes(msg, "NO STAMP");
  assertStringIncludes(msg, "copy the stamp from Rules §0");
});

Deno.test("the shipped quickstart is within budget", async () => {
  const canonical = await Deno.readTextFile(join(repoRoot, "scripts", "rules-quickstart.md"));
  const words = countWords(canonical);
  assert(
    words <= QUICKSTART_WORD_BUDGET,
    `scripts/rules-quickstart.md is ${words} words > ${QUICKSTART_WORD_BUDGET}`,
  );
});

Deno.test("the shipped chat boot card is within budget", async () => {
  const card = await Deno.readTextFile(join(repoRoot, "scripts", "chat-instructions.md"));
  const words = countWords(card);
  assert(
    words <= CHAT_INSTRUCTIONS_WORD_BUDGET,
    `scripts/chat-instructions.md is ${words} words > ${CHAT_INSTRUCTIONS_WORD_BUDGET}`,
  );
});

Deno.test("the shipped Redeye protocol is within budget", async () => {
  const card = await Deno.readTextFile(join(repoRoot, "scripts", "redeye.md"));
  const words = countWords(card);
  assert(
    words <= REDEYE_WORD_BUDGET,
    `scripts/redeye.md is ${words} words > ${REDEYE_WORD_BUDGET}`,
  );
});

// The protocol is the half of Redeye no gate can enforce, and the two clauses a drifting rewrite
// would soften first are the two that cost an agent nothing to ignore: asking, and stopping. A
// card that no longer forbids either still passes every other check here, so both are pinned.
Deno.test("the Redeye protocol still prohibits asking and still refuses to stop", async () => {
  const card = await Deno.readTextFile(join(repoRoot, "scripts", "redeye.md"));
  assertStringIncludes(card, "Asking is prohibited");
  assertStringIncludes(card, "Never stop");
  assertStringIncludes(card, "decision:");
  assertStringIncludes(card, "needs-human");
  // The bypass is the whole point, and the claim surviving it is the whole safety.
  assertStringIncludes(card, "preflight.sh");
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

// ── CI workflows: one gating pattern, and the required checks exist ─────────
//
// Every workflow runs on every PR (`pull_request: {}`) and a `changes` job's
// path filter decides which checks have anything to do. A gated check whose
// paths did not change is SKIPPED, and GitHub counts a SKIPPED required check
// as passing, so the PR merges. Two halves keep a broken `changes` job from
// passing a PR by skipping its checks: `!cancelled()` replaces the default
// `success()`, which skips every gated job the moment `changes` fails, and the
// gate compares against 'false': a filter that never ran leaves its output
// empty, and empty runs the check. The checks below pin both halves, and that
// .github/required-checks.json (what the ruleset requires) names real jobs.

type WorkflowJob = {
  name?: string;
  needs?: string | string[];
  if?: unknown;
  outputs?: Record<string, unknown>;
  steps?: { id?: string; uses?: string }[];
};
type Workflow = { file: string; on: Record<string, unknown>; jobs: Record<string, WorkflowJob> };

const GATE_IF = /^\$\{\{ !cancelled\(\) && needs\.changes\.outputs\.([A-Za-z0-9_-]+) != 'false' \}\}$/;
const GATE_IF_SHAPE = "${{ !cancelled() && needs.changes.outputs.<output> != 'false' }}";
// The raw filter output, or 'true' for every event but a PR. Never a comparison:
// `steps.filter.outputs.x == 'true'` turns a filter that never ran into 'false'.
const CHANGES_OUTPUT =
  /^\$\{\{ (?:github\.event_name != 'pull_request' && 'true' \|\| )?steps\.filter\.outputs\.([A-Za-z0-9_-]+) \}\}$/;
const CHANGES_OUTPUT_SHAPE =
  "${{ steps.filter.outputs.<filter> }}, or ${{ github.event_name != 'pull_request' && 'true' || steps.filter.outputs.<filter> }}";

function parseWorkflow(file: string, text: string): Workflow {
  const doc = (parseYaml(text) ?? {}) as Record<string, unknown>;
  const on = doc.on;
  return {
    file,
    on: typeof on === "string"
      ? { [on]: null }
      : Array.isArray(on)
      ? Object.fromEntries(on.map((event) => [String(event), null]))
      : ((on ?? {}) as Record<string, unknown>),
    jobs: (doc.jobs ?? {}) as Record<string, WorkflowJob>,
  };
}

async function readWorkflows(): Promise<Workflow[]> {
  const dir = join(repoRoot, ".github", "workflows");
  const workflows: Workflow[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !/\.ya?ml$/.test(entry.name)) continue;
    workflows.push(parseWorkflow(`.github/workflows/${entry.name}`, await Deno.readTextFile(join(dir, entry.name))));
  }
  return workflows.sort((a, b) => a.file.localeCompare(b.file));
}

async function readRequiredChecks(): Promise<unknown> {
  return JSON.parse(await Deno.readTextFile(join(repoRoot, ".github", "required-checks.json")));
}

const checkName = (id: string, job: WorkflowJob) => job.name ?? id;
const needsOf = (job: WorkflowJob) => (job.needs === undefined ? [] : [job.needs].flat());

function gateProblems(workflows: Workflow[]): string[] {
  const problems: string[] = [];
  for (const w of workflows) {
    const outputs = Object.keys(w.jobs.changes?.outputs ?? {});
    for (const [id, job] of Object.entries(w.jobs)) {
      const needs = needsOf(job);
      if (!needs.includes("changes")) continue;
      const at = `${w.file} › ${id}`;
      if (needs.length !== 1) {
        problems.push(`${at}: needs ${needs.join(", ")}; a gated job needs \`changes\` alone — !cancelled() would run it past any other failed need`);
      }
      const gate = typeof job.if === "string" ? GATE_IF.exec(job.if) : null;
      if (!gate) {
        problems.push(`${at}: expected if: ${GATE_IF_SHAPE}, actual: ${job.if === undefined ? "(none)" : String(job.if)}`);
      } else if (!outputs.includes(gate[1])) {
        problems.push(`${at}: needs.changes.outputs.${gate[1]} is not an output of its changes job (outputs: ${outputs.join(", ") || "none"})`);
      }
    }
  }
  return problems;
}

function changesOutputProblems(workflows: Workflow[]): string[] {
  const problems: string[] = [];
  for (const w of workflows) {
    const changes = w.jobs.changes;
    if (!changes) continue;
    const steps = changes.steps ?? [];
    const filter = steps.findIndex((step) => step.id === "filter");
    if (filter === -1 || !steps[filter].uses?.startsWith("dorny/paths-filter@")) {
      problems.push(`${w.file} › changes: expected a dorny/paths-filter step with id: filter, actual: none`);
    } else if (filter !== steps.length - 1) {
      problems.push(`${w.file} › changes: expected the filter step last, actual: step ${filter + 1} of ${steps.length} — a later step can fail after the filter wrote 'false', and the gate skips`);
    }
    for (const [name, value] of Object.entries(changes.outputs ?? {})) {
      if (!CHANGES_OUTPUT.test(String(value))) {
        problems.push(`${w.file} › changes.outputs.${name}: expected ${CHANGES_OUTPUT_SHAPE}, actual: ${String(value)}`);
      }
    }
  }
  return problems;
}

function pullRequestFilterProblems(workflows: Workflow[]): string[] {
  const problems: string[] = [];
  for (const w of workflows) {
    if (!w.jobs.changes) continue;
    const pr = w.on.pull_request;
    const unfiltered = pr === null || (typeof pr === "object" && pr !== undefined && Object.keys(pr).length === 0);
    if (!("pull_request" in w.on) || !unfiltered) {
      problems.push(`${w.file}: expected on.pull_request: {} (the changes job does the filtering, so every check reports), actual: ${"pull_request" in w.on ? JSON.stringify(pr) : "no pull_request trigger"}`);
    }
  }
  return problems;
}

function requiredCheckProblems(workflows: Workflow[], required: unknown): string[] {
  if (!Array.isArray(required) || required.length === 0 || !required.every((n) => typeof n === "string" && n !== "")) {
    return [`.github/required-checks.json: expected a non-empty JSON array of check names, actual: ${JSON.stringify(required)}`];
  }
  const producers = new Map<string, string[]>();
  for (const w of workflows) {
    for (const [id, job] of Object.entries(w.jobs)) {
      const name = checkName(id, job);
      producers.set(name, [...(producers.get(name) ?? []), `${w.file} › ${id}`]);
    }
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const name of required as string[]) {
    if (seen.has(name)) problems.push(`.github/required-checks.json: "${name}" is listed twice`);
    seen.add(name);
    const by = producers.get(name) ?? [];
    if (by.length === 0) {
      problems.push(`.github/required-checks.json: "${name}" is no job's name — a required check nothing reports blocks every PR as Expected`);
    } else if (by.length > 1) {
      problems.push(`.github/required-checks.json: "${name}" is the name of ${by.length} jobs (${by.join(", ")}) — one required name, one job`);
    }
  }
  return problems;
}

function unrequiredJobProblems(workflows: Workflow[], required: string[]): string[] {
  const problems: string[] = [];
  for (const w of workflows) {
    if (!("pull_request" in w.on) && !("pull_request_target" in w.on)) continue;
    for (const [id, job] of Object.entries(w.jobs)) {
      if (id === "changes") continue;
      const name = checkName(id, job);
      if (!required.includes(name)) {
        problems.push(`${w.file} › ${id}: "${name}" runs on every PR but is not in .github/required-checks.json — require it, or delete the job`);
      }
    }
  }
  return problems;
}

Deno.test("every job that needs `changes` is gated by the one pattern", async () => {
  const problems = gateProblems(await readWorkflows());
  assertEquals(problems, [], `\n${problems.join("\n")}`);
});

Deno.test("every `changes` output is its filter's raw output, so a filter that never ran runs the gate", async () => {
  const problems = changesOutputProblems(await readWorkflows());
  assertEquals(problems, [], `\n${problems.join("\n")}`);
});

Deno.test("a workflow with a `changes` job runs on every pull request", async () => {
  const problems = pullRequestFilterProblems(await readWorkflows());
  assertEquals(problems, [], `\n${problems.join("\n")}`);
});

Deno.test(".github/required-checks.json names each required check once, and exactly one job reports it", async () => {
  const problems = requiredCheckProblems(await readWorkflows(), await readRequiredChecks());
  assertEquals(problems, [], `\n${problems.join("\n")}`);
});

Deno.test("every job that runs on a pull request is a required check, or a `changes` job", async () => {
  const required = await readRequiredChecks();
  assert(Array.isArray(required), ".github/required-checks.json must be a JSON array");
  const problems = unrequiredJobProblems(await readWorkflows(), required as string[]);
  assertEquals(problems, [], `\n${problems.join("\n")}`);
});

Deno.test("the CI checks bite: each old shape is rejected", () => {
  const bad = parseWorkflow(
    "bad.yml",
    `
on:
  pull_request:
    paths: ["x/**"]
jobs:
  changes:
    outputs:
      changed: \${{ github.event_name != 'pull_request' || steps.filter.outputs.x == 'true' }}
    steps:
      - uses: dorny/paths-filter@0e4a8c6effa4802afeda77dc8d303f8176d7dfad
        id: filter
      - run: echo after the filter
  check:
    name: x check
    needs: changes
    if: needs.changes.outputs.changed == 'true'
  build:
    name: x build
    needs: [changes, check]
    if: \${{ !cancelled() && needs.changes.outputs.missing != 'false' }}
`,
  );
  const gates = gateProblems([bad]);
  assertEquals(gates.length, 3, gates.join("\n"));
  assertStringIncludes(gates.join("\n"), "expected if: ${{ !cancelled() && needs.changes.outputs.<output> != 'false' }}, actual: needs.changes.outputs.changed == 'true'");
  assertStringIncludes(gates.join("\n"), "needs changes, check");
  assertStringIncludes(gates.join("\n"), "needs.changes.outputs.missing is not an output");
  const outputs = changesOutputProblems([bad]);
  assertEquals(outputs.length, 2, outputs.join("\n"));
  assertStringIncludes(outputs.join("\n"), "expected the filter step last");
  assertStringIncludes(outputs.join("\n"), "changes.outputs.changed");
  assertEquals(pullRequestFilterProblems([bad]).length, 1);
  assertEquals(requiredCheckProblems([bad], ["x check", "x check", "nobody"]).length, 2);
  assertEquals(requiredCheckProblems([bad, { ...bad, file: "copy.yml" }], ["x check"]).length, 1);
  assertEquals(requiredCheckProblems([bad], "x check").length, 1);
  assertEquals(unrequiredJobProblems([bad], ["x check"]), [`bad.yml › build: "x build" runs on every PR but is not in .github/required-checks.json — require it, or delete the job`]);
});

Deno.test("the CI checks pass the canonical shape", () => {
  const good = parseWorkflow(
    "good.yml",
    `
on:
  push:
    branches: [main]
  pull_request: {}
jobs:
  changes:
    outputs:
      x: \${{ github.event_name != 'pull_request' && 'true' || steps.filter.outputs.x }}
      y: \${{ steps.filter.outputs.y }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@0e4a8c6effa4802afeda77dc8d303f8176d7dfad
        id: filter
  check:
    name: x check
    needs: changes
    if: \${{ !cancelled() && needs.changes.outputs.x != 'false' }}
`,
  );
  assertEquals(gateProblems([good]), []);
  assertEquals(changesOutputProblems([good]), []);
  assertEquals(pullRequestFilterProblems([good]), []);
  assertEquals(requiredCheckProblems([good], ["x check"]), []);
  assertEquals(unrequiredJobProblems([good], ["x check"]), []);
});
