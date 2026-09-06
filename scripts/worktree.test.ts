// Tests for scripts/worktree.ts on a throwaway git repo with a fake gh.
// Every path goes through Deno.realPath on both sides (macOS: /var vs /private/var).

import { assert, assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  hostHash,
  boot,
  add,
  classifyLanded,
  composeClaim,
  decide,
  defaultRunner,
  type Env,
  type Exec,
  FLEET_DIR,
  GhError,
  isClean,
  lockReason,
  parseClaim,
  parseLock,
  parseWorktreeList,
  pr,
  remove,
  repairLobby,
  sweep,
  validateId,
  validateSlug,
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
  await git(cwd, "commit", "-q", "-m", msg);
  return await git(cwd, "rev-parse", "HEAD");
}

async function makeFixture(): Promise<Fixture> {
  const tmp = await Deno.realPath(await Deno.makeTempDir({ prefix: "wt-test-" }));
  const originPath = join(tmp, "origin.git");
  await git(tmp, "init", "-q", "--bare", "-b", "main", originPath);
  const main = join(tmp, "main");
  await git(tmp, "init", "-q", "-b", "main", main);
  await git(main, "config", "extensions.worktreeConfig", "true");
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

function makeEnv(f: Fixture, opts: { cwd?: string; now?: () => Date; host?: string } = {}): Env & { log: (l: string) => void; lines: string[] } {
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
  };
}

/** A worktree with one commit on a branch, made through git directly (the harness way). */
async function rawWorktree(f: Fixture, name: string, branch: string, opts: { commit?: boolean } = { commit: true }): Promise<{ path: string; tip: string }> {
  const path = join(f.main, FLEET_DIR, name);
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
  const out = await add(env, { id: "MESITA-7", slug: "seven", footprint: "scripts/" });
  const path = join(f.main, FLEET_DIR, "MESITA-7-seven");
  assertEquals(await git(path, "rev-parse", "--abbrev-ref", "HEAD"), "claude/MESITA-7-seven");
  assertEquals(await Deno.readTextFile(join(path, "apps/web/.env.local")), "SECRET=1\n");
  assertEquals(await git(path, "config", "--worktree", "--get", "mesita.issue"), "MESITA-7");
  assertEquals(await git(path, "config", "--worktree", "--get", "mesita.host"), "t3st");
  const list = parseWorktreeList(await git(f.main, "worktree", "list", "--porcelain", "-z"));
  const row = list.find((r) => r.path.endsWith("MESITA-7-seven"))!;
  assert(row.locked && parseLock(row.lockReason).ours);
  assertStringIncludes(out.join("\n"), "claimed platform=claude-code host=t3st branch=claude/MESITA-7-seven worktree=.claude/worktrees/MESITA-7-seven footprint=scripts/");
  assertStringIncludes(out.join("\n"), "seeded 1 file(s)");
  await assertRejects(() => add(env, { id: "MESITA-7", slug: "seven" }), WtError, "EXISTS");
  await assertRejects(() => add(env, { id: "bad" }), WtError, "INVALID ID");
  await assertRejects(() => add(env, { id: "MESITA-8", platform: "vim" }), WtError, "INVALID PLATFORM");
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
  assertStringIncludes(adopted.join("\n"), "branch=claude/lane worktree=.claude/worktrees/lane");
  assertEquals(await git(w.path, "config", "--worktree", "--get", "mesita.issue"), "MESITA-10");
  await assertRejects(() => add(env, { id: "MESITA-11", adopt: w.path }), WtError, "NOT A LOBBY");
  await assertRejects(() => add(env, { id: "MESITA-11", adopt: f.main }), WtError, "NOT ADOPTABLE");
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
  assertStringIncludes(dry.lines.join("\n"), "would remove .claude/worktrees/landed");
  assertStringIncludes(dry.lines.join("\n"), "dry run: nothing changed");
  assert(await Deno.stat(landed.path));

  const active = await sweep(makeEnv(f), { apply: true });
  assertStringIncludes(active.lines.join("\n"), "active within 24h");
  assert(await Deno.stat(landed.path), "a workspace touched within 24h is never removed");

  const applied = await sweep(makeEnv(f, { now: later(48) }), { apply: true });
  const text = applied.lines.join("\n");
  assertStringIncludes(text, "removed .claude/worktrees/landed");
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
  assertStringIncludes(r.lines.join("\n"), "pruned stale registration .claude/worktrees/e");
});

// ── remove (LEAVE) ──────────────────────────────────────────────────────────

Deno.test("remove refuses from inside the target, on ambiguity and on unlanded work; otherwise removes with a backup ref", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  await add(env, { id: "MESITA-20", slug: "twenty" });
  const path = join(f.main, FLEET_DIR, "MESITA-20-twenty");
  const tip = await commitFile(path, "t.txt", "t\n", "twenty");
  await assertRejects(() => remove(makeEnv(f, { cwd: path }), "MESITA-20"), WtError, "INSIDE TARGET");
  await assertRejects(() => remove(env, "MESITA-20"), WtError, "UNLANDED");
  f.prsByOid.set(tip, [{ number: 20, merged: true, headRefOid: tip }]);
  const other = await rawWorktree(f, "other", "claude/other", { commit: false });
  await git(other.path, "config", "--worktree", "mesita.issue", "MESITA-20");
  await assertRejects(() => remove(env, "MESITA-20"), WtError, "AMBIGUOUS");
  await git(other.path, "config", "--worktree", "--unset", "mesita.issue");
  const out = await remove(env, "MESITA-20");
  assertStringIncludes(out.join("\n"), "removed .claude/worktrees/MESITA-20-twenty");
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

Deno.test("pr adopts an open PR and adds Closes, or creates one with the join in the body", async () => {
  const f = await makeFixture();
  const env = makeEnv(f);
  await add(env, { id: "MESITA-30", slug: "thirty" });
  const path = join(f.main, FLEET_DIR, "MESITA-30-thirty");
  await commitFile(path, "p.txt", "p\n", "thirty subject");
  f.ghOverride = (args) => {
    if (args[0] === "pr" && args[1] === "list" && args.includes("open")) return { code: 0, stdout: JSON.stringify([{ number: 44, body: "harness body", isDraft: true }]), stderr: "" };
    if (args[0] === "pr" && args[1] === "edit") return { code: 0, stdout: "", stderr: "" };
    return undefined;
  };
  const adopted = await pr(makeEnv(f, { cwd: path }));
  assertStringIncludes(adopted.join("\n"), "adopted PR #44");
  const edit = f.calls.find((c) => c[0] === "pr" && c[1] === "edit")!;
  assertStringIncludes(edit[edit.indexOf("--body") + 1], "Closes MESITA-30");
  f.calls.length = 0;
  f.ghOverride = (args) => {
    if (args[0] === "pr" && args[1] === "list") return { code: 0, stdout: "[]", stderr: "" };
    if (args[0] === "pr" && args[1] === "create") return { code: 0, stdout: "https://github.com/x/y/pull/45", stderr: "" };
    return undefined;
  };
  const created = await pr(makeEnv(f, { cwd: path }));
  assertStringIncludes(created.join("\n"), "opened https://github.com/x/y/pull/45");
  const create = f.calls.find((c) => c[0] === "pr" && c[1] === "create")!;
  assertEquals(create[create.indexOf("--title") + 1], "thirty subject");
  assertStringIncludes(create[create.indexOf("--body") + 1], "Closes MESITA-30");
  await assertRejects(() => pr(makeEnv(f, { cwd: f.main })), WtError, "NO ISSUE");
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
