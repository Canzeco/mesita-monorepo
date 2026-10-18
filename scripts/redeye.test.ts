// redeye.test.ts — the arming logic, which edits the file holding Pato's permission allow list.
//
// The failure that matters here is silent: an arm that drops the allow list leaves an agent
// MORE prompted than before, and nothing reports it because the file is gitignored and the
// session simply starts asking again. So every case asserts what survives, not just what changed.
//
// Run: deno task test:redeye   (CI: .github/workflows/rules.yml)

import { assert, assertEquals } from "@std/assert";

import {
  arm,
  ARMING_TTL_MS,
  backupForArm,
  BYPASS,
  disarm,
  expiryLine,
  isArmed,
  isExpired,
  matchPayload,
  parseBackup,
  parseMode,
  platformNote,
  promptActivates,
  type Settings,
} from "./redeye.ts";

Deno.test("arming an empty file sets the one key", () => {
  assertEquals(arm({}), { permissions: { defaultMode: BYPASS } });
});

Deno.test("arming carries every other key through", () => {
  const before: Settings = {
    $schema: "https://json.schemastore.org/claude-code-settings.json",
    permissions: { allow: ["Bash(git status*)", "Bash(gh pr *)"], deny: ["Bash(rm -rf *)"] },
    env: { FOO: "1" },
  };
  const after = arm(before);
  assertEquals(after.permissions?.allow, before.permissions?.allow);
  assertEquals(after.permissions?.deny, before.permissions?.deny);
  assertEquals(after.env, before.env);
  assertEquals(after.$schema, before.$schema);
  assert(isArmed(after));
  // And the input is untouched: main() writes the backup from it after arm() has run.
  assertEquals(before.permissions?.defaultMode, undefined);
});

Deno.test("arming twice is the same file", () => {
  const once = arm({ permissions: { allow: ["Bash(git status*)"] } });
  assertEquals(arm(once), once);
});

Deno.test("arming preserves a mode the user chose, by backing it up rather than merging it", () => {
  // arm() cannot preserve defaultMode — it is the key being set. That is exactly why main()
  // writes a backup before calling it, and why --off restores the file instead of calling disarm.
  const before: Settings = { permissions: { defaultMode: "acceptEdits", allow: ["Bash(ls)"] } };
  assertEquals(arm(before).permissions?.defaultMode, BYPASS);
  assertEquals(arm(before).permissions?.allow, ["Bash(ls)"]);
});

Deno.test("disarming drops the bypass and keeps the allow list", () => {
  const after = disarm({ permissions: { defaultMode: BYPASS, allow: ["Bash(git status*)"] } });
  assertEquals(after, { permissions: { allow: ["Bash(git status*)"] } });
  assert(!isArmed(after));
});

Deno.test("disarming a file whose permissions held nothing else removes the empty object", () => {
  assertEquals(disarm({ permissions: { defaultMode: BYPASS } }), {});
  assertEquals(disarm({ env: { FOO: "1" }, permissions: { defaultMode: BYPASS } }), { env: { FOO: "1" } });
});

Deno.test("disarming a file that was never armed changes nothing that matters", () => {
  const before: Settings = { permissions: { allow: ["Bash(ls)"] } };
  assertEquals(disarm(before), before);
  assertEquals(disarm({}), {});
});

Deno.test("isArmed is exact: another mode is not armed", () => {
  assert(!isArmed({}));
  assert(!isArmed({ permissions: {} }));
  assert(!isArmed({ permissions: { defaultMode: "acceptEdits" } }));
  assert(isArmed({ permissions: { defaultMode: BYPASS } }));
});

Deno.test("a platform whose approvals live outside the repo gets a line, and the rest get silence", () => {
  assert(platformNote("cursor")?.includes("Auto-Run"));
  // The cloud token is the same platform: the note must survive the suffix.
  assert(platformNote("cursor-cloud")?.includes("Auto-Run"));
  // The profile the note names is the one .codex/config.toml defines.
  assert(platformNote("codex")?.includes("codex --profile redeye"));
  assert(platformNote("codex-cloud")?.includes("codex --profile redeye"));
  // Claude Code's prompts ARE turned off by this script, so it has nothing left to say.
  assertEquals(platformNote("claude-code"), null);
  assertEquals(platformNote("claude-code-cloud"), null);
  assertEquals(platformNote(""), null);
});

// ── The phrase: only Pato's own opening line arms ───────────────────────────

const payload = (prompt: unknown) => JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt });

