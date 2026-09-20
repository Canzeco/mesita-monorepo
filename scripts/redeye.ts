// scripts/redeye.ts — Redeye: the overnight run. Prompts off, protocol printed, no questions.
//
//   deno task redeye              arm it here, print scripts/redeye.md
//   deno task redeye --off        disarm: put the prompts back exactly as they were
//   deno task redeye --status     armed or not; writes nothing
//   deno task redeye --auto       arm ONLY where nobody is watching (a cloud clone); the
//                                 SessionStart hook's call, silent and successful when it declines
//
// Redeye is mode 6. Claude Code's picker stops at five, and the last one — Bypass permissions —
// only takes the prompts away: it does not stop an agent asking in prose, and it does not stop it
// stopping. Redeye is that mode plus both of those, so it splits in two down the same line. This
// file does the half a file can do: set mode 5, on any platform, local or cloud. scripts/redeye.md
// does the half no file can enforce — never ask, never stop — because the agent reads it and
// obeys. Shipping only the settings half would be the familiar trap: prompts off, agent still
// stopping every twenty minutes to ask which name to use.
//
// Arming is explicit on purpose. Locally the human types `deno task redeye`, and that typing IS
// the consent — the alternative, inferring it from the environment, is a file that silently
// removes Pato's prompts because a variable happened to be set. In a cloud clone there is nobody
// to type, so `--auto` arms on its own and only there.
//
// Only Claude Code's prompts can be turned off from inside the repo: .claude/settings.local.json
// is gitignored, so the grant is checkout-local and cannot ride a PR into anyone else's machine.
// Cursor and Codex hold their approval settings outside the repo (or in a TRACKED file, which
// would dirty the worktree and land in a diff), so for those we print the one line the operator
// runs instead of editing anything. Naming what we cannot do beats pretending we did it.
//
// Disarming restores the file byte for byte from .claude/.redeye-backup.json, so `--off` is a
// real undo rather than a guess at what the settings used to be. An arm on an already-armed
// checkout never overwrites that backup — otherwise the second arm would record the armed state
// as the thing to restore, and `--off` would restore the bypass it was asked to remove.

import { dirname, fromFileUrl, join } from "@std/path";

const repoRoot = dirname(dirname(fromFileUrl(import.meta.url)));
const SETTINGS = join(repoRoot, ".claude", "settings.local.json");
const BACKUP = join(repoRoot, ".claude", ".redeye-backup.json");
const CARD = join(repoRoot, "scripts", "redeye.md");

export type Settings = { permissions?: { defaultMode?: string; [k: string]: unknown }; [k: string]: unknown };

export const BYPASS = "bypassPermissions";

/** Arming edits ONE key. Everything else in the file — Pato's allow list — is carried through. */
export function arm(current: Settings): Settings {
  return { ...current, permissions: { ...current.permissions, defaultMode: BYPASS } };
}

/**
 * Disarming restores the backup. With no backup we still must not leave the bypass standing, so
 * the key is dropped — and `permissions` with it when that key was all it held, rather than
 * leaving `"permissions": {}` behind as a fossil of a mode that is no longer set.
 */
export function disarm(current: Settings): Settings {
  const { defaultMode: _dropped, ...rest } = current.permissions ?? {};
  const next = { ...current };
  if (Object.keys(rest).length === 0) delete next.permissions;
  else next.permissions = rest;
  return next;
}

export function isArmed(current: Settings): boolean {
  return current.permissions?.defaultMode === BYPASS;
}

/** The platform's own approval setting, which lives outside this repo. One line, or none. */
export function platformNote(platform: string): string | null {
  const token = platform.replace(/-cloud$/, "");
  if (token === "cursor") return "cursor: turn Auto-Run on in Cursor Settings › Agent — its approvals are not in this repo";
  if (token === "codex") return "codex: start it as `codex --dangerously-bypass-approvals-and-sandbox`, or set approval_policy in ~/.codex/config.toml";
  return null;
}

async function readJson(path: string): Promise<Settings | null> {
  try {
    return JSON.parse(await Deno.readTextFile(path)) as Settings;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return null;
    // A hand-broken settings file must stop the arm, not be silently replaced: the file holds
    // Pato's allow list, and overwriting it to "fix" the parse would delete that list.
    throw new Error(`${path} is not valid JSON — fix it by hand; Redeye will not overwrite it`);
  }
}

async function writeJson(path: string, value: Settings): Promise<void> {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, JSON.stringify(value, null, 2) + "\n");
}

function inCloud(get = Deno.env.get): boolean {
  const declared = get("MESITA_PLATFORM")?.trim() ?? "";
  if (declared.endsWith("-cloud")) return true;
  return get("CLAUDE_CODE_REMOTE") === "true";
}

async function main(): Promise<void> {
  const args = Deno.args;
  const current = (await readJson(SETTINGS)) ?? {};

  if (args.includes("--status")) {
    console.log(isArmed(current) ? "redeye: ARMED — prompts are off in this checkout" : "redeye: off");
    Deno.exit(isArmed(current) ? 0 : 1);
  }

  if (args.includes("--off")) {
    const backup = await readJson(BACKUP);
    if (backup) {
      await writeJson(SETTINGS, backup);
      await Deno.remove(BACKUP);
      console.log("redeye: off — .claude/settings.local.json restored from the backup taken when it was armed");
    } else {
      await writeJson(SETTINGS, disarm(current));
      console.log("redeye: off — no backup to restore, so the bypass key was dropped and the rest left alone");
    }
    Deno.exit(0);
  }

  // The SessionStart hook calls this on every session, everywhere. Declining is the normal
  // outcome on a laptop and must not look like a failure.
  if (args.includes("--auto") && !inCloud()) Deno.exit(0);

  if (isArmed(current)) {
    console.log("redeye: already armed");
  } else {
    if (!(await readJson(BACKUP))) await writeJson(BACKUP, current);
    await writeJson(SETTINGS, arm(current));
    console.log("redeye: prompts off — .claude/settings.local.json grants bypassPermissions (gitignored, this checkout only)");
    console.log("redeye: `deno task redeye --off` puts them back exactly as they were");
  }

  const note = platformNote(Deno.env.get("MESITA_PLATFORM") ?? "");
  if (note) console.log(`redeye: ${note}`);

  console.log();
  console.log(await Deno.readTextFile(CARD));
}

if (import.meta.main) await main();
