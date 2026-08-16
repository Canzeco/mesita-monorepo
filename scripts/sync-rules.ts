#!/usr/bin/env -S deno run --allow-read --allow-write
// sync-rules.ts — regenerate the agent-instruction files across the monorepo
// from ONE canonical source (scripts/rules-quickstart.md).
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
// Pass --check to verify without writing (STRICT: drift, missing files, or
// markers in package files exit 1). Pass --only <label> to target one entry.
//
// Worktree conflicts on these files: regenerate (run this script), never hand-merge.
// Adding a package = one TARGETS entry.

import { dirname, fromFileUrl, join } from "jsr:@std/path@1";

const START =
  "<!-- RULES-QUICKSTART:START (generated — do not hand-edit; run: deno task sync-rules) -->";
const END = "<!-- RULES-QUICKSTART:END -->";
const AGENTS_NOTICE =
  "<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->";

const repoRoot = dirname(dirname(fromFileUrl(import.meta.url)));

const rawArgs = [...Deno.args];
const check = rawArgs.includes("--check");
const onlyIdx = rawArgs.indexOf("--only");
const only = onlyIdx === -1 ? undefined : rawArgs[onlyIdx + 1];

const TARGETS = [
  { label: "root", dir: repoRoot, quickstart: true },
  { label: "apps/web-admin", dir: join(repoRoot, "apps", "web-admin"), quickstart: false },
  { label: "apps/web-business", dir: join(repoRoot, "apps", "web-business"), quickstart: false },
  { label: "apps/web-consumer", dir: join(repoRoot, "apps", "web-consumer"), quickstart: false },
  { label: "apps/web-landing", dir: join(repoRoot, "apps", "web-landing"), quickstart: false },
  { label: "apps/web-check", dir: join(repoRoot, "apps", "web-check"), quickstart: false },
  { label: "apps/mobile-consumer", dir: join(repoRoot, "apps", "mobile-consumer"), quickstart: false },
  { label: "apps/mobile-business", dir: join(repoRoot, "apps", "mobile-business"), quickstart: false },
  { label: "supabase", dir: join(repoRoot, "supabase"), quickstart: false },
];

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

for (const { label, dir, quickstart } of targets) {
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
    const s = text.indexOf(START);
    const e = text.indexOf(END);
    if (
      s === -1 || e === -1 || s > e ||
      text.indexOf(START, s + 1) !== -1 || text.indexOf(END, e + END.length) !== -1
    ) {
      console.error(`BAD MARKERS (need exactly one START before one END): ${label}/CLAUDE.md`);
      failed++;
      continue;
    }
    nextClaude = text.slice(0, s) + block + text.slice(e + END.length);
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
}

// ── Markdown allowlist (ASDM §C, 2026-08-16) ────────────────────────────────
// The repo holds NO knowledge markdown: knowledge lives in Notion (the Rules
// tree), task/commit context lives in Linear, code explanation lives in code
// comments. The ONLY tracked .md files allowed are the instruction pairs, this
// script's quickstart source, and agent tooling config. Anything else fails CI.
const MD_ALLOW_DIRS = [".claude/", ".cursor/", ".codex/", ".github/"];
const MD_ALLOW_FILES = new Set<string>([
  "scripts/rules-quickstart.md",
  ...TARGETS.flatMap(({ dir }) => {
    const rel = dir === repoRoot ? "" : dir.slice(repoRoot.length + 1) + "/";
    return [`${rel}CLAUDE.md`, `${rel}AGENTS.md`];
  }),
]);

try {
  const ls = new Deno.Command("git", {
    args: ["ls-files", "*.md", "*.MD", "*.mdx"],
    cwd: repoRoot,
    stdout: "piped",
    stderr: "piped",
  });
  const out = await ls.output();
  if (out.success) {
    const tracked = new TextDecoder().decode(out.stdout).split("\n").filter(Boolean);
    const strays = tracked.filter((f) =>
      !MD_ALLOW_FILES.has(f) && !MD_ALLOW_DIRS.some((d) => f.startsWith(d))
    );
    for (const f of strays) {
      console.error(
        `STRAY MARKDOWN: ${f} — the repo holds no knowledge/docs markdown. ` +
          `Knowledge → Notion Rules tree; task context → Linear; code notes → code comments (ASDM §C).`,
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

console.log(`\nsync-rules: ${updated} updated, ${drifted} drifted, ${failed} failed.`);
if (failed > 0 || (check && drifted > 0)) {
  Deno.exit(1);
}
