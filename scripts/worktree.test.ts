// Tests for scripts/worktree.ts on a throwaway git repo with a fake gh.
// Every path goes through Deno.realPath on both sides (macOS: /var vs /private/var).
//
// The fixture deliberately does NOT enable extensions.worktreeConfig: a real clone never has
// it either, and the script must turn it on itself before the first `git config --worktree`.
// Fixture commits pass --no-verify because `add` installs the pre-commit gate, and only the
// tests about the gate want to meet it. The suite must pass with CLAUDE_CODE_REMOTE both set and
// unset in the parent environment (a cloud session runs it too): mode is always passed explicitly.

import { assert, assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  add,
  boot,
  classifyLanded,
  type Cloud,
  cloudFromEnv,
  composeClaim,
  decide,
  decideRemote,
  declaredPlatform,
  defaultRunner,
  docsLineFrom,
  ensureWorktreeConfig,
  type Env,
  type Exec,
  findWorkspace,
  FLEET_DIR,
  fleetDirOf,
  GhError,
  hostHash,
  isClean,
  isCloudPlatform,
  leave,
  lockReason,
  parseClaim,
  parseLock,
  parseOriginRefs,
  parseWorktreeList,
  pr,
  preflight,
  PREFLIGHT_SH,
  prefixFor,
  remove,
  repairLobby,
  showPath,
  sweep,
  validateId,
  validateSlug,
  withJoin,
  WtError,
} from "./worktree.ts";

// ── Fixture ─────────────────────────────────────────────────────────────────

type PrRow = { number: number; merged: boolean; headRefOid: string };

type Fixture = {
  tmp: string;
  main: string;
  originPath: string;
  prsByOid: Map<string, PrRow[]>;
  prsByHead: Map<string, { number: number; headRefOid: string }[]>;
  calls: string[][];
  ghOverride?: (args: string[]) => Exec | undefined;
};

async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await defaultRunner("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}

async function write(path: string, content: string) {
  await Deno.mkdir(join(path, ".."), { recursive: true });
  await Deno.writeTextFile(path, content);
}

async function commitFile(cwd: string, rel: string, content: string, msg: string): Promise<string> {
  await write(join(cwd, rel), content);
  await git(cwd, "add", rel);
  await git(cwd, "commit", "-q", "--no-verify", "-m", msg);
  return await git(cwd, "rev-parse", "HEAD");
}

/** A commit that MEETS the pre-commit gate: the exit code and stderr are the assertion. */
async function gatedCommit(cwd: string, rel: string, msg: string): Promise<Exec> {
  await write(join(cwd, rel), `${rel}\n`);
  await git(cwd, "add", rel);
  return await defaultRunner("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", msg], { cwd });
}

/** The Claude Code PreToolUse hook, fed the stdin contract the harness uses. */
async function claudeHook(input: Record<string, unknown>, env: Record<string, string> = {}): Promise<Exec> {
  const c = new Deno.Command("bash", { args: [PREFLIGHT_SH, "claude"], stdin: "piped", stdout: "piped", stderr: "piped", env });
  const child = c.spawn();
  const w = child.stdin.getWriter();
  await w.write(new TextEncoder().encode(JSON.stringify(input)));
  await w.close();
  const o = await child.output();
  const dec = new TextDecoder();
  return { code: o.code, stdout: dec.decode(o.stdout), stderr: dec.decode(o.stderr) };
}

async function makeFixture(): Promise<Fixture> {
  const tmp = await Deno.realPath(await Deno.makeTempDir({ prefix: "wt-test-" }));
  const originPath = join(tmp, "origin.git");
  await git(tmp, "init", "-q", "--bare", "-b", "main", originPath);
  const main = join(tmp, "main");
  await git(tmp, "init", "-q", "-b", "main", main);
  await write(join(main, ".gitignore"), ".env.local\n.claude/worktrees/\n");
  await write(join(main, ".worktreeinclude"), "apps/*/.env.local\n");
  await write(join(main, "apps/web/.env.local"), "SECRET=1\n");
  await write(join(main, "README"), "one\n");
  await git(main, "add", "-A");
  await git(main, "commit", "-q", "-m", "one");
  await git(main, "remote", "add", "origin", originPath);
  await git(main, "push", "-q", "-u", "origin", "main");
  return { tmp, main, originPath, prsByOid: new Map(), prsByHead: new Map(), calls: [] };
}

function makeEnv(f: Fixture, opts: { cwd?: string; now?: () => Date; host?: string; cloud?: Cloud } = {}): Env & { log: (l: string) => void; lines: string[] } {
  const lines: string[] = [];
  const runner = async (cmd: string, args: string[], o?: { cwd?: string }): Promise<Exec> => {
    if (cmd !== "gh") return await defaultRunner(cmd, args, o);
    f.calls.push(args);
    const over = f.ghOverride?.(args);
    if (over) return over;
    if (args[0] === "api" && args[1] === "graphql") {
      const oid = args.find((a) => a.startsWith("oid="))!.slice(4);
      const depth = Number(args.find((a) => a.startsWith("depth="))!.slice(6));
      const oids = (await git(f.main, "rev-list", "-n", String(depth), oid)).split("\n").filter(Boolean);
      const nodes = [];
      for (const o of oids) {
        const date = await git(f.main, "show", "-s", "--format=%cI", o);
        nodes.push({ oid: o, committedDate: date, associatedPullRequests: { nodes: f.prsByOid.get(o) ?? [] } });
      }
      return { code: 0, stdout: JSON.stringify({ data: { repository: { object: { history: { nodes } } } } }), stderr: "" };
    }
    if (args[0] === "pr" && args[1] === "list") {
      const head = args[args.indexOf("--head") + 1];
      const state = args[args.indexOf("--state") + 1];
      if (state === "merged") return { code: 0, stdout: JSON.stringify(f.prsByHead.get(head) ?? []), stderr: "" };
      return { code: 0, stdout: "[]", stderr: "" };
    }
    return { code: 0, stdout: "", stderr: "" };
  };
  return {
    runner,
    now: opts.now ?? (() => new Date()),
    host: opts.host ?? "t3st",
    cwd: opts.cwd ?? f.main,
    log: (l) => lines.push(l),
    lines,
    sleep: () => Promise.resolve(),
    cloud: opts.cloud ?? null,
    clipboard: false,
  };
}

/** A cloud session's clone: fresh, single worktree, on a harness-named branch, no extension, no fleet. */
async function makeClone(f: Fixture, branch = "claude/some-task-abc123"): Promise<string> {
  const clone = join(f.tmp, `clone-${Math.random().toString(36).slice(2, 8)}`);
  await git(f.tmp, "clone", "-q", f.originPath, clone);
  if (branch !== "main") await git(clone, "switch", "-q", "-c", branch);
  return await Deno.realPath(clone);
}

const CLOUD: Cloud = { platform: "claude-code-cloud", session: "cse_01TEST" };

/** A worktree with one commit on a branch, made through git directly (the harness way). */
async function rawWorktree(f: Fixture, name: string, branch: string, opts: { commit?: boolean } = { commit: true }): Promise<{ path: string; tip: string }> {
  const path = join(fleetDirOf(f.main), name);
  await git(f.main, "worktree", "add", "-q", path, "-b", branch, "origin/main");
  let tip = await git(path, "rev-parse", "HEAD");
  if (opts.commit) tip = await commitFile(path, `${name}.txt`, `${name}\n`, `${name} work`);
  return { path: await Deno.realPath(path), tip };
}

const later = (hours: number) => () => new Date(Date.now() + hours * 3_600_000);

// ── Pure parsing and validation ─────────────────────────────────────────────

Deno.test("parseWorktreeList reads -z entries with locks, prunable and detached", () => {
  const z = ["worktree /r", "HEAD aaa", "branch refs/heads/main", "", "worktree /r/w1", "HEAD bbb", "branch refs/heads/x", "locked mesita claim=MESITA-1 since=2026-09-06T00:00:00Z", "", "worktree /r/w2", "HEAD ccc", "detached", "prunable gitdir file points to non-existent location", "", ""].join("\0");
  const rows = parseWorktreeList(z);
  assertEquals(rows.length, 3);
  assertEquals(rows[0].branch, "main");
  assertEquals(rows[1].locked, true);
  assertEquals(parseLock(rows[1].lockReason), { ours: true, issue: "MESITA-1", since: new Date("2026-09-06T00:00:00Z") });
  assertEquals(rows[2].branch, null);
  assertEquals(rows[2].prunable, true);
  assertEquals(parseLock("EnterWorktree session"), { ours: false, issue: null, since: null });
});

