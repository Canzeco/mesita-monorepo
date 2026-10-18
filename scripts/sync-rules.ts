#!/usr/bin/env -S deno run --allow-read --allow-write
// sync-rules.ts — regenerate the agent-instruction files across the monorepo
// from ONE canonical source (scripts/rules-quickstart.md), and enforce the two
// laws that keep them from rotting (Rules §0): the markdown
// allowlist and the word budgets. It also carries one repo-wide file-extension
// guard that shares the same `git ls-files` machinery: FORBIDDEN_ASSET_EXTS
// (MESITA-1077).
//
// CONTRACT (monorepo form — 2026-07-11 / MESITA-456 + MESITA-462):
//   Root CLAUDE.md    = generated quickstart block (between the markers below)
//                       + hand-written "## This repo …" tail below the END marker.
//   Package CLAUDE.md = hand-written package rules ONLY. The quickstart lives at
//                       the root; the markers are FORBIDDEN in package files.
//   Every AGENTS.md   = FULLY GENERATED: a notice line + a byte-exact copy of its
//                       sibling CLAUDE.md, so Cursor/Codex read the same content.
//                       NEVER hand-edit any AGENTS.md.
//
// SOURCE OF TRUTH: the Notion **Rules** page §0 is the human master. When it
// changes, mirror it into scripts/rules-quickstart.md, then run (from repo root):
//     deno task sync-rules
// Pass --check to verify without writing (STRICT: drift, missing files, markers
// in package files, strays, or over-budget files exit 1). Pass --only <label> to
// target one entry.
//
// Worktree conflicts on these files: regenerate (run this script), never hand-merge.
// Adding a package = one TARGETS entry.
//
// Pure helpers are exported and the entrypoint is guarded by `import.meta.main`
// so scripts/sync-rules.test.ts can exercise every gate without running a sync.

import { dirname, fromFileUrl, join } from "@std/path";

export const START =
  "<!-- RULES-QUICKSTART:START (generated — do not hand-edit; run: deno task sync-rules) -->";
export const END = "<!-- RULES-QUICKSTART:END -->";
export const AGENTS_NOTICE =
  "<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->";

// ── Word budgets (KADLC — docs are rewritten, not amended) ──────────────────
// Instruction files die of accretion: each session appends a clause and agents
// replicate the mutations at machine speed. The budget is the forcing function:
// over it, the fix is a from-scratch rewrite (present law only, no history),
// never another appended parenthetical.
//
// The root file is measured as TWO budgets, not one. Its quickstart block is
// generated from the canonical source and carries the quickstart budget; its
// hand-written tail is package-local content and carries the package budget.
// Budgeting only the block would leave the tail as the one unmetered surface
// in the tree, which is exactly where accretion would migrate next.
//
// Ceilings are PER FILE (see TARGETS), not one number. The surfaces differ in
// size: a single ceiling loose enough for supabase hands web-landing ~200
// words of headroom, which stops forcing anything there.
//
// Every ceiling is ceilingFor(words) of its file at its last from-scratch
// rewrite: 10% headroom, never less than 20 words. A one-line fix fits; the
// next appended paragraph trips the gate instead of sliding under it. Raising
// one is a visible line in a table here with its reason in a comment; a budget
// nobody sees being raised is not a budget.
export function ceilingFor(words: number): number {
  return Math.max(Math.ceil((words * 11) / 10), words + 20);
}

export const QUICKSTART_WORD_BUDGET = 700;
export const DEFAULT_PACKAGE_WORD_BUDGET = 220;

// ── Chat boot card budget (MESITA-1762) ─────────────────────────────────────
// scripts/chat-instructions.md is pasted verbatim into a chat project's
// Instructions box (claude.ai, Claude desktop Chat/Cowork, ChatGPT). It is a
// redundant copy on purpose: the box has no diff and no check, this file has
// both. It carries pointers, the claim line and the door — never knowledge.
export const CHAT_INSTRUCTIONS_WORD_BUDGET = 250;

