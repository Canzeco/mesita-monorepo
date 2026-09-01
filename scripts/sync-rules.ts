#!/usr/bin/env -S deno run --allow-read --allow-write
// sync-rules.ts — regenerate the agent-instruction files across the monorepo
// from ONE canonical source (scripts/rules-quickstart.md), and enforce the two
// laws that keep them from rotting (Development Rules §C): the markdown
// allowlist and the word budgets. It also carries one repo-wide file-extension
// guard that shares the same `git ls-files` machinery: FORBIDDEN_ASSET_EXTS
// (MESITA-1077).
//
// CONTRACT (monorepo form, ASDM v6 — 2026-07-11 / MESITA-456 + MESITA-462):
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

// ── Word budgets (Development Rules §C — docs are rewritten, not amended) ───
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
// Ceilings are PER PACKAGE (see TARGETS), not one number. The surfaces differ
// ~10× in size: a single ceiling loose enough for supabase hands web-landing
// 600 words of headroom, which stops forcing anything for most of the repo.
// Each ceiling is ~5% above what that package needs after a from-scratch
// rewrite, so the next appended clause trips the gate instead of sliding under
// it. Raising one is a visible line in the table below — that visibility is
// the whole point; a budget nobody sees being raised is not a budget.
export const QUICKSTART_WORD_BUDGET = 700;
export const DEFAULT_PACKAGE_WORD_BUDGET = 450;

// ── Skill budgets (Development Rules §C) ────────────────────────────────────
// `.claude/` is allowlisted wholesale (MD_ALLOW_DIRS below), so every file in
// it was allowlisted and therefore never measured. That made the repo's single
// largest knowledge file — .claude/skills/doctor/SKILL.md — the one surface the
// budget law could not reach. A docs folder growing back under a different name
// is still a docs folder.
//
// A skill is a PROCEDURE, not law: ordered steps, queries, thresholds, report
// shapes. It legitimately runs longer than a package CLAUDE.md, so it gets its
// own default rather than being crushed into 450.
//
// The budget is per SKILL DIRECTORY, summed over every tracked markdown file in
// it. Budgeting SKILL.md alone would make the cure for an over-budget skill
// "move half of it into a sibling reference.md" — accretion plus one more file.
export const DEFAULT_SKILL_WORD_BUDGET = 1500;

// Explicit ceilings, same rule as TARGETS: keyed by skill name, each naming why
// it needs one. Raising a number here is a visible line in the diff, which is
// the whole point — a budget nobody sees being raised is not a budget.
export const SKILL_BUDGETS: Record<string, number> = {
  // Nine audit scopes, each carrying its own queries, thresholds and report
  // shape, plus the weekly Scope 9 run (MESITA-1214). Sized 2026-08-23 against
  // the real file, not guessed.
  doctor: 4350,
};

/** The one tokenizer, so every budget is measured the same way. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Markdown allowlist (Development Rules §C) ───────────────────────────────
// The repo holds NO knowledge markdown: knowledge lives in Notion (the Rules
// tree), task/commit context lives in Linear, code explanation lives in code
// comments. The ONLY tracked files allowed are the instruction pairs, this
// script's quickstart source, and agent tooling config. Anything else fails CI.
//
// `.mdc` is scanned because Cursor reads `.cursor/rules/*.mdc` as rules (ASDM
// §K4) — an unscanned dialect is a rule channel outside the allowlist, which is
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
// Allowlisted ≠ unmeasured: `.claude/skills/*` still owes a word budget
// (SKILL_BUDGETS above). The allowlist decides what may exist, the budget
// decides how big it may get.
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

// `budget` omitted = DEFAULT_PACKAGE_WORD_BUDGET. Only surfaces that genuinely
// cannot state their law in 450 words carry an explicit ceiling, and each one
// names why. Bumping a number here without a from-scratch rewrite first is the
// accretion this gate exists to stop.
export const TARGETS: Target[] = [
  { label: "root", dir: repoRoot, quickstart: true },
  { label: "apps/web-admin", dir: join(repoRoot, "apps", "web-admin"), quickstart: false },
  { label: "apps/web-business", dir: join(repoRoot, "apps", "web-business"), quickstart: false },
  // Widest consumer surface, and the budget is an override of the 450 default
  // for that reason: four tabs, SEVEN Discover modes, five Inbox sections, the
  // wallet, the seven-step ticket journey, and two section-nav looks.
  //
  // 600 -> 650 -> 680, both on 2026-09-01. The first raise covered Discover
  // growing its own route tree; the second covers Pay becoming a container
  // with a section row and Discover's five modes all going live with a shared
  // deck provider. Each time the test was the same and each time it was met:
  // more product to describe, not more words to say it in — three compression
  // passes ran first, and the words that remained were law.
  //
  // TWO RAISES IN ONE DAY IS THE SIGNAL, THOUGH. This file is trying to hold
  // the whole consumer product's law on one page. The next raise should not be
  // a raise: move the ticket-journey and Classes paragraphs to Notion Docs >
  // Apps, which is where deep knowledge is supposed to live, and leave this
  // file the routing and primitive rules an agent needs before its first edit.
  { label: "apps/web-consumer", dir: join(repoRoot, "apps", "web-consumer"), quickstart: false, budget: 680 },
  { label: "apps/web-landing", dir: join(repoRoot, "apps", "web-landing"), quickstart: false },
  { label: "apps/web-check", dir: join(repoRoot, "apps", "web-check"), quickstart: false },
  { label: "apps/web-validate", dir: join(repoRoot, "apps", "web-validate"), quickstart: false },
  // Native divergences + the toolchain constraints that silently break the bundle.
  { label: "apps/mobile-consumer", dir: join(repoRoot, "apps", "mobile-consumer"), quickstart: false, budget: 725 },
  { label: "apps/mobile-business", dir: join(repoRoot, "apps", "mobile-business"), quickstart: false },
  // Carries the schema invariants (security_invoker, generated name, reset registry).
  { label: "supabase", dir: join(repoRoot, "supabase"), quickstart: false, budget: 725 },
];

/** Repo-relative paths every tracked markdown file is checked against. */
export function buildAllowedFiles(targets: Target[], root: string): Set<string> {
  return new Set<string>([
    "scripts/rules-quickstart.md",
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
  const suffix = target.quickstart ? "/CLAUDE.md tail" : "/CLAUDE.md";
  const words = countWords(measured);
  return [{ label: `${target.label}${suffix}`, words, budget, over: words > budget }];
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

export function skillBudgetCheck(name: string, words: number): BudgetCheck {
  const budget = SKILL_BUDGETS[name] ?? DEFAULT_SKILL_WORD_BUDGET;
  return { label: `${SKILLS_DIR}${name}/`, words, budget, over: words > budget };
}

export function overBudgetMessage({ label, words, budget }: BudgetCheck): string {
  return `OVER BUDGET: ${label} — ${words} words > ${budget} — ` +
    `rewrite it from scratch (Development Rules §C: present law only, ` +
    `no history trails); don't trim around the edges.`;
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

      const strays = findStrayMarkdown(tracked, buildAllowedFiles(TARGETS, repoRoot));
      for (const f of strays) {
        console.error(
          `STRAY MARKDOWN: ${f} — the repo holds no knowledge/docs markdown. ` +
            `Knowledge → Notion Rules tree; task context → Linear; code notes → code comments; ` +
            `package rules → that package's CLAUDE.md (Development Rules §C).`,
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