Deno.test("ids and slugs are validated before any git call, in the house error style", () => {
  assertEquals(validateId("MESITA-1566"), "MESITA-1566");
  const e = (() => {
    try {
      validateId("mesita-1");
    } catch (x) {
      return x as WtError;
    }
  })();
  assert(e instanceof WtError);
  assertStringIncludes(e.message, "INVALID ID: mesita-1 — ");
  assertStringIncludes(e.message, " (I-3)");
  assertEquals(validateSlug("rules-v7-mechanisms"), "rules-v7-mechanisms");
  for (const bad of ["Rules", "a--b", "-a", "a".repeat(41)]) {
    let threw = false;
    try {
      validateSlug(bad);
    } catch {
      threw = true;
    }
    assert(threw, bad);
  }
});

Deno.test("claim line round-trips through the key=value grammar", () => {
  const c = { platform: "claude-code", host: "5a4b", branch: "claude/MESITA-1566-x", worktree: ".claude/worktrees/MESITA-1566-x", footprint: "scripts/,deno.json" };
  const line = composeClaim(c);
  assertEquals(line, "claimed platform=claude-code host=5a4b branch=claude/MESITA-1566-x worktree=.claude/worktrees/MESITA-1566-x footprint=scripts/,deno.json");
  assertEquals(parseClaim(line), c);
  assertEquals(parseClaim("claimed: claude-code-desktop:slug · branch:claude/x"), null);
  assertEquals(parseClaim(composeClaim({ ...c, footprint: "" }))?.footprint, "none");
});

Deno.test("decide keeps the shared checkout, the cwd, active, locked, unclean and unlanded workspaces", () => {
  const now = new Date("2026-09-06T12:00:00Z");
  const row = { path: "/r/.claude/worktrees/a", head: "x", branch: "b", bare: false, locked: false, lockReason: "", prunable: false, prunableReason: "" };
  const base = { row, issue: null, host: null, landed: { kind: "exact" as const, pr: 1 }, clean: true, activity: new Date("2026-09-04T00:00:00Z"), lock: parseLock("") };
  const ctx = { cwd: "/r", main: "/r", now };
  assertEquals(decide(base, ctx).decision, "remove");
  assertEquals(decide({ ...base, row: { ...row, path: "/r" } }, ctx).reason, "shared checkout");
  assertEquals(decide(base, { ...ctx, cwd: "/r/.claude/worktrees/a/sub" }).reason, "own cwd");
  assertEquals(decide({ ...base, activity: new Date("2026-09-06T11:00:00Z") }, ctx).reason, "active within 24h");
  assertEquals(decide({ ...base, row: { ...row, locked: true, lockReason: "EnterWorktree" }, lock: parseLock("EnterWorktree") }, ctx).reason, "locked (not ours)");
  const fresh = lockReason("MESITA-1", new Date("2026-09-06T11:30:00Z"));
  assertEquals(decide({ ...base, row: { ...row, locked: true, lockReason: fresh }, lock: parseLock(fresh) }, ctx).reason, "locked (ours, within lease)");
  const old = lockReason("MESITA-1", new Date("2026-09-01T00:00:00Z"));
  assertEquals(decide({ ...base, row: { ...row, locked: true, lockReason: old }, lock: parseLock(old) }, ctx).decision, "remove");
  assertEquals(decide({ ...base, clean: false }, ctx).reason, "unclean");
  assertEquals(decide({ ...base, landed: { kind: "unlanded" } }, ctx).reason, "unlanded");
  assertEquals(decide({ ...base, landed: { kind: "ahead", pr: 1, by: 1 } }, ctx).reason, "residue (ahead of its merged PR)");
  assertEquals(decide({ ...base, landed: null }, ctx).reason, "landed unknown");
});

// ── add (ISOLATE) ───────────────────────────────────────────────────────────

Deno.test("add creates a claimed, seeded, locked workspace under the main worktree and prints the claim", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  assertEquals((await defaultRunner("git", ["config", "--get", "extensions.worktreeConfig"], { cwd: f.main })).code, 1, "a real clone starts without the extension");
  const out = await add(env, { id: "MESITA-7", slug: "seven", footprint: "scripts/" });
  assertEquals(await git(f.main, "config", "--get", "extensions.worktreeConfig"), "true", "add turns the extension on, or the claim step is fatal");
  const path = join(fleetDirOf(f.main), "MESITA-7-seven");
  assertEquals(await git(path, "rev-parse", "--abbrev-ref", "HEAD"), "claude/MESITA-7-seven");
  assertEquals(await Deno.readTextFile(join(path, "apps/web/.env.local")), "SECRET=1\n");
  assertEquals(await git(path, "config", "--worktree", "--get", "mesita.issue"), "MESITA-7");
  assertEquals(await git(path, "config", "--worktree", "--get", "mesita.host"), "t3st");
  const list = parseWorktreeList(await git(f.main, "worktree", "list", "--porcelain", "-z"));
  const row = list.find((r) => r.path.endsWith("MESITA-7-seven"))!;
  assert(row.locked && parseLock(row.lockReason).ours);
  const text = out.join("\n");
  assertStringIncludes(text, "claimed platform=claude-code host=t3st branch=claude/MESITA-7-seven worktree=worktrees/MESITA-7-seven footprint=scripts/");
  assertStringIncludes(text, "seeded 1 file(s)");
  assertStringIncludes(text, "ok: workspace", "the claim is verified through the gate (I-9)");
  assertStringIncludes(text, "Cursor: open that worktree; Codex: cd", "the enter step names every platform, not only EnterWorktree");
  await assertRejects(() => add(env, { id: "bad" }), WtError, "INVALID ID");
  // Any well-formed token is a platform now (agent/ prefix); only an ill-formed one is refused.
  await assertRejects(() => add(env, { id: "MESITA-8", platform: "VIM!" }), WtError, "INVALID PLATFORM");
});

Deno.test("ensureWorktreeConfig is idempotent and carries core.worktree into the main worktree's own file", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  await git(f.main, "config", "core.worktree", f.main);
  assertEquals(await ensureWorktreeConfig(env, f.main), true);
  assertEquals(await ensureWorktreeConfig(env, f.main), false);
  assertEquals(await git(f.main, "config", "--get", "extensions.worktreeConfig"), "true");
  assertEquals((await defaultRunner("git", ["config", "--local", "--get", "core.worktree"], { cwd: f.main })).code, 1, "moved out of the shared file");
  assertEquals(await git(f.main, "config", "--worktree", "--get", "core.worktree"), f.main);
});

Deno.test("add resumes the live workspace an issue already has, under any slug, and never doubles it", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  await add(env, { id: "MESITA-7", slug: "seven", footprint: "apps/web/" });
  const again = (await add(env, { id: "MESITA-7", slug: "other" })).join("\n");
  assertStringIncludes(again, "resumed worktrees/MESITA-7-seven on claude/MESITA-7-seven: MESITA-7 already has this workspace");
  assertStringIncludes(again, "claimed platform=claude-code host=t3st branch=claude/MESITA-7-seven worktree=worktrees/MESITA-7-seven footprint=apps/web/", "a resume keeps the claim's footprint");
  const rows = parseWorktreeList(await git(f.main, "worktree", "list", "--porcelain", "-z"));
  assertEquals(rows.filter((r) => r.branch?.includes("MESITA-7")).length, 1, "one workspace per issue");
  assertEquals((await defaultRunner("git", ["rev-parse", "--verify", "--quiet", "refs/heads/claude/MESITA-7-other"], { cwd: f.main })).code, 1, "no second branch");
  const lane = await rawWorktree(f, "lane", "claude/lane", { commit: false });
  await assertRejects(() => add(env, { id: "MESITA-7", adopt: lane.path }), WtError, "CLAIMED");
  assertEquals((await defaultRunner("git", ["config", "--worktree", "--get", "mesita.issue"], { cwd: lane.path })).code, 1, "the second path stays unclaimed");
  const found = await findWorkspace(env, f.main, rows, "MESITA-7");
  assert(found?.path.endsWith("MESITA-7-seven"));
});

