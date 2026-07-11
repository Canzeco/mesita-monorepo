#!/usr/bin/env -S deno run --allow-read --allow-write
// sync-rules.ts — regenerate the agent-instruction files across the monorepo
// from ONE canonical source (scripts/rules-quickstart.md).
//
// CONTRACT (monorepo form, ASDM v5 — 2026-07-11 / MESITA-456):
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
  { label: "apps/mobile-consumer", dir: join(repoRoot, "apps", "mobile-consumer"), quickstart: false },
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

console.log(`\nsync-rules: ${updated} updated, ${drifted} drifted, ${failed} failed.`);
if (failed > 0 || (check && drifted > 0)) {
  Deno.exit(1);
}