// ── Redeye protocol budget (MESITA-1989) ───────────────────────────────────
// scripts/redeye.md is mode 6: the half of Redeye no file can enforce. An
// agent is handed it by `deno task redeye`, or by the SessionStart hook in a
// cloud clone, and obeys it. It is the autonomy law — asking is prohibited, the queue is the unit
// of work, the claim survives the bypass — and nothing else. It runs longer
// than the chat card because it carries two things that
// card does not: a loop, and a platform axis — local or cloud, four agents. It
// stays shorter than the quickstart because it states no product fact: every
// line an agent could instead read in Rules, Docs or a CLAUDE.md belongs there,
// and a line that drifts from them is worse than a line that is missing.
export const REDEYE_WORD_BUDGET = 500;

// ── Tooling cards (Markdowns) ───────────────────────────────────────────────
// The tooling dirs are allowlisted wholesale (MD_ALLOW_DIRS), and an allowed
// file nobody measures grows unseen. So every markdown file in them owes a row
// here, except a skill's, which its directory's skill budget measures. The
// allowlist decides what may exist; these ceilings decide how big each card
// may get. An unlisted card fails until it gets a row.
export const CARD_BUDGETS: Record<string, number> = {
  ".github/README.md": 150,
  ".github/SECURITY.md": 100,
  ".github/CONTRIBUTING.md": 100,
  ".github/PULL_REQUEST_TEMPLATE.md": 60,
  ".cursor/rules/autonomy.mdc": 128,
};

/** A markdown file in a tooling dir that is not part of a skill: it owes a CARD_BUDGETS row. */
export function isToolingCard(path: string): boolean {
  return MD_ALLOW_DIRS.some((d) => path.startsWith(d)) && /\.(md|MD|mdx|mdc)$/.test(path) &&
    skillNameOf(path) === null;
}

export function cardBudgetCheck(path: string, words: number): BudgetCheck {
  const budget = CARD_BUDGETS[path];
  if (budget === undefined) {
    return { label: path, words, budget: 0, over: true };
  }
  return { label: path, words, budget, over: words > budget };
}

export function unbudgetedCardMessage(path: string): string {
  return `${path}: no budget; add its CARD_BUDGETS row in sync-rules.ts ` +
    `(ceilingFor its words) and its Markdowns row`;
}

// ── Skill budgets (Rules §0) ────────────────────────────────────────────────
// `.claude/` is allowlisted wholesale (MD_ALLOW_DIRS below), so without this a
// skill would be the one markdown file the budget law cannot reach. A docs
// folder growing back under a different name is still a docs folder.
//
// A skill is a PROCEDURE, not law: ordered steps, queries, thresholds, report
// shapes. It legitimately runs longer than a package CLAUDE.md, so it gets its
// own default rather than being crushed into a card's.
//
// The budget is per SKILL DIRECTORY, summed over every tracked markdown file in
// it. Budgeting SKILL.md alone would make the cure for an over-budget skill
// "move half of it into a sibling reference.md" — accretion plus one more file.
export const DEFAULT_SKILL_WORD_BUDGET = 1500;

// Explicit ceilings, same rule as TARGETS: keyed by skill name, each naming why
// it needs one. Raising a number here is a visible line in the diff, which is
// the whole point — a budget nobody sees being raised is not a budget.
export const SKILL_BUDGETS: Record<string, number> = {};