Deno.test("add re-attaches a loose branch that carries the id instead of cutting a second one", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  const old = await rawWorktree(f, "old", "claude/MESITA-8-old");
  await git(f.main, "worktree", "remove", old.path);
  const out = (await add(env, { id: "MESITA-8", slug: "new" })).join("\n");
  assertStringIncludes(out, "re-attached branch claude/MESITA-8-old at worktrees/MESITA-8-new");
  assertStringIncludes(out, "branch=claude/MESITA-8-old worktree=worktrees/MESITA-8-new");
  const path = join(fleetDirOf(f.main), "MESITA-8-new");
  assertEquals(await git(path, "rev-parse", "HEAD"), old.tip, "the branch and its commits came back");
  assertEquals(await git(path, "config", "--worktree", "--get", "mesita.issue"), "MESITA-8");
  assertEquals((await defaultRunner("git", ["rev-parse", "--verify", "--quiet", "refs/heads/claude/MESITA-8-new"], { cwd: f.main })).code, 1);
});

Deno.test("adopt takes any registered worktree (Cursor worktree mode lives outside the fleet dir), never the shared checkout", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  const cursorPath = join(f.tmp, "cursor-lane");
  await git(f.main, "worktree", "add", "-q", cursorPath, "-b", "cursor/lane", "origin/main");
  const out = (await add(env, { id: "MESITA-12", adopt: cursorPath, platform: "cursor" })).join("\n");
  assertStringIncludes(out, "renamed branch cursor/lane → cursor/MESITA-12-lane");
  // Outside the fleet dir the claim and the enter line print the absolute path, never ../cursor-lane.
  assertStringIncludes(out, `claimed platform=cursor host=t3st branch=cursor/MESITA-12-lane worktree=${cursorPath}`);
  assertStringIncludes(out, `next: enter ${cursorPath} (`);
  assertEquals(await git(cursorPath, "config", "--worktree", "--get", "mesita.issue"), "MESITA-12");
  assertEquals(await Deno.readTextFile(join(cursorPath, "apps/web/.env.local")), "SECRET=1\n", "seeded from .worktreeinclude like any workspace");
  await assertRejects(() => add(env, { id: "MESITA-13", adopt: f.main }), WtError, "NOT ADOPTABLE");
  await assertRejects(() => add(env, { id: "MESITA-13", adopt: join(f.tmp, "nowhere") }), WtError, "NOT ADOPTABLE");
});

Deno.test("add anchors on the main worktree even when run from a linked worktree, and adopts an unclaimed one", async () => {
  const f = await makeFixture();
  const w = await rawWorktree(f, "lane", "claude/lane", { commit: false });
  const env = makeEnv(f, { cwd: w.path });
  await add(env, { id: "MESITA-9", slug: "nine" });
  const rows = parseWorktreeList(await git(f.main, "worktree", "list", "--porcelain", "-z"));
  assert(rows.some((r) => r.path.endsWith(join(FLEET_DIR, "MESITA-9-nine"))));
  assert(!rows.some((r) => r.path.includes("lane/.claude")));
  const adopted = await add(env, { id: "MESITA-10", adopt: w.path });
  assertStringIncludes(adopted.join("\n"), "renamed branch claude/lane → claude/MESITA-10-lane");
  assertStringIncludes(adopted.join("\n"), "branch=claude/MESITA-10-lane worktree=worktrees/lane");
  assertEquals(await git(w.path, "config", "--worktree", "--get", "mesita.issue"), "MESITA-10");
  await assertRejects(() => add(env, { id: "MESITA-11", adopt: w.path }), WtError, "NOT A LOBBY");
  await assertRejects(() => add(env, { id: "MESITA-11", adopt: f.main }), WtError, "NOT ADOPTABLE");
  // The main worktree never claims locally, whatever branch someone parked it on.
  await git(f.main, "switch", "-q", "-c", "pato/MESITA-11-by-hand");
  await assertRejects(() => add(env, { id: "MESITA-11", adopt: f.main }), WtError, "NOT ADOPTABLE");
  await git(f.main, "switch", "-q", "main");
});

// ── cloud: the clone is the workspace ───────────────────────────────────────

Deno.test("cloud: boot reads the clone instead of repairing it, add --adopt . claims the clone itself, a second issue is refused, resume finds it", async () => {
  const f = await makeFixture();
  const clone = await makeClone(f);
  const env = makeEnv(f, { cwd: clone, cloud: CLOUD });
  const before = (await boot(env)).join("\n");
  assertStringIncludes(before, "where: cloud clone on claude/some-task-abc123 with no claim");
  assertStringIncludes(before, "fleet: none here");
  assertStringIncludes(before, "preflight: UNCLAIMED CLONE");
  const out = (await add(env, { id: "MESITA-30", slug: "audit", adopt: ".", footprint: "scripts/" })).join("\n");
  assertStringIncludes(out, "renamed branch claude/some-task-abc123 → claude/MESITA-30-audit");
  assertStringIncludes(out, "claimed platform=claude-code-cloud host=t3st branch=claude/MESITA-30-audit worktree=cloud:cse_01TEST footprint=scripts/");
  assertStringIncludes(out, "ok: cloud clone");
  assertStringIncludes(out, "this clone is the workspace");
  assert(!out.includes("EnterWorktree"), "no nested worktree in the cloud");
  assertEquals(await git(clone, "config", "--worktree", "--get", "mesita.issue"), "MESITA-30");
  assertEquals(await git(clone, "config", "--worktree", "--get", "mesita.session"), "cse_01TEST");
  assertEquals(parseWorktreeList(await git(clone, "worktree", "list", "--porcelain", "-z")).length, 1, "the clone stays a single worktree");
  const after = (await boot(env)).join("\n");
  assertStringIncludes(after, "claimed by MESITA-30 (session cse_01TEST): resume it");
  await assertRejects(() => add(env, { id: "MESITA-31", slug: "second", adopt: "." }), WtError, "NOT A LOBBY");
  assertEquals(await git(clone, "config", "--worktree", "--get", "mesita.issue"), "MESITA-30", "the second issue changed nothing");
  const resumed = (await add(env, { id: "MESITA-30", slug: "whatever" })).join("\n");
  assertStringIncludes(resumed, "resumed . on claude/MESITA-30-audit: MESITA-30 already has this workspace");
  await assertRejects(() => repairLobby(env, clone, { apply: true }), WtError, "NO LOBBY");
  await assertRejects(() => sweep(env, { apply: false }), WtError, "NO LOBBY");
});

Deno.test("cloud: a harness branch that already names the issue is kept; a clone on main is the shared checkout; local sessions never claim the main worktree", async () => {
  const f = await makeFixture();
  const named = await makeClone(f, "claude/MESITA-40-from-the-title-1a2b3c");
  const env = makeEnv(f, { cwd: named, cloud: { platform: "claude-code-cloud", session: null } });
  const out = (await add(env, { id: "MESITA-40", adopt: "." })).join("\n");
  assert(!out.includes("renamed branch"), "the id is already in the name");
  assertStringIncludes(out, "branch=claude/MESITA-40-from-the-title-1a2b3c worktree=cloud:clone");
  const onMain = await makeClone(f, "main");
  await assertRejects(() => add(makeEnv(f, { cwd: onMain, cloud: CLOUD }), { id: "MESITA-41", adopt: "." }), WtError, "NOT ADOPTABLE");
  const local = await makeClone(f, "claude/hand-made");
  await assertRejects(() => add(makeEnv(f, { cwd: local }), { id: "MESITA-42", adopt: "." }), WtError, "NOT ADOPTABLE");
  assertEquals(cloudFromEnv((k) => ({ CLAUDE_CODE_REMOTE: "true", CLAUDE_CODE_REMOTE_SESSION_ID: "cse_9" })[k]), { platform: "claude-code-cloud", session: "cse_9" });
  assertEquals(cloudFromEnv(() => undefined), null);
  assert(isCloudPlatform("cursor-cloud") && !isCloudPlatform("cursor"));
});

// ── the write gate (scripts/preflight.sh) ───────────────────────────────────

