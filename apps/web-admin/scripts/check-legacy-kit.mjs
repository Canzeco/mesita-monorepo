// The kit ratchet (MESITA-3948), chained into `pnpm lint`.
//   1. growth:    every path on legacy-kit-files.txt must already be on main's
//                 list (on main itself, on the previous commit's list).
//   2. staleness: every listed file must still break the kit guard; a file
//                 with zero [kit/…] messages is migrated and must leave the list.
// No new CI job: `pnpm lint` runs this after eslint.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST = "apps/web-admin/legacy-kit-files.txt";

const parse = (text) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

const git = (...args) =>
  execFileSync("git", args, { cwd: APP, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function baseList() {
  const onMain =
    process.env.GITHUB_REF === "refs/heads/main" ||
    (() => {
      try {
        return git("rev-parse", "--abbrev-ref", "HEAD").trim() === "main";
      } catch {
        return false;
      }
    })();
  const ref = onMain ? "HEAD~1" : "origin/main";
  const read = () => git("show", `${ref}:${LIST}`);
  try {
    return { ref, list: parse(read()) };
  } catch {
    // A shallow CI checkout has neither origin/main nor HEAD~1: fetch it.
    try {
      if (onMain) git("fetch", "--no-tags", "--deepen=1", "origin");
      else git("fetch", "--no-tags", "--depth=1", "origin", "main:refs/remotes/origin/main");
      return { ref, list: parse(read()) };
    } catch (e) {
      const msg = String(e.stderr ?? e.message);
      // The list does not exist on the base yet: the PR that introduces it.
      if (/does not exist|exists on disk, but not in/.test(msg)) return { ref, list: null };
      throw new Error(`cannot read ${LIST} at ${ref}: ${msg.trim()}`);
    }
  }
}

const failures = [];
const listed = parse(readFileSync(path.join(APP, "legacy-kit-files.txt"), "utf8"));

const base = baseList();
if (base.list) {
  const known = new Set(base.list);
  for (const f of listed) {
    if (!known.has(f)) failures.push(`grown: ${f} is not on ${base.ref}'s list. Fix the file with the kit instead.`);
  }
}

const present = listed.filter((f) => {
  if (existsSync(path.join(APP, f))) return true;
  failures.push(`stale entry: ${f} no longer exists; remove it from legacy-kit-files.txt.`);
  return false;
});

if (present.length) {
  process.env.KIT_LEGACY_AUDIT = "1";
  const { ESLint } = await import("eslint");
  const eslint = new ESLint({ cwd: APP });
  const results = await eslint.lintFiles(present);
  for (const r of results) {
    const kit = r.messages.filter((m) => m.message.startsWith("[kit/")).length;
    if (kit === 0) {
      failures.push(`stale entry: ${path.relative(APP, r.filePath)} has no kit errors; remove it from legacy-kit-files.txt.`);
    }
  }
}

if (failures.length) {
  console.error(["legacy-kit-files.txt check failed (MESITA-3948):", ...failures.map((f) => `  ${f}`)].join("\n"));
  process.exit(1);
}
console.log(`legacy-kit-files.txt ok: ${listed.length} files, none grown, none stale.`);