Deno.test("the bare phrase arms, in any case", () => {
  assert(promptActivates("activate Redeye"));
  assert(promptActivates("ACTIVATE REDEYE"));
  assertEquals(matchPayload(payload("activate redeye")), "arm");
});

Deno.test("the phrase followed by instructions arms, and so does a blank first line", () => {
  assert(promptActivates("activate Redeye\nthen take MESITA-2400"));
  assert(promptActivates("activate Redeye. Start with the CI lane."));
  assert(promptActivates("\n   activate Redeye"));
});

Deno.test("a task notification that quotes the phrase does not arm", () => {
  // The 2026-10-18 misfire: a subagent report describing this bug reached the hook as a user turn.
  const notification = "<task-notification>\n<summary>Agent finished</summary>\n<result>The hook matches " +
    "`activate redeye` anywhere in the raw prompt JSON.</result>\n</task-notification>";
  assertEquals(matchPayload(payload(notification)), "no");
});

Deno.test("quoted law text and questions about Redeye do not arm", () => {
  assertEquals(matchPayload(payload("When Pato writes `activate Redeye`, read scripts/redeye.md")), "no");
  assertEquals(matchPayload(payload("what does activate Redeye do?")), "no");
  assertEquals(matchPayload(payload("> activate Redeye")), "no");
  assertEquals(matchPayload(payload("activate redeyes")), "no");
});

Deno.test("a payload without a prompt string is no match, and unparseable input is an error", () => {
  assertEquals(matchPayload(JSON.stringify({ hook_event_name: "UserPromptSubmit" })), "no");
  assertEquals(matchPayload(payload(42)), "no");
  assertEquals(matchPayload("null"), "no");
  assertEquals(matchPayload("not json"), "error");
});

// ── Arguments: a typo never arms ────────────────────────────────────────────

Deno.test("no argument arms and each known flag picks its mode", () => {
  assertEquals(parseMode([]), "arm");
  assertEquals(parseMode(["--off"]), "off");
  assertEquals(parseMode(["--status"]), "status");
  assertEquals(parseMode(["--auto"]), "auto");
  assertEquals(parseMode(["--match"]), "match");
});

Deno.test("an unknown or extra argument is rejected instead of arming", () => {
  assertEquals(parseMode(["off"]), null);
  assertEquals(parseMode(["--of"]), null);
  assertEquals(parseMode(["--off", "--status"]), null);
});

// ── The backup and its 24 h clock ───────────────────────────────────────────

const NOW = new Date("2026-10-19T12:00:00.000Z");
const ALLOW: Settings = { permissions: { allow: ["Bash(git status*)"] } };

Deno.test("--off restores the settings only: no armedAt leaks into settings.local.json", () => {
  const backup = backupForArm(ALLOW, null, NOW);
  const restored = parseBackup(JSON.parse(JSON.stringify(backup)), NOW).backup.settings;
  assertEquals(restored, ALLOW);
  assert(!("armedAt" in restored));
});

Deno.test("arming again restarts the clock and keeps the settings taken the first time", () => {
  const first = backupForArm(ALLOW, null, new Date("2026-10-18T00:00:00.000Z"));
  const again = backupForArm(arm(ALLOW), first, NOW);
  assertEquals(again.armedAt, NOW.toISOString());
  assertEquals(again.settings, ALLOW);
});

Deno.test("an armed file with no backup is restored to its disarmed self", () => {
  assertEquals(backupForArm(arm(ALLOW), null, NOW).settings, ALLOW);
});

Deno.test("a backup from before the clock existed is migrated, stamped now", () => {
  const { backup, migrated } = parseBackup(ALLOW, NOW);
  assert(migrated);
  assertEquals(backup, { armedAt: NOW.toISOString(), settings: ALLOW });
  const stampless = parseBackup({ armedAt: "not a date", settings: ALLOW }, NOW);
  assert(stampless.migrated);
  assertEquals(stampless.backup.settings, ALLOW);
});

Deno.test("an arming expires only after 24 hours", () => {
  const at = (ms: number) => ({ armedAt: new Date(NOW.getTime() - ms).toISOString(), settings: ALLOW });
  assert(!isExpired(at(ARMING_TTL_MS - 60_000), NOW));
  assert(isExpired(at(ARMING_TTL_MS + 60_000), NOW));
});

Deno.test("the expiry line says this session started armed and the next one prompts", () => {
  const line = expiryLine({ armedAt: "2026-10-18T00:00:00.000Z", settings: ALLOW });
  assert(line.includes("2026-10-18T00:00:00.000Z"));
  assert(line.includes("next session prompts again"));
  assert(line.includes("deno task redeye"));
});