Deno.test("preflight refuses the shared checkout and an unclaimed worktree, passes a claimed one, and catches a branch switch inside it", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  const shared = await preflight(env, f.main);
  assert(!shared.ok);
  assertStringIncludes(shared.line, "SHARED CHECKOUT");
  assertStringIncludes(shared.line, "non-code work needs no workspace");
  const lane = await rawWorktree(f, "launch", "claude/launch-1a2b3c", { commit: false });
  const unclaimed = await preflight(env, lane.path);
  assert(!unclaimed.ok);
  assertStringIncludes(unclaimed.line, `UNCLAIMED WORKTREE: ${lane.path} on claude/launch-1a2b3c`);
  assertStringIncludes(unclaimed.line, `--adopt ${lane.path}`);
  await add(env, { id: "MESITA-50", adopt: lane.path });
  const claimed = await preflight(env, join(lane.path, "apps", "not-yet-there.ts"));
  assert(claimed.ok, claimed.line);
  assertStringIncludes(claimed.line, `ok: workspace ${lane.path} claimed by MESITA-50 on claude/MESITA-50-launch-1a2b3c`);
  await git(lane.path, "switch", "-q", "-c", "claude/MESITA-51-second");
  const switched = await preflight(env, lane.path);
  assert(!switched.ok);
  assertStringIncludes(switched.line, "CLAIM MISMATCH");
  assertStringIncludes(switched.line, "claimed by MESITA-50 but sits on claude/MESITA-51-second");
  const outside = await preflight(env, f.tmp);
  assert(outside.ok && outside.line.includes("outside any git checkout"));
});

Deno.test("the pre-commit hook add installs refuses a commit in the shared checkout and lets the claimed workspace commit", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  await add(env, { id: "MESITA-60", slug: "sixty" });
  const hook = await Deno.readTextFile(join(f.main, ".git", "hooks", "pre-commit"));
  assertStringIncludes(hook, "mesita preflight");
  const lobby = await gatedCommit(f.main, "lobby.txt", "work in the lobby");
  assertEquals(lobby.code, 1);
  assertStringIncludes(lobby.stderr, "PREFLIGHT REFUSED commit");
  assertStringIncludes(lobby.stderr, "SHARED CHECKOUT");
  await git(f.main, "reset", "-q");
  const ws = await gatedCommit(join(fleetDirOf(f.main), "MESITA-60-sixty"), "ok.txt", "work in the workspace");
  assertEquals(ws.code, 0, ws.stderr);
  const foreign = await rawWorktree(f, "foreign", "claude/foreign-9f9f9f", { commit: false });
  const unclaimed = await gatedCommit(foreign.path, "x.txt", "work in an unclaimed worktree");
  assertEquals(unclaimed.code, 1);
  assertStringIncludes(unclaimed.stderr, "UNCLAIMED WORKTREE");
});

Deno.test("the Claude Code hook refuses Edit/Write in the shared checkout and in an unclaimed worktree, allows a claimed workspace and paths outside the fleet", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  const refused = await claudeHook({ cwd: f.main, tool_name: "Edit", tool_input: { file_path: join(f.main, "CLAUDE.md") } });
  assertEquals(refused.code, 2, "exit 2 is the harness's unconditional refusal");
  assertStringIncludes(refused.stderr, "PREFLIGHT REFUSED Edit");
  assertStringIncludes(refused.stderr, "SHARED CHECKOUT");
  const lane = await rawWorktree(f, "lane", "claude/lane-abc", { commit: false });
  const unclaimed = await claudeHook({ cwd: lane.path, tool_name: "Write", tool_input: { file_path: "apps/new.ts" } });
  assertEquals(unclaimed.code, 2);
  assertStringIncludes(unclaimed.stderr, "UNCLAIMED WORKTREE");
  await add(env, { id: "MESITA-70", adopt: lane.path });
  const allowed = await claudeHook({ cwd: lane.path, tool_name: "Write", tool_input: { file_path: "apps/new.ts" } });
  assertEquals(allowed.code, 0, allowed.stderr);
  // A launch dir stays the project dir after EnterWorktree; cwd follows the worktree. An absolute path into the lobby is still the lobby.
  const escape = await claudeHook({ cwd: lane.path, tool_name: "Edit", tool_input: { file_path: join(f.main, "README") } }, { CLAUDE_PROJECT_DIR: f.main });
  assertEquals(escape.code, 2);
  const scratch = await claudeHook({ cwd: f.main, tool_name: "Write", tool_input: { file_path: join(f.tmp, "scratch", "notes.md") } });
  assertEquals(scratch.code, 0, "outside any git checkout is not a repository write");
  const other = join(f.tmp, "other-repo");
  await git(f.tmp, "init", "-q", other);
  const foreign = await claudeHook({ cwd: other, tool_name: "Write", tool_input: { file_path: join(other, "a.txt") } }, { CLAUDE_PROJECT_DIR: f.main });
  assertEquals(foreign.code, 0, "another repository is not this fleet's law");
  const notebook = await claudeHook({ cwd: f.main, tool_name: "NotebookEdit", tool_input: { notebook_path: join(f.main, "n.ipynb") } });
  assertEquals(notebook.code, 2);
});

Deno.test("the Claude Code hook on a cloud clone: refused until the clone is claimed, then allowed", async () => {
  const f = await makeFixture();
  const clone = await makeClone(f);
  const refused = await claudeHook({ cwd: clone, tool_name: "Write", tool_input: { file_path: join(clone, "x.ts") } }, { CLAUDE_CODE_REMOTE: "true" });
  assertEquals(refused.code, 2);
  assertStringIncludes(refused.stderr, "UNCLAIMED CLONE");
  assertStringIncludes(refused.stderr, "--adopt .");
  await add(makeEnv(f, { cwd: clone, cloud: CLOUD }), { id: "MESITA-80", slug: "cloud", adopt: "." });
  const allowed = await claudeHook({ cwd: clone, tool_name: "Write", tool_input: { file_path: join(clone, "x.ts") } }, { CLAUDE_CODE_REMOTE: "true" });
  assertEquals(allowed.code, 0, allowed.stderr);
});

// ── classifyLanded (I-10) ───────────────────────────────────────────────────

Deno.test("classifyLanded: on-main, exact, ahead, tree-equal, merge-tree and unlanded", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  const lane = await rawWorktree(f, "lane", "claude/lane", { commit: false });
  assertEquals((await classifyLanded(env, f.main, lane.tip, "claude/lane")).landed, { kind: "on-main" });

  const exact = await rawWorktree(f, "exact", "claude/exact");
  f.prsByOid.set(exact.tip, [{ number: 1, merged: true, headRefOid: exact.tip }]);
  assertEquals((await classifyLanded(env, f.main, exact.tip, "claude/exact")).landed, { kind: "exact", pr: 1 });

  const ahead = await rawWorktree(f, "ahead", "claude/ahead");
  f.prsByOid.set(ahead.tip, [{ number: 2, merged: true, headRefOid: ahead.tip }]);
  const aheadTip = await commitFile(ahead.path, "after.txt", "after\n", "after merge");
  assertEquals((await classifyLanded(env, f.main, aheadTip, "claude/ahead")).landed, { kind: "ahead", pr: 2, by: 1 });

  const amended = await rawWorktree(f, "amended", "claude/amended");
  const tree = await git(f.main, "rev-parse", `${amended.tip}^{tree}`);
  const parent = await git(f.main, "rev-parse", `${amended.tip}^`);
  const twin = await git(f.main, "commit-tree", tree, "-p", parent, "-m", "the pushed head, later amended locally");
  f.prsByHead.set("claude/amended", [{ number: 3, headRefOid: twin }]);
  assertEquals((await classifyLanded(env, f.main, amended.tip, "claude/amended")).landed, { kind: "tree", pr: 3 });

  const dup = await rawWorktree(f, "dup", "claude/dup");
  await commitFile(f.main, "dup.txt", "dup\n", "same change landed on main another way");
  await git(f.main, "push", "-q", "origin", "main");
  assertEquals((await classifyLanded(env, f.main, dup.tip, "claude/dup")).landed, { kind: "merge-tree" });

  const fresh = await rawWorktree(f, "fresh", "claude/fresh");
  assertEquals((await classifyLanded(env, f.main, fresh.tip, "claude/fresh")).landed, { kind: "unlanded" });
});

Deno.test("classifyLanded aborts on a gh failure instead of guessing", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  const w = await rawWorktree(f, "w", "claude/w");
  f.ghOverride = () => ({ code: 4, stdout: "", stderr: "gh: To authenticate, run gh auth login" });
  await assertRejects(() => classifyLanded(env, f.main, w.tip, "claude/w"), GhError, "GH FAILED");
});

