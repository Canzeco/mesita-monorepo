// scripts/redeye.ts — Redeye: the overnight run. Prompts off, protocol printed, no questions.
//
//   deno task redeye              arm it here (or refresh the arming), print scripts/redeye.md
//   deno task redeye --off        disarm: put the prompts back exactly as they were
//   deno task redeye --status     armed or not, and since when; writes nothing
//   deno task redeye --auto       the SessionStart hook's call: in a cloud clone it arms; on a
//                                 laptop it only expires an arming older than ARMING_TTL_MS
//   deno task redeye --match      the UserPromptSubmit hook's call: reads the hook payload on
//                                 stdin; exit 0 when the prompt begins with `activate Redeye`,
//                                 10 when it does not, anything else is an error
//
// Any other argument exits 2 with the usage line: `deno task redeye off` (no dashes) used to fall
// through to the arm branch, so a typo turned the prompts OFF.
//
// The phrase counts only as the first non-empty line of the prompt Pato typed. Anything that
// merely contains it (a task notification, a subagent report, a pasted CLAUDE.md, a question
// about Redeye) reaches the same hook as a user turn and must not arm the bypass.
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
// The backup, .claude/.redeye-backup.json, is `{ armedAt, settings }`: `settings` is the file as
// it was before arming, so `--off` is a real undo rather than a guess, and `armedAt` is what lets
// an arming expire. An arm on an already-armed checkout refreshes `armedAt` and never overwrites
// `settings`, otherwise `--off` would restore the bypass it was asked to remove. A backup written
// before `armedAt` existed is the bare settings object; it is migrated with `armedAt` = now.
//
// An arming expires after ARMING_TTL_MS. Claude Code reads the permission mode at launch, before
// the SessionStart hook runs, so the session that notices the expiry still started in bypass
// mode: it disarms the file and says so, and the session after it prompts again. A cloud clone
// is exempt: `--auto` re-arms it every session by design.

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
  if (token === "codex") return "codex: start it as `codex --profile redeye`, the profile .codex/config.toml defines";
  return null;
}

// ── The phrase ──────────────────────────────────────────────────────────────

const PHRASE = /^activate redeye(?![a-z0-9])/i;

/** True only when the prompt's first non-empty line, trimmed, begins with `activate Redeye`. */
export function promptActivates(prompt: string): boolean {
  const first = prompt.split(/\r?\n/).map((line) => line.trim()).find((line) => line !== "") ?? "";
  return PHRASE.test(first);
}

export type MatchResult = "arm" | "no" | "error";

/** The UserPromptSubmit payload is JSON carrying a `prompt` string. Unparseable input is an error. */
export function matchPayload(raw: string): MatchResult {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return "error";
  }
  const prompt = (payload as { prompt?: unknown } | null)?.prompt;
  if (typeof prompt !== "string") return "no";
  return promptActivates(prompt) ? "arm" : "no";
}

// ── Arguments ───────────────────────────────────────────────────────────────

export type Mode = "arm" | "off" | "status" | "auto" | "match";

const FLAGS: Record<string, Mode> = { "--off": "off", "--status": "status", "--auto": "auto", "--match": "match" };

export const USAGE = "usage: deno task redeye [--off | --status | --auto | --match]";

/** No argument arms; exactly one known flag picks its mode; anything else is null, never an arm. */
export function parseMode(args: string[]): Mode | null {
  if (args.length === 0) return "arm";
  if (args.length > 1) return null;
  return FLAGS[args[0]] ?? null;
}

// ── The backup and its clock ────────────────────────────────────────────────

export const ARMING_TTL_MS = 24 * 60 * 60 * 1000;

export type Backup = { armedAt: string; settings: Settings };

/**
 * Read a backup in either shape. A backup with no valid `armedAt` (the bare settings object every
 * arm wrote before the clock existed) comes back stamped `now` and marked migrated.
 */
export function parseBackup(raw: unknown, now: Date): { backup: Backup; migrated: boolean } {
  const record = (raw ?? {}) as Record<string, unknown>;
  const shaped = typeof record.settings === "object" && record.settings !== null && "armedAt" in record;
  if (!shaped) return { backup: { armedAt: now.toISOString(), settings: record as Settings }, migrated: true };
  const stamp = record.armedAt;
  const valid = typeof stamp === "string" && !Number.isNaN(Date.parse(stamp));
  return {
    backup: { armedAt: valid ? stamp : now.toISOString(), settings: record.settings as Settings },
    migrated: !valid,
  };
}