/** The one tokenizer, so every budget is measured the same way. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── The §0 stamp (Rules §0, Mirror line) ────────────────────────────────────
// Rules §0 and the quickstart are mirrors by hand — no Notion token exists — and paraphrases,
// so no diff can compare them. Both carry `stamp: v<N> <date>`: equal stamps mean the copy is
// current, unequal stamps are drift, and every session that fetches Rules sees both. A
// quickstart with no stamp, or with two, fails the check.
export const RULES_STAMP_RE = /`stamp: v(\d+) (\d{4}-\d{2}-\d{2})`/g;

export function findStamp(text: string): { version: number; date: string; raw: string } | null {
  const all = [...text.matchAll(RULES_STAMP_RE)];
  if (all.length !== 1) return null;
  const [raw, version, date] = all[0];
  return { version: Number(version), date, raw };
}

export function missingStampMessage(): string {
  return "NO STAMP: scripts/rules-quickstart.md carries no single `stamp: v<N> <date>` — " +
    "Rules §0's Mirror line and the quickstart carry the same stamp so drift is visible without a Notion token — " +
    "copy the stamp from Rules §0 (bump it there first when §0 changed) and rerun (Rules §0).";
}

// ── Markdown allowlist (Rules §0) ───────────────────────────────────────────
// The repo holds NO knowledge markdown: knowledge lives in Notion (the Docs
// tree), task/commit context lives in Linear, code explanation lives in code
// comments. The ONLY tracked files allowed are the instruction pairs, this
// script's quickstart source, the two boot cards (scripts/chat-instructions.md,
// MESITA-1762; scripts/redeye.md, MESITA-1989), and agent tooling
// config. Anything else fails CI.
//
// `.mdc` is scanned because Cursor reads `.cursor/rules/*.mdc` as rules (SADLC
// adapters, the Cursor rows) — an unscanned dialect is a rule channel outside the allowlist, which is
// how a stray package rule once lived in the repo unnoticed.
//
// KEEP IN SYNC with the `paths:` filters in .github/workflows/rules.yml — YAML
// cannot import from TS, so the extension set is stated in both places. An
// extension scanned here but missing there is worse than not scanning it: the
// workflow never fires, so the gate looks green because it never ran.
export const MD_SCAN_GLOBS = ["*.md", "*.MD", "*.mdx", "*.mdc"];

// Root-anchored ON PURPOSE. A nested tooling dir (e.g. apps/<app>/.cursor/rules)
// is a second rule-layering mechanism that only ONE platform reads, so a rule
// parked there is invisible to every other agent. Package rules belong in that
// package's CLAUDE.md, which every platform loads through its own dialect.
//
// Allowlisted ≠ unmeasured: a skill owes its directory's word budget
// (SKILL_BUDGETS above), every other file here a CARD_BUDGETS row. The
// allowlist decides what may exist, the budget decides how big it may get.
export const MD_ALLOW_DIRS = [".claude/", ".cursor/", ".codex/", ".github/"];

// ── Forbidden asset extensions (MESITA-1077) ───────────────────────────────
// `image-size` carries four high-severity advisories with NO patched release
// (2.0.2 is latest; the advisories cover `<= 2.0.2`). It is transitive through
// metro — build-time only, never in a shipped binary — and both advisories are
// infinite loops in the ICNS parser and the JXL/HEIF parsers specifically. The
// alerts were dismissed as `not_used` on exactly one premise: the repo ships no
// asset in any of those formats. That premise was a sentence in a dismissal;
// this list makes it a check. Add one such asset and the build the advisory
// describes becomes reachable, with nothing left to notice — a dismissed alert
// never reopens on its own.
//
// Matched case-insensitively: an iPhone export is `IMG_1234.HEIC`, so a
// lowercase-only gate would miss the single likeliest way one arrives.
export const FORBIDDEN_ASSET_EXTS = [".icns", ".jxl", ".heif", ".heic"];

// Same KEEP IN SYNC contract as MD_SCAN_GLOBS: every glob here must appear in
// the `paths:` filters of .github/workflows/rules.yml under BOTH events, or the
// workflow never fires on the file it exists to reject. Upper case is spelled
// out because both git pathspecs and GitHub path filters are case-sensitive.
export const FORBIDDEN_ASSET_GLOBS = FORBIDDEN_ASSET_EXTS.flatMap((ext) => [
  `*${ext}`,
  `*${ext.toUpperCase()}`,
]);

/** Tracked paths whose extension is one the unpatched parsers choke on. */
export function findForbiddenAssets(tracked: string[]): string[] {
  return tracked.filter((f) => {
    const lower = f.toLowerCase();
    return FORBIDDEN_ASSET_EXTS.some((ext) => lower.endsWith(ext));
  });
}

export function forbiddenAssetMessage(path: string): string {
  return `FORBIDDEN ASSET: ${path} — ${FORBIDDEN_ASSET_EXTS.join("/")} are the formats ` +
    `image-size's unpatched advisories parse into an infinite loop (MESITA-1077). ` +
    `The Dependabot dismissal holds only while the repo ships none: convert it to ` +
    `png/svg/jpg, or reopen the alerts before landing this.`;
}

const repoRoot = dirname(dirname(fromFileUrl(import.meta.url)));

export type Target = { label: string; dir: string; quickstart: boolean; budget?: number };