// ── sweep ───────────────────────────────────────────────────────────────────

Deno.test("sweep dry-run changes nothing; --apply removes only landed, clean, inactive, unlocked workspaces and backs the branch up", async () => {
  const f = await makeFixture();
  const landed = await rawWorktree(f, "landed", "claude/landed");
  f.prsByOid.set(landed.tip, [{ number: 5, merged: true, headRefOid: landed.tip }]);
  const dirty = await rawWorktree(f, "dirty", "claude/dirty");
  f.prsByOid.set(dirty.tip, [{ number: 6, merged: true, headRefOid: dirty.tip }]);
  await write(join(dirty.path, "edit.txt"), "uncommitted\n");
  const locked = await rawWorktree(f, "locked", "claude/locked");
  f.prsByOid.set(locked.tip, [{ number: 7, merged: true, headRefOid: locked.tip }]);
  await git(f.main, "worktree", "lock", "--reason", "EnterWorktree session", locked.path);
  const unlanded = await rawWorktree(f, "unlanded", "claude/unlanded");

  const dry = await sweep(makeEnv(f, { now: later(48) }), { apply: false });
  assertStringIncludes(dry.lines.join("\n"), "would remove worktrees/landed");
  assertStringIncludes(dry.lines.join("\n"), "dry run: nothing changed");
  assert(await Deno.stat(landed.path));

  const active = await sweep(makeEnv(f), { apply: true });
  assertStringIncludes(active.lines.join("\n"), "active within 24h");
  assert(await Deno.stat(landed.path), "a workspace touched within 24h is never removed");

  const applied = await sweep(makeEnv(f, { now: later(48) }), { apply: true });
  const text = applied.lines.join("\n");
  assertStringIncludes(text, "removed worktrees/landed");
  assertStringIncludes(text, "deleted branch claude/landed (backup refs/swept/");
  await assertRejects(() => Deno.stat(landed.path));
  const swept = await git(f.main, "for-each-ref", "--format=%(refname)", "refs/swept/");
  assertStringIncludes(swept, "/claude/landed");
  assert(await Deno.stat(dirty.path), "dirty kept");
  assert(await Deno.stat(locked.path), "locked by someone else kept");
  assert(await Deno.stat(unlanded.path), "unlanded kept");
  assertStringIncludes(text, "keep: unclean");
  assertStringIncludes(text, "keep: locked (not ours)");
  assertStringIncludes(text, "keep: unlanded");
  const again = await sweep(makeEnv(f, { now: later(48) }), { apply: true });
  assert(!again.lines.join("\n").includes("removed .claude"), "second run is a no-op");
});

Deno.test("sweep deletes loose landed branches with a backup ref and keeps unlanded, ahead and backup/* branches", async () => {
  const f = await makeFixture();
  const landed = await rawWorktree(f, "l", "claude/loose-landed");
  f.prsByOid.set(landed.tip, [{ number: 9, merged: true, headRefOid: landed.tip }]);
  const open = await rawWorktree(f, "u", "claude/loose-unlanded");
  await git(f.main, "branch", "backup/keep-me", open.tip);
  for (const p of [landed.path, open.path]) await git(f.main, "worktree", "remove", p);
  const r = await sweep(makeEnv(f, { now: later(48) }), { apply: true });
  const text = r.lines.join("\n");
  assertStringIncludes(text, "claude/loose-landed | landed #9 | delete");
  assertStringIncludes(text, "claude/loose-unlanded | UNLANDED | keep");
  assertStringIncludes(text, "backup/keep-me | UNLANDED | keep");
  const heads = await git(f.main, "for-each-ref", "--format=%(refname:short)", "refs/heads/");
  assert(!heads.includes("claude/loose-landed"));
  assert(heads.includes("claude/loose-unlanded") && heads.includes("backup/keep-me"));
  assertStringIncludes(await git(f.main, "for-each-ref", "--format=%(refname)", "refs/swept/"), "/claude/loose-landed");
});

Deno.test("sweep never removes its own cwd, even through a symlink, and deletes nothing when gh fails", async () => {
  const f = await makeFixture();
  const w = await rawWorktree(f, "home", "claude/home");
  f.prsByOid.set(w.tip, [{ number: 8, merged: true, headRefOid: w.tip }]);
  const link = join(f.tmp, "link-to-home");
  await Deno.symlink(w.path, link);
  const viaLink = await sweep(makeEnv(f, { cwd: link, now: later(48) }), { apply: true });
  assertStringIncludes(viaLink.lines.join("\n"), "keep: own cwd");
  assert(await Deno.stat(w.path));
  f.ghOverride = () => ({ code: 1, stdout: "", stderr: "HTTP 403: rate limit exceeded" });
  await assertRejects(() => sweep(makeEnv(f, { now: later(48) }), { apply: true }), GhError);
  assert(await Deno.stat(w.path), "nothing deleted after a gh failure");
});

Deno.test("sweep refuses to prune when the repo looks moved, and prunes a single stale registration", async () => {
  const f = await makeFixture();
  const paths = [];
  for (const n of ["a", "b", "c", "d"]) paths.push((await rawWorktree(f, n, `claude/${n}`)).path);
  for (const p of paths) await Deno.remove(p, { recursive: true });
  await assertRejects(() => sweep(makeEnv(f, { now: later(48) }), { apply: true }), WtError, "REPO MOVED?");
  await git(f.main, "worktree", "prune");
  const one = await rawWorktree(f, "e", "claude/e");
  await Deno.remove(one.path, { recursive: true });
  const r = await sweep(makeEnv(f, { now: later(48) }), { apply: true });
  assertStringIncludes(r.lines.join("\n"), "pruned stale registration worktrees/e");
});

// ── remove (LEAVE) ──────────────────────────────────────────────────────────

Deno.test("remove refuses from inside the target, on ambiguity and on unlanded work; otherwise removes with a backup ref", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  await add(env, { id: "MESITA-20", slug: "twenty" });
  const path = join(fleetDirOf(f.main), "MESITA-20-twenty");
  const tip = await commitFile(path, "t.txt", "t\n", "twenty");
  await assertRejects(() => remove(makeEnv(f, { cwd: path }), "MESITA-20"), WtError, "INSIDE TARGET");
  await assertRejects(() => remove(env, "MESITA-20"), WtError, "UNLANDED");
  f.prsByOid.set(tip, [{ number: 20, merged: true, headRefOid: tip }]);
  const other = await rawWorktree(f, "other", "claude/other", { commit: false });
  await git(other.path, "config", "--worktree", "mesita.issue", "MESITA-20");
  await assertRejects(() => remove(env, "MESITA-20"), WtError, "AMBIGUOUS");
  await git(other.path, "config", "--worktree", "--unset", "mesita.issue");
  const out = await remove(env, "MESITA-20");
  assertStringIncludes(out.join("\n"), "removed worktrees/MESITA-20-twenty");
  assertStringIncludes(out.join("\n"), "deleted branch claude/MESITA-20-twenty (backup refs/swept/");
  assertEquals((await defaultRunner("git", ["rev-parse", "--verify", "--quiet", "refs/heads/claude/MESITA-20-twenty"], { cwd: f.main })).code, 1);
  await assertRejects(() => remove(env, "MESITA-21"), WtError, "NO ISSUE");
});

// ── repair-lobby (I-4) ──────────────────────────────────────────────────────