export function isExpired(backup: Backup, now: Date, ttlMs = ARMING_TTL_MS): boolean {
  return now.getTime() - Date.parse(backup.armedAt) > ttlMs;
}

/**
 * The backup an arm writes. Its `settings` are never overwritten once taken (an already-armed file
 * is not the thing to restore); with no backup at all, an armed file is restored to its disarmed
 * self. `armedAt` is always now: arming again restarts the clock.
 */
export function backupForArm(current: Settings, stored: unknown, now: Date): Backup {
  const settings = stored ? parseBackup(stored, now).backup.settings : isArmed(current) ? disarm(current) : current;
  return { armedAt: now.toISOString(), settings };
}

export function expiryLine(backup: Backup): string {
  return `redeye: expired (armed ${backup.armedAt}, over 24 h ago). This session still started in bypass mode, ` +
    "but the Redeye protocol is off and the next session prompts again. Re-arm with `deno task redeye`.";
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

async function writeJson(path: string, value: unknown): Promise<void> {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, JSON.stringify(value, null, 2) + "\n");
}

function inCloud(get = Deno.env.get): boolean {
  const declared = get("MESITA_PLATFORM")?.trim() ?? "";
  if (declared.endsWith("-cloud")) return true;
  return get("CLAUDE_CODE_REMOTE") === "true";
}

async function main(): Promise<void> {
  const mode = parseMode(Deno.args);
  if (mode === null) {
    console.error(`redeye: unknown arguments ${JSON.stringify(Deno.args)}; nothing changed. ${USAGE}`);
    Deno.exit(2);
  }

  if (mode === "match") {
    const result = matchPayload(await new Response(Deno.stdin.readable).text());
    if (result === "error") {
      console.error("redeye: the hook payload on stdin is not JSON");
      Deno.exit(3);
    }
    Deno.exit(result === "arm" ? 0 : 10);
  }

  const now = new Date();
  const current = (await readJson(SETTINGS)) ?? {};
  const stored = await readJson(BACKUP);

  if (mode === "status") {
    if (!isArmed(current)) {
      console.log("redeye: off");
      Deno.exit(1);
    }
    const parsed = stored ? parseBackup(stored, now) : null;
    if (parsed && !parsed.migrated) {
      const expires = new Date(Date.parse(parsed.backup.armedAt) + ARMING_TTL_MS).toISOString();
      console.log(`redeye: ARMED since ${parsed.backup.armedAt}, expires ${expires} — prompts are off in this checkout`);
    } else {
      console.log("redeye: ARMED — prompts are off in this checkout; the next session start stamps when");
    }
    Deno.exit(0);
  }

  if (mode === "off") {
    if (stored) {
      await writeJson(SETTINGS, parseBackup(stored, now).backup.settings);
      await Deno.remove(BACKUP);
      console.log("redeye: off — .claude/settings.local.json restored from the backup taken when it was armed");
    } else {
      await writeJson(SETTINGS, disarm(current));
      console.log("redeye: off — no backup to restore, so the bypass key was dropped and the rest left alone");
    }
    Deno.exit(0);
  }

  // The SessionStart hook calls this on every session, everywhere. On a laptop it never arms;
  // its one job is the clock, and declining is the normal outcome, not a failure.
  if (mode === "auto" && !inCloud()) {
    if (!isArmed(current)) Deno.exit(0);
    const { backup, migrated } = stored
      ? parseBackup(stored, now)
      : { backup: backupForArm(current, null, now), migrated: true };
    if (migrated) {
      await writeJson(BACKUP, backup);
    } else if (isExpired(backup, now)) {
      await writeJson(SETTINGS, backup.settings);
      await Deno.remove(BACKUP);
      console.log(expiryLine(backup));
    }
    Deno.exit(0);
  }

  await writeJson(BACKUP, backupForArm(current, stored, now));
  if (isArmed(current)) {
    console.log("redeye: already armed — the 24 h clock restarts now");
  } else {
    await writeJson(SETTINGS, arm(current));
    console.log("redeye: prompts off for 24 h — .claude/settings.local.json grants bypassPermissions (gitignored, this checkout only)");
    console.log("redeye: `deno task redeye --off` puts them back exactly as they were");
  }

  const note = platformNote(Deno.env.get("MESITA_PLATFORM") ?? "");
  if (note) console.log(`redeye: ${note}`);

  console.log();
  console.log(await Deno.readTextFile(CARD));
}

if (import.meta.main) await main();