// `budget` omitted = DEFAULT_PACKAGE_WORD_BUDGET, the ceiling a new package's
// card starts from. A card is law only: the rules an agent needs before its
// first edit that no test enforces, plus a one-line pointer to each test that
// pins the rest. Product description lives in Notion Docs. Every row below is
// ceilingFor() of the 2026-10-18 rewrite (MESITA-2394); one above the default
// names why.
export const TARGETS: Target[] = [
  { label: "root", dir: repoRoot, quickstart: true, budget: 218 },
  { label: "apps/web-admin", dir: join(repoRoot, "apps", "web-admin"), quickstart: false, budget: 205 },
  // The widest app: the route contract, the overlay primitives and the auth wall.
  { label: "apps/web-consumer", dir: join(repoRoot, "apps", "web-consumer"), quickstart: false, budget: 297 },
  { label: "apps/web-landing", dir: join(repoRoot, "apps", "web-landing"), quickstart: false, budget: 104 },
  // The deploy path, the ACL and the RLS rules no test pins.
  { label: "supabase", dir: join(repoRoot, "supabase"), quickstart: false, budget: 351 },
];

/** Repo-relative paths every tracked markdown file is checked against. */
export function buildAllowedFiles(targets: Target[], root: string): Set<string> {
  return new Set<string>([
    "scripts/rules-quickstart.md",
    "scripts/chat-instructions.md",
    "scripts/redeye.md",
    ...targets.flatMap(({ dir }) => {
      const rel = dir === root ? "" : dir.slice(root.length + 1) + "/";
      return [`${rel}CLAUDE.md`, `${rel}AGENTS.md`];
    }),
  ]);
}

export function findStrayMarkdown(tracked: string[], allowed: Set<string>): string[] {
  return tracked.filter((f) =>
    !allowed.has(f) && !MD_ALLOW_DIRS.some((d) => f.startsWith(d))
  );
}

export type MarkerSpan = { start: number; end: number };

/**
 * Locate the generated quickstart block. Exactly one START must precede exactly
 * one END; anything else is ambiguous and must fail rather than guess which
 * span to overwrite.
 */
export function findMarkerSpan(text: string): MarkerSpan | null {
  const s = text.indexOf(START);
  const e = text.indexOf(END);
  if (s === -1 || e === -1 || s > e) return null;
  if (text.indexOf(START, s + 1) !== -1) return null;
  if (text.indexOf(END, e + END.length) !== -1) return null;
  return { start: s, end: e };
}

/** The root file's hand-written tail: everything below the END marker. */
export function rootTail(text: string): string {
  const span = findMarkerSpan(text);
  return span === null ? text : text.slice(span.end + END.length);
}

export type BudgetCheck = { label: string; words: number; budget: number; over: boolean };

/**
 * Every budget a single CLAUDE.md owes. Package files owe one; the root owes
 * two — the generated block and the hand-written tail are separate surfaces
 * with separate cures.
 */
export function budgetsFor(target: Target, text: string): BudgetCheck[] {
  const budget = target.budget ?? DEFAULT_PACKAGE_WORD_BUDGET;
  const measured = target.quickstart ? rootTail(text) : text;
  const label = target.quickstart ? "CLAUDE.md tail" : `${target.label}/CLAUDE.md`;
  const words = countWords(measured);
  return [{ label, words, budget, over: words > budget }];
}

// ── Skills: which files a skill budget measures ─────────────────────────────
// Project-local skills ONLY. gstack ships its skills as symlinks from a
// separate repo (~/.claude/gstack); measuring those would budget files this
// repo does not own and cannot rewrite. Two filters keep them out: the file
// must be TRACKED here, and it must be a regular blob (git mode 100644/100755),
// never a symlink (120000).
export const SKILLS_DIR = ".claude/skills/";

export type LsFile = { mode: string; path: string };

/** Parse `git ls-files -s` output: `<mode> <sha> <stage>\t<path>`. */
export function parseLsFiles(stdout: string): LsFile[] {
  return stdout.split("\n").flatMap((line) => {
    const tab = line.indexOf("\t");
    if (tab === -1) return [];
    const mode = line.slice(0, line.indexOf(" "));
    const path = line.slice(tab + 1);
    return path ? [{ mode, path }] : [];
  });
}