Deno.test("repair-lobby resets a stranded shared checkout, stashes edits, backs up own commits, refuses unknown trees, and is idempotent", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  assertStringIncludes((await repairLobby(env, f.main, { apply: true })).join("\n"), "holds no work of its own");
  const w = await rawWorktree(f, "pusher", "claude/pusher");
  await git(w.path, "push", "-q", "origin", "HEAD:main");
  await git(f.main, "fetch", "-q", "origin", "main");
  const newer = await git(f.main, "rev-parse", "origin/main");
  await git(f.main, "update-ref", "refs/heads/main", newer); // the harness's ref-only move
  const status = await git(f.main, "status", "--porcelain");
  assert(status.includes("pusher.txt"), "the index now shows the reverse of the newer merge");
  const dry = await repairLobby(env, f.main, { apply: false });
  assertStringIncludes(dry.join("\n"), "would reset");
  assert((await git(f.main, "status", "--porcelain")).includes("pusher.txt"), "dry run touched nothing");
  const fixed = await repairLobby(env, f.main, { apply: true });
  assertStringIncludes(fixed.join("\n"), "reset the shared checkout to origin/main");
  assertEquals(await git(f.main, "status", "--porcelain"), "");
  assertEquals(await git(f.main, "rev-parse", "HEAD"), newer);

  await Deno.writeTextFile(join(f.main, "README"), "edited\n");
  await git(f.main, "update-ref", "refs/heads/main", await git(f.main, "rev-parse", "HEAD~1"));
  const stashed = await repairLobby(env, f.main, { apply: true });
  assertStringIncludes(stashed.join("\n"), "LOBBY HAD EDITS: stashed as lobby-");
  assertStringIncludes(await git(f.main, "stash", "list"), "lobby-");
  assertEquals(await git(f.main, "rev-parse", "HEAD"), newer);

  await commitFile(f.main, "own.txt", "own\n", "a commit made in the shared checkout");
  const backed = await repairLobby(env, f.main, { apply: true });
  assertStringIncludes(backed.join("\n"), "LOBBY HAD COMMITS: 1 backed up on backup/lobby-");
  assertEquals(await git(f.main, "rev-parse", "HEAD"), newer);

  await write(join(f.main, "unknown.txt"), "x\n");
  await git(f.main, "add", "unknown.txt");
  await assertRejects(() => repairLobby(env, f.main, { apply: true }), WtError, "LOBBY UNKNOWN");
  assert((await git(f.main, "status", "--porcelain")).includes("unknown.txt"), "refused without touching anything");
  await git(f.main, "reset", "-q", "HEAD", "unknown.txt");
  await Deno.remove(join(f.main, "unknown.txt"));

  await git(f.main, "checkout", "-q", "--detach");
  await assertRejects(() => repairLobby(env, f.main, { apply: true }), WtError, "LOBBY UNKNOWN");
  await git(f.main, "checkout", "-q", "main");
  await repairLobby(env, f.main, { apply: true });
  assertStringIncludes((await repairLobby(env, f.main, { apply: true })).join("\n"), "holds no work of its own");
});

// ── pr (SHIP) ───────────────────────────────────────────────────────────────

Deno.test("pr adopts an open PR and adds Closes and Docs, or creates one with both in the body; no Docs page and no --docs is refused", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  await add(env, { id: "MESITA-30", slug: "thirty" });
  const path = join(fleetDirOf(f.main), "MESITA-30-thirty");
  await commitFile(path, "p.txt", "p\n", "thirty subject");
  f.ghOverride = (args) => {
    if (args[0] === "pr" && args[1] === "list" && args.includes("open")) return { code: 0, stdout: JSON.stringify([{ number: 44, body: "harness body", isDraft: true }]), stderr: "" };
    if (args[0] === "pr" && args[1] === "edit") return { code: 0, stdout: "", stderr: "" };
    return undefined;
  };
  // The claim's footprint names no Docs page: the author has to say so.
  await assertRejects(() => pr(makeEnv(f, { cwd: path })), WtError, "NO DOCS LINE");
  const adopted = await pr(makeEnv(f, { cwd: path }), { docs: "none: tooling only, no product knowledge changed" });
  assertStringIncludes(adopted.join("\n"), "adopted PR #44");
  assertStringIncludes(adopted.join("\n"), "Docs: none — tooling only, no product knowledge changed");
  const edit = f.calls.find((c) => c[0] === "pr" && c[1] === "edit")!;
  const editedBody = edit[edit.indexOf("--body") + 1];
  assertStringIncludes(editedBody, "Closes MESITA-30");
  assertStringIncludes(editedBody, "\nDocs: none — tooling only, no product knowledge changed\n");
  assertStringIncludes(editedBody, "harness body");
  f.calls.length = 0;
  f.ghOverride = (args) => {
    if (args[0] === "pr" && args[1] === "list") return { code: 0, stdout: "[]", stderr: "" };
    if (args[0] === "pr" && args[1] === "create") return { code: 0, stdout: "https://github.com/x/y/pull/45", stderr: "" };
    return undefined;
  };
  const created = await pr(makeEnv(f, { cwd: path }), { docs: "handoff:notion:3bfa9bf37a52816eaa9dc2d7b8b74525" });
  assertStringIncludes(created.join("\n"), "opened https://github.com/x/y/pull/45");
  const create = f.calls.find((c) => c[0] === "pr" && c[1] === "create")!;
  assertEquals(create[create.indexOf("--title") + 1], "thirty subject");
  assertEquals(create[create.indexOf("--body") + 1], "Closes MESITA-30\nDocs: handoff notion:3bfa9bf37a52816eaa9dc2d7b8b74525");
  // A footprint that names Docs pages composes the line by itself.
  await add(env, { id: "MESITA-31", slug: "docs", footprint: "apps/web-consumer/src,notion:3bfa9bf37a52816eaa9dc2d7b8b74525,notion:3bfa9bf37a5281078acdc6b9e61b0cf2" });
  const docsPath = join(fleetDirOf(f.main), "MESITA-31-docs");
  await commitFile(docsPath, "d.txt", "d\n", "docs subject");
  f.calls.length = 0;
  const auto = await pr(makeEnv(f, { cwd: docsPath }));
  assertStringIncludes(auto.join("\n"), "Docs: notion:3bfa9bf37a52816eaa9dc2d7b8b74525,notion:3bfa9bf37a5281078acdc6b9e61b0cf2");
  await assertRejects(() => pr(makeEnv(f, { cwd: f.main })), WtError, "NO ISSUE");
});

Deno.test("docsLineFrom accepts the three shapes, refuses the rest, and withJoin keeps an author's own Docs line", () => {
  assertEquals(docsLineFrom("scripts/,notion:3bfa9bf37a52816eaa9dc2d7b8b74525"), "Docs: notion:3bfa9bf37a52816eaa9dc2d7b8b74525");
  assertEquals(docsLineFrom("none", "notion:3bfa9bf37a52816eaa9dc2d7b8b74525, notion:3bfa9bf37a5281078acdc6b9e61b0cf2"), "Docs: notion:3bfa9bf37a52816eaa9dc2d7b8b74525,notion:3bfa9bf37a5281078acdc6b9e61b0cf2");
  assertEquals(docsLineFrom("none", "none — a rename stopped at the label"), "Docs: none — a rename stopped at the label");
  assertEquals(docsLineFrom("none", "none: tooling"), "Docs: none — tooling");
  assertEquals(docsLineFrom("none", "handoff:notion:3bfa9bf37a52816eaa9dc2d7b8b74525"), "Docs: handoff notion:3bfa9bf37a52816eaa9dc2d7b8b74525");
  for (const bad of ["notion:short", "none", "handoff:apps", "whatever"]) {
    try {
      docsLineFrom("none", bad);
      throw new Error("unreachable");
    } catch (e) {
      assert(e instanceof WtError && e.what === "INVALID DOCS", `${bad}: ${e}`);
    }
  }
  try {
    docsLineFrom("scripts/worktree.ts");
    throw new Error("unreachable");
  } catch (e) {
    assert(e instanceof WtError && e.what === "NO DOCS LINE", String(e));
  }
  assertEquals(withJoin("", "MESITA-1", "Docs: none — x"), "Closes MESITA-1\nDocs: none — x");
  assertEquals(withJoin("Closes MESITA-1\nDocs: notion:3bfa9bf37a52816eaa9dc2d7b8b74525\n\nbody", "MESITA-1", "Docs: none — x"), "Closes MESITA-1\nDocs: notion:3bfa9bf37a52816eaa9dc2d7b8b74525\n\nbody", "the author's line stays");
});

// ── clean ───────────────────────────────────────────────────────────────────

Deno.test("isClean is false for edits, untracked files and an operation in progress", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  const w = await rawWorktree(f, "c", "claude/c");
  assertEquals(await isClean(env, w.path), true);
  await write(join(w.path, "new.txt"), "u\n");
  assertEquals(await isClean(env, w.path), false);
  await Deno.remove(join(w.path, "new.txt"));
  const dir = await git(w.path, "rev-parse", "--absolute-git-dir");
  await write(join(dir, "MERGE_HEAD"), "abc\n");
  assertEquals(await isClean(env, w.path), false);
});

// ── boot ────────────────────────────────────────────────────────────────────

