// redeye.test.ts — the arming logic, which edits the file holding Pato's permission allow list.
//
// The failure that matters here is silent: an arm that drops the allow list leaves an agent
// MORE prompted than before, and nothing reports it because the file is gitignored and the
// session simply starts asking again. So every case asserts what survives, not just what changed.
//
// Run: deno task test:redeye   (CI: .github/workflows/rules.yml)

import { assert, assertEquals } from "@std/assert";

import { arm, BYPASS, disarm, isArmed, platformNote, type Settings } from "./redeye.ts";

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
  assert(platformNote("codex")?.includes("approval"));
  assert(platformNote("codex-cloud")?.includes("approval"));
  // Claude Code's prompts ARE turned off by this script, so it has nothing left to say.
  assertEquals(platformNote("claude-code"), null);
  assertEquals(platformNote("claude-code-cloud"), null);
  assertEquals(platformNote(""), null);
});