/** `.claude/skills/<name>/<anything>.md` → `<name>`; anything else → null. */
export function skillNameOf(path: string): string | null {
  if (!path.startsWith(SKILLS_DIR)) return null;
  const [name, ...rest] = path.slice(SKILLS_DIR.length).split("/");
  return name && rest.length > 0 ? name : null;
}

/** Group a skill's tracked markdown under its name — one budget per skill. */
export function groupSkillDocs(files: LsFile[]): Map<string, string[]> {
  const bySkill = new Map<string, string[]>();
  for (const { mode, path } of files) {
    if (mode === "120000") continue; // symlinked in from another repo
    const name = skillNameOf(path);
    if (name === null) continue;
    const paths = bySkill.get(name);
    if (paths) paths.push(path);
    else bySkill.set(name, [path]);
  }
  for (const paths of bySkill.values()) paths.sort();
  return bySkill;
}

export function skillBudgetCheck(name: string, words: number, budgets: Record<string, number> = SKILL_BUDGETS): BudgetCheck {
  const budget = budgets[name] ?? DEFAULT_SKILL_WORD_BUDGET;
  return { label: `${SKILLS_DIR}${name}/`, words, budget, over: words > budget };
}

export function overBudgetMessage({ label, words, budget }: BudgetCheck): string {
  return `${label}: ${words}/${budget} words; cut, or raise its row in sync-rules.ts with a reason`;
}