Deno.test("boot names the worktree it runs from, not the shared checkout that contains the fleet", async () => {
  const f = await makeFixture();
  const w = await rawWorktree(f, "launch", "claude/launch");
  const fromRoot = (await boot(makeEnv(f, { cwd: w.path }))).join("\n");
  assertStringIncludes(fromRoot, `where: ${join(FLEET_DIR, "launch")} on claude/launch with no claim: a lobby`);
  const sub = join(w.path, "apps", "web");
  await Deno.mkdir(sub, { recursive: true });
  const fromSub = (await boot(makeEnv(f, { cwd: sub }))).join("\n");
  assertStringIncludes(fromSub, `where: ${join(FLEET_DIR, "launch")} on claude/launch`);
  const fromShared = (await boot(makeEnv(f))).join("\n");
  assertStringIncludes(fromShared, "where: the shared checkout (a lobby; never claimable)");
  assertStringIncludes(fromShared, "rules: quickstart stamp MISSING", "the fixture ships no quickstart");
  await write(join(f.main, "scripts", "rules-quickstart.md"), "# q\nmirrors Rules §0 (`stamp: v9 2026-01-01`).\n");
  const stamped = (await boot(makeEnv(f))).join("\n");
  assertStringIncludes(stamped, "rules: quickstart stamp v9 2026-01-01 — compare with Rules §0's Mirror line");
  await write(join(w.path, "scripts", "rules-quickstart.md"), "# q\n(`stamp: v8 2025-12-31`)\n");
  const fromWorktree = (await boot(makeEnv(f, { cwd: w.path }))).join("\n");
  assertStringIncludes(fromWorktree, "rules: quickstart stamp v8 2025-12-31", "the checkout that boots is the one measured, not the lobby");
});

Deno.test("hostHash is pinned in the home directory and survives a hostname change", async () => {
  const home = await Deno.makeTempDir({ prefix: "wt-home-" });
  const a = await hostHash({ home, hostname: () => "alpha.local" });
  const b = await hostHash({ home, hostname: () => "beta.lan" });
  assertEquals(a, b);
  assertEquals((await Deno.readTextFile(join(home, ".config", "mesita", "host-id"))).trim(), a);
  await Deno.writeTextFile(join(home, ".config", "mesita", "host-id"), "nope\n");
  const c = await hostHash({ home, hostname: () => "beta.lan" });
  assert(/^[0-9a-f]{4}$/.test(c), "a corrupt pin is recomputed");
  assertEquals((await Deno.readTextFile(join(home, ".config", "mesita", "host-id"))).trim(), c);
});

Deno.test("leave clears a landed claim and keeps the checkout; adopt over a landed claim clears it and renames the branch", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  await add(env, { id: "MESITA-1", slug: "one" });
  const path = await Deno.realPath(join(fleetDirOf(f.main), "MESITA-1-one"));
  const tip = await commitFile(path, "a.txt", "a\n", "work");
  await assertRejects(() => leave(env, "MESITA-1"), WtError, "UNLANDED");
  await assertRejects(() => add(env, { id: "MESITA-2", slug: "two", adopt: path }), WtError, "NOT A LOBBY");
  f.prsByOid.set(tip, [{ number: 1, merged: true, headRefOid: tip }]);
  const where = (await boot(makeEnv(f, { cwd: path }))).join("\n");
  assertStringIncludes(where, "MESITA-1 landed, a lobby once its claim is cleared");
  const left = (await leave(env, "MESITA-1")).join("\n");
  assertStringIncludes(left, "left worktrees/MESITA-1-one");
  assertEquals((await git(path, "config", "--worktree", "--get", "mesita.issue").catch(() => "")).trim(), "");
  assert(!(await git(f.main, "worktree", "list", "--porcelain")).includes("locked"), "leave unlocks");
  const afterLeave = (await boot(makeEnv(f, { cwd: path }))).join("\n");
  assertStringIncludes(afterLeave, "a lobby on a branch that still names MESITA-1 (landed / no work yet): adopt it for the next issue");
  assert(!/claimed by MESITA-1/.test(afterLeave), "a cleared claim is not a live claim");
  const gate = await preflight(makeEnv(f, { cwd: path }), path);
  assertEquals(gate.ok, false);
  assertStringIncludes(gate.line, "UNCLAIMED WORKTREE");
  const adopted = (await add(env, { id: "MESITA-2", slug: "two", adopt: path })).join("\n");
  assertStringIncludes(adopted, "renamed branch claude/MESITA-1-one → claude/MESITA-2-two");
  assertStringIncludes(adopted, "branch=claude/MESITA-2-two");
  assertEquals((await git(path, "branch", "--show-current")).trim(), "claude/MESITA-2-two");
  const tip2 = await commitFile(path, "b.txt", "b\n", "more");
  f.prsByOid.set(tip2, [{ number: 2, merged: true, headRefOid: tip2 }]);
  const again = (await add(env, { id: "MESITA-3", slug: "three", adopt: path })).join("\n");
  assertStringIncludes(again, "cleared MESITA-2: its work landed");
  assertStringIncludes(again, "renamed branch claude/MESITA-2-two → claude/MESITA-3-three");
});

Deno.test("after leave, boot treats a leftover branch-id as a lobby, not a live claim (MESITA-1761)", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  await add(env, { id: "MESITA-60", slug: "left" });
  const path = await Deno.realPath(join(fleetDirOf(f.main), "MESITA-60-left"));
  const left = (await leave(env, "MESITA-60")).join("\n");
  assertStringIncludes(left, "left worktrees/MESITA-60-left");
  const booted = (await boot(makeEnv(f, { cwd: path }))).join("\n");
  assertStringIncludes(booted, "a lobby on a branch that still names MESITA-60 (landed / no work yet): adopt it for the next issue");
  assert(!booted.includes("claimed by"), "boot agrees with preflight: not a live claim");
  const gate = await preflight(makeEnv(f, { cwd: path }), path);
  assertEquals(gate.ok, false);
  assertStringIncludes(gate.line, "UNCLAIMED WORKTREE");
  // The branch-name fallback still lets add re-attach the loose branch.
  const resumed = (await add(env, { id: "MESITA-60" })).join("\n");
  assertStringIncludes(resumed, "resumed worktrees/MESITA-60-left on claude/MESITA-60-left");
  const reclaimed = (await boot(makeEnv(f, { cwd: path }))).join("\n");
  assertStringIncludes(reclaimed, "claimed by MESITA-60 on claude/MESITA-60-left: no work yet");
});

// ── Origin claims (I-6) ─────────────────────────────────────────────────────

Deno.test("parseOriginRefs drops main and HEAD; decideRemote deletes only a landed, idle, id-carrying branch nobody checks out here", () => {
  const refs = parseOriginRefs([
    "origin/HEAD abc 2026-09-12T10:00:00+00:00",
    "origin/main abc 2026-09-12T10:00:00+00:00",
    "origin/claude/MESITA-7-x def 2026-09-10T10:00:00+00:00",
    "origin/claude/home-soon-96e9 123 not-a-date",
  ].join("\n"));
  assertEquals(refs.map((r) => r.branch), ["claude/MESITA-7-x", "claude/home-soon-96e9"]);
  assertEquals(refs[1].date, null);
  const now = new Date("2026-09-12T10:00:00Z");
  const old = new Date("2026-09-10T10:00:00Z");
  const base = { branch: "claude/MESITA-7-x", tip: "def", date: old, issue: "MESITA-7", here: false };
  assertEquals(decideRemote({ ...base, landed: { kind: "exact", pr: 1 } }, now).decision, "delete");
  assertEquals(decideRemote({ ...base, landed: { kind: "exact", pr: 1 }, here: true }, now).reason, "checked out here");
  assertEquals(decideRemote({ ...base, landed: { kind: "exact", pr: 1 }, date: now }, now).decision, "keep");
  assertEquals(decideRemote({ ...base, landed: { kind: "on-main" } }, now).reason, "claimed, no work yet");
  assertStringIncludes(decideRemote({ ...base, landed: { kind: "unlanded" } }, now).reason, "takeover: candidate");
  assertStringIncludes(decideRemote({ ...base, issue: null, landed: { kind: "exact", pr: 1 } }, now).reason, "NO ID");
  assertEquals(decideRemote({ ...base, landed: null }, now).reason, "landed unknown");
});

Deno.test("add pushes the claim branch so every host sees the lock; boot reads it back from origin and reprints the claim line", async () => {
  const f = await makeFixture();
  const out = (await add(makeEnv(f), { id: "MESITA-40", slug: "forty" })).join("\n");
  assertStringIncludes(out, "pushed claude/MESITA-40-forty to origin");
  const heads = await git(f.tmp, "--git-dir", f.originPath, "for-each-ref", "--format=%(refname:short)", "refs/heads/");
  assert(heads.includes("claude/MESITA-40-forty"), "the empty claim branch sits on origin");
  const path = await Deno.realPath(join(fleetDirOf(f.main), "MESITA-40-forty"));
  const booted = (await boot(makeEnv(f, { cwd: path }))).join("\n");
  assertStringIncludes(booted, "where: workspace worktrees/MESITA-40-forty claimed by MESITA-40 on claude/MESITA-40-forty: no work yet");
  assertStringIncludes(booted, "origin/claude/MESITA-40-forty | MESITA-40 | no work yet | on-main | keep: checked out here");
  assertStringIncludes(booted, "claim: claimed platform=claude-code host=t3st branch=claude/MESITA-40-forty worktree=worktrees/MESITA-40-forty footprint=none");
  // A second checkout of the same origin — another host — sees the claim without any ledger read.
  const other = await makeClone(f, "main");
  const seen = (await boot(makeEnv(f, { cwd: other }))).join("\n");
  assertStringIncludes(seen, "origin/claude/MESITA-40-forty | MESITA-40 | no work yet | on-main | keep: claimed, no work yet");
  assertStringIncludes(seen, "1 claim(s)");
});

Deno.test("sweep deletes a landed origin branch past the lease with a backup ref, keeps a fresh claim, and reports an id-less branch", async () => {
  const f = await makeFixture();
  const landed = await rawWorktree(f, "rl", "claude/MESITA-50-remote-landed");
  f.prsByOid.set(landed.tip, [{ number: 11, merged: true, headRefOid: landed.tip }]);
  await git(landed.path, "push", "-q", "-u", "origin", "claude/MESITA-50-remote-landed");
  await git(f.main, "worktree", "remove", landed.path);
  const noid = await rawWorktree(f, "ni", "claude/home-soon-96e9");
  await git(noid.path, "push", "-q", "-u", "origin", "claude/home-soon-96e9");
  await git(f.main, "worktree", "remove", noid.path);
  await git(f.main, "push", "-q", "origin", "main:refs/heads/claude/MESITA-51-fresh");
  const dry = await sweep(makeEnv(f, { now: later(48) }), { apply: false });
  const dryText = dry.lines.join("\n");
  assertStringIncludes(dryText, "would delete origin/claude/MESITA-50-remote-landed (landed #11)");
  assertStringIncludes(dryText, "origin/claude/home-soon-96e9 | - |");
  assertStringIncludes(dryText, "NO ID");
  assertStringIncludes(dryText, "origin/claude/MESITA-51-fresh | MESITA-51 | no work yet | on-main | keep: claimed, no work yet");
  let heads = await git(f.tmp, "--git-dir", f.originPath, "for-each-ref", "--format=%(refname:short)", "refs/heads/");
  assert(heads.includes("claude/MESITA-50-remote-landed"), "dry run deletes nothing on origin");
  const applied = await sweep(makeEnv(f, { now: later(48) }), { apply: true });
  assertStringIncludes(applied.lines.join("\n"), "deleted origin/claude/MESITA-50-remote-landed (landed #11; backup refs/swept/");
  heads = await git(f.tmp, "--git-dir", f.originPath, "for-each-ref", "--format=%(refname:short)", "refs/heads/");
  assert(!heads.includes("claude/MESITA-50-remote-landed"), "the landed origin branch is gone");
  assert(heads.includes("claude/home-soon-96e9") && heads.includes("claude/MESITA-51-fresh"), "id-less and fresh claims stay");
  assertStringIncludes(await git(f.main, "for-each-ref", "--format=%(refname)", "refs/swept/"), "/origin/claude/MESITA-50-remote-landed");
});

// ── The platform contract (SADLC adapters, item 4) ───────────────────────────

Deno.test("MESITA_PLATFORM declares the interface: a *-cloud token is cloud mode, a declared token wins, unknown tokens earn the agent prefix", () => {
  const env = (vars: Record<string, string>) => (k: string) => vars[k];
  assertEquals(cloudFromEnv(env({ MESITA_PLATFORM: "oz-cloud", MESITA_SESSION: "run_1" })), { platform: "oz-cloud", session: "run_1" });
  assertEquals(cloudFromEnv(env({ MESITA_PLATFORM: "oz-cloud" })), { platform: "oz-cloud", session: null });
  assertEquals(cloudFromEnv(env({ MESITA_PLATFORM: "codex" })), null, "a local token is not cloud mode");
  assertEquals(cloudFromEnv(env({ MESITA_PLATFORM: "cursor-cloud", CLAUDE_CODE_REMOTE: "true" }))?.platform, "cursor-cloud", "the declared token wins");
  assertEquals(cloudFromEnv(env({ CLAUDE_CODE_REMOTE: "true", CLAUDE_CODE_REMOTE_SESSION_ID: "cse_1" })), { platform: "claude-code-cloud", session: "cse_1" });
  assertEquals(declaredPlatform(env({ MESITA_PLATFORM: " opencode " })), "opencode");
  assertEquals(declaredPlatform(env({})), null);
  assertEquals(prefixFor("cursor"), "cursor");
  assertEquals(prefixFor("claude-code-cloud"), "claude");
  assertEquals(prefixFor("oz-cloud"), "agent");
  assertEquals(prefixFor("opencode"), "agent");
  try {
    prefixFor("Bad Token");
    throw new Error("unreachable");
  } catch (e) {
    assert(e instanceof WtError && e.what === "INVALID PLATFORM", String(e));
  }
  assertEquals(showPath("/a/b", "/a/b/c/d"), "c/d");
  assertEquals(showPath("/a/b", "/a/b"), ".");
  assertEquals(showPath("/a/b", "/a/x/y"), "/a/x/y");
  assertEquals(showPath("/a/b", "/a/worktrees/c"), "worktrees/c", "a fleet worktree prints fleet-relative");
  assertEquals(showPath("/a/b", "/a/b/.claude/worktrees/d"), ".claude/worktrees/d", "a legacy worktree still prints repo-relative");
});

Deno.test("an undeclared cloud interface claims its clone with its own token and the agent prefix, and the write gate accepts it from MESITA_PLATFORM alone", async () => {
  const f = await makeFixture();
  const clone = await makeClone(f, "claude/random-task-9z9z9z");
  const refused = await claudeHook({ cwd: clone, tool_name: "Write", tool_input: { file_path: join(clone, "x.ts") } }, { MESITA_PLATFORM: "oz-cloud", MESITA_SESSION: "run_7" });
  assertEquals(refused.code, 2);
  assertStringIncludes(refused.stderr, "UNCLAIMED CLONE");
  const env = makeEnv(f, { cwd: clone, cloud: { platform: "oz-cloud", session: "run_7" } });
  const out = (await add(env, { id: "MESITA-90", slug: "oz", adopt: "." })).join("\n");
  assertStringIncludes(out, "renamed branch claude/random-task-9z9z9z → agent/MESITA-90-oz");
  assertStringIncludes(out, "claimed platform=oz-cloud host=t3st branch=agent/MESITA-90-oz worktree=cloud:run_7 footprint=none");
  assertStringIncludes(out, "ok: cloud clone");
  const allowed = await claudeHook({ cwd: clone, tool_name: "Write", tool_input: { file_path: join(clone, "x.ts") } }, { MESITA_PLATFORM: "oz-cloud" });
  assertEquals(allowed.code, 0, allowed.stderr);
  // A local interface that only declares itself: no --platform, still the agent prefix.
  const local = makeEnv(f);
  local.platform = "opencode";
  const made = (await add(local, { id: "MESITA-91", slug: "oc" })).join("\n");
  assertStringIncludes(made, "claimed platform=opencode host=t3st branch=agent/MESITA-91-oc worktree=worktrees/MESITA-91-oc");
  await assertRejects(() => add(makeEnv(f), { id: "MESITA-92", slug: "bad", platform: "Bad Token" }), WtError, "INVALID PLATFORM");
});