async function main(): Promise<void> {
  const rawArgs = [...Deno.args];
  const check = rawArgs.includes("--check");
  const onlyIdx = rawArgs.indexOf("--only");
  const only = onlyIdx === -1 ? undefined : rawArgs[onlyIdx + 1];

  const targets = only ? TARGETS.filter((t) => t.label === only) : TARGETS;
  if (only && targets.length === 0) {
    console.error(`unknown --only label: ${only}`);
    Deno.exit(1);
  }

  const canonical =
    (await Deno.readTextFile(join(repoRoot, "scripts", "rules-quickstart.md"))).trim();
  const block = `${START}\n${canonical}\n${END}`;

  let updated = 0, drifted = 0, failed = 0;

  if (!findStamp(canonical)) {
    console.error(missingStampMessage());
    failed++;
  }

  async function reconcile(path: string, next: string, label: string): Promise<void> {
    let current: string | null;
    try {
      current = await Deno.readTextFile(path);
    } catch {
      current = null;
    }
    if (current === next) return;
    drifted++;
    if (check) {
      console.error(`OUT OF SYNC: ${label}`);
      return;
    }
    await Deno.writeTextFile(path, next);
    updated++;
    console.log(`updated: ${label}`);
  }

  for (const target of targets) {
    const { label, dir, quickstart } = target;
    const claudePath = join(dir, "CLAUDE.md");
    let text: string;
    try {
      text = await Deno.readTextFile(claudePath);
    } catch {
      console.error(`MISSING: ${label}/CLAUDE.md`);
      failed++;
      continue;
    }
    let nextClaude: string;
    if (quickstart) {
      const span = findMarkerSpan(text);
      if (span === null) {
        console.error(`BAD MARKERS (need exactly one START before one END): ${label}/CLAUDE.md`);
        failed++;
        continue;
      }
      nextClaude = text.slice(0, span.start) + block + text.slice(span.end + END.length);
    } else {
      if (text.includes("RULES-QUICKSTART:")) {
        console.error(
          `QUICKSTART MARKERS IN PACKAGE FILE (the block lives at the root only): ${label}/CLAUDE.md`,
        );
        failed++;
        continue;
      }
      nextClaude = text;
    }
    await reconcile(claudePath, nextClaude, `${label}/CLAUDE.md`);
    await reconcile(join(dir, "AGENTS.md"), `${AGENTS_NOTICE}\n${nextClaude}`, `${label}/AGENTS.md`);

    // Budget the file we just wrote, not the one we read.
    for (const b of budgetsFor(target, nextClaude)) {
      if (b.over) {
        console.error(overBudgetMessage(b));
        failed++;
      }
    }
  }

  const quickstartWords = countWords(canonical);
  if (quickstartWords > QUICKSTART_WORD_BUDGET) {
    console.error(
      overBudgetMessage({
        label: "scripts/rules-quickstart.md",
        words: quickstartWords,
        budget: QUICKSTART_WORD_BUDGET,
        over: true,
      }),
    );
    failed++;
  }

  const chatWords = countWords(
    await Deno.readTextFile(join(repoRoot, "scripts", "chat-instructions.md")),
  );
  if (chatWords > CHAT_INSTRUCTIONS_WORD_BUDGET) {
    console.error(
      overBudgetMessage({
        label: "scripts/chat-instructions.md",
        words: chatWords,
        budget: CHAT_INSTRUCTIONS_WORD_BUDGET,
        over: true,
      }),
    );
    failed++;
  }

  const redeyeWords = countWords(
    await Deno.readTextFile(join(repoRoot, "scripts", "redeye.md")),
  );
  if (redeyeWords > REDEYE_WORD_BUDGET) {
    console.error(
      overBudgetMessage({
        label: "scripts/redeye.md",
        words: redeyeWords,
        budget: REDEYE_WORD_BUDGET,
        over: true,
      }),
    );
    failed++;
  }

  try {
    const ls = new Deno.Command("git", {
      // `-s` so the skill budgets can tell a real file from a symlink.
      args: ["ls-files", "-s", ...MD_SCAN_GLOBS],
      cwd: repoRoot,
      stdout: "piped",
      stderr: "piped",
    });
    const out = await ls.output();
    if (out.success) {
      const files = parseLsFiles(new TextDecoder().decode(out.stdout));
      const tracked = files.map(({ path }) => path);

      // Skills are allowlisted but not exempt: measured per directory.
      for (const [name, paths] of groupSkillDocs(files)) {
        let words = 0;
        for (const p of paths) words += countWords(await Deno.readTextFile(join(repoRoot, p)));
        const b = skillBudgetCheck(name, words);
        if (b.over) {
          console.error(overBudgetMessage(b));
          failed++;
        }
      }

      // Every other file in a tooling dir owes its own row.
      for (const path of tracked.filter(isToolingCard)) {
        if (!(path in CARD_BUDGETS)) {
          console.error(unbudgetedCardMessage(path));
          failed++;
          continue;
        }
        const words = countWords(await Deno.readTextFile(join(repoRoot, path)));
        const b = cardBudgetCheck(path, words);
        if (b.over) {
          console.error(overBudgetMessage(b));
          failed++;
        }
      }

      const strays = findStrayMarkdown(tracked, buildAllowedFiles(TARGETS, repoRoot));
      for (const f of strays) {
        console.error(
          `STRAY MARKDOWN: ${f} — the repo holds no knowledge/docs markdown. ` +
            `Knowledge → Notion Docs; task context → Linear; code notes → code comments; ` +
            `package rules → that package's CLAUDE.md (Rules §0).`,
        );
      }
      failed += strays.length;
    } else {
      console.error("markdown allowlist: `git ls-files` failed — check skipped (not a git checkout?)");
      if (check) failed++;
    }
  } catch (err) {
    console.error(`markdown allowlist: could not run git (${err}) — check skipped`);
    if (check) failed++;
  }

  // Its own ls-files call rather than a wider pathspec on the one above: the
  // stray-markdown filter would otherwise see an .icns and reject it with a
  // message about knowledge docs, which is the wrong instruction entirely.
  try {
    const ls = new Deno.Command("git", {
      args: ["ls-files", ...FORBIDDEN_ASSET_GLOBS],
      cwd: repoRoot,
      stdout: "piped",
      stderr: "piped",
    });
    const out = await ls.output();
    if (out.success) {
      const tracked = new TextDecoder().decode(out.stdout).split("\n").filter(Boolean);
      // Re-filtered in TS, not trusted from the pathspec: the extension list is
      // the law, the globs are only how git is asked.
      const forbidden = findForbiddenAssets(tracked);
      for (const f of forbidden) console.error(forbiddenAssetMessage(f));
      failed += forbidden.length;
    } else {
      console.error("forbidden assets: `git ls-files` failed — check skipped (not a git checkout?)");
      if (check) failed++;
    }
  } catch (err) {
    console.error(`forbidden assets: could not run git (${err}) — check skipped`);
    if (check) failed++;
  }

  console.log(`\nsync-rules: ${updated} updated, ${drifted} drifted, ${failed} failed.`);
  if (failed > 0 || (check && drifted > 0)) {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
