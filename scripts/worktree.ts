// scripts/worktree.ts — the fleet tool behind ASDM I-3, I-4, I-6, I-9 and I-10.
//
//   deno task boot                                   where am I, the shared-checkout checks, the fleet, my resumable workspaces
//   deno task worktree add MESITA-<id> [slug] [--platform claude-code|codex|cursor] [--footprint <paths>] [--adopt <path>]
//   deno task worktree pr                            adopt or open the PR for this workspace; the body carries Closes MESITA-<id>
//   deno task worktree remove MESITA-<id>            from a lobby: unlock, remove, back the branch up under refs/swept/, delete it
//   deno task worktree leave MESITA-<id>             a launch worktree after its issue landed: unlock, clear the claim, keep the checkout and branch
//   deno task worktree sweep [--apply]               dry-run by default; --apply removes proven-landed, clean, inactive workspaces
//   deno task worktree repair-lobby                  the shared checkout holds no work of its own (I-4), idempotent
//
// git and gh only, through argv arrays (never a shell). Linear is the agent's job: this
// script prints the claim line and the sweep table; it never reads or writes the ledger.
// Deno's own writes are the seeded files copied into a new workspace; every other
// mutation is a git subprocess, which is why the task line grants --allow-write broadly
// and --allow-run to git and gh only. Output prints paths, never file contents.

import { dirname, join, relative, resolve } from "@std/path";

// ── Types ───────────────────────────────────────────────────────────────────

export type Exec = { code: number; stdout: string; stderr: string };
export type Runner = (cmd: string, args: string[], opts?: { cwd?: string }) => Promise<Exec>;

export type Env = {
  runner: Runner;
  now: () => Date;
  host: string;
  cwd: string;
  log: (line: string) => void;
  sleep: (ms: number) => Promise<void>;
};

export type Row = {
  path: string;
  head: string;
  branch: string | null; // null = detached
  bare: boolean;
  locked: boolean;
  lockReason: string;
  prunable: boolean;
  prunableReason: string;
};

export type Landed =
  | { kind: "on-main" }
  | { kind: "exact"; pr: number }
  | { kind: "tree"; pr: number }
  | { kind: "ahead"; pr: number; by: number }
  | { kind: "merge-tree" }
  | { kind: "unlanded" };

export type Fleet = {
  row: Row;
  issue: string | null;
  host: string | null;
  landed: Landed | null;
  clean: boolean | null;
  activity: Date | null;
  lock: { ours: boolean; issue: string | null; since: Date | null };
  decision: "remove" | "keep";
  reason: string;
};

export const LEASE_MS = 24 * 60 * 60 * 1000; // I-6: 24h of inactivity is stale
export const SWEPT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // refs/swept/ live 30 days
export const PRUNABLE_REFUSAL = 3; // more than this many prunable entries = the repo moved
export const HISTORY_DEPTH = 20;
export const ANCESTOR_BOUND = 1000;
export const FLEET_DIR = ".claude/worktrees";
export const LOCK_PREFIX = "mesita claim=";
export const DRAFT_WAIT_MS = 60_000;
export const DRAFT_POLL_MS = 10_000;

export const PLATFORM_PREFIX: Record<string, string> = {
  "claude-code": "claude",
  codex: "agent",
  cursor: "cursor",
};

// ── Errors (house style, scripts/sync-rules.ts): WHAT: what — why — fix (where) ───

export class WtError extends Error {
  constructor(
    public readonly what: string,
    public readonly detail: string,
    public readonly why: string,
    public readonly fix: string,
    public readonly where: string,
  ) {
    super(`${what}: ${detail} — ${why} — ${fix} (${where})`);
  }
}

export class GhError extends WtError {
  constructor(detail: string) {
    super("GH FAILED", detail, "GitHub could not be asked, so no landed verdict is trustworthy", "run gh auth login or retry when the network is back; nothing was deleted", "I-10");
  }
}

// ── Validation ──────────────────────────────────────────────────────────────

export const ID_RE = /^MESITA-\d{1,6}$/;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateId(id: string): string {
  if (!ID_RE.test(id)) {
    throw new WtError("INVALID ID", id, "an issue id is MESITA-<1 to 6 digits>", "pass the Linear identifier, e.g. MESITA-1566", "I-3");
  }
  return id;
}

export function validateSlug(slug: string): string {
  if (!SLUG_RE.test(slug) || slug.length > 40) {
    throw new WtError("INVALID SLUG", slug, "a slug is lowercase letters, digits and single dashes, at most 40 characters", "e.g. rules-v7-mechanisms", "I-3");
  }
  return slug;
}

export function issueFromBranch(branch: string | null): string | null {
  const m = branch?.match(/MESITA-\d{1,6}/);
  return m ? m[0] : null;
}

// ── Claim line ──────────────────────────────────────────────────────────────

export type Claim = { platform: string; host: string; branch: string; worktree: string; footprint: string };

export function composeClaim(c: Claim): string {
  return `claimed platform=${c.platform} host=${c.host} branch=${c.branch} worktree=${c.worktree} footprint=${c.footprint || "none"}`;
}

export function parseClaim(line: string): Claim | null {
  if (!line.trim().startsWith("claimed ")) return null;
  const out: Record<string, string> = {};
  for (const tok of line.trim().slice("claimed ".length).split(/\s+/)) {
    const eq = tok.indexOf("=");
    if (eq > 0) out[tok.slice(0, eq)] = tok.slice(eq + 1);
  }
  if (!out.branch || !out.worktree) return null;
  return { platform: out.platform ?? "", host: out.host ?? "", branch: out.branch, worktree: out.worktree, footprint: out.footprint ?? "none" };
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/** `git worktree list --porcelain -z`: NUL-terminated attributes, entries separated by an extra NUL. */
export function parseWorktreeList(porcelainZ: string): Row[] {
  const rows: Row[] = [];
  for (const entry of porcelainZ.split("\0\0")) {
    if (!entry.trim()) continue;
    const row: Row = { path: "", head: "", branch: null, bare: false, locked: false, lockReason: "", prunable: false, prunableReason: "" };
    for (const line of entry.split("\0")) {
      if (line.startsWith("worktree ")) row.path = line.slice(9);
      else if (line.startsWith("HEAD ")) row.head = line.slice(5);
      else if (line.startsWith("branch ")) row.branch = line.slice(7).replace(/^refs\/heads\//, "");
      else if (line === "bare") row.bare = true;
      else if (line === "detached") row.branch = null;
      else if (line === "locked" || line.startsWith("locked ")) {
        row.locked = true;
        row.lockReason = line.length > 6 ? line.slice(7) : "";
      } else if (line === "prunable" || line.startsWith("prunable ")) {
        row.prunable = true;
        row.prunableReason = line.length > 8 ? line.slice(9) : "";
      }
    }
    if (row.path) rows.push(row);
  }
  return rows;
}

export function parseLock(reason: string): { ours: boolean; issue: string | null; since: Date | null } {
  if (!reason.startsWith(LOCK_PREFIX)) return { ours: false, issue: null, since: null };
  const issue = reason.match(/claim=(MESITA-\d+)/)?.[1] ?? null;
  const sinceRaw = reason.match(/since=(\S+)/)?.[1];
  const since = sinceRaw ? new Date(sinceRaw) : null;
  return { ours: true, issue, since: since && !isNaN(since.getTime()) ? since : null };
}

export function lockReason(issue: string, now: Date): string {
  return `${LOCK_PREFIX}${issue} since=${now.toISOString()}`;
}

// ── Decision (pure) ─────────────────────────────────────────────────────────

export function isLanded(l: Landed | null): boolean {
  return l !== null && (l.kind === "on-main" || l.kind === "exact" || l.kind === "tree" || l.kind === "merge-tree");
}

export function describeLanded(l: Landed | null): string {
  if (!l) return "unknown";
  switch (l.kind) {
    case "on-main": return "on-main";
    case "exact": return `landed #${l.pr}`;
    case "tree": return `landed #${l.pr} (tree)`;
    case "ahead": return `ahead of #${l.pr} by ${l.by}`;
    case "merge-tree": return "landed (no PR, adds nothing)";
    case "unlanded": return "UNLANDED";
  }
}

export function decide(
  f: Omit<Fleet, "decision" | "reason">,
  ctx: { cwd: string; main: string; now: Date; leaseMs?: number },
): { decision: "remove" | "keep"; reason: string } {
  const lease = ctx.leaseMs ?? LEASE_MS;
  const keep = (reason: string) => ({ decision: "keep" as const, reason });
  if (f.row.path === ctx.main) return keep("shared checkout");
  if (ctx.cwd === f.row.path || ctx.cwd.startsWith(f.row.path + "/")) return keep("own cwd");
  if (f.row.prunable) return keep("prunable entry");
  if (f.landed === null) return keep("landed unknown");
  if (!isLanded(f.landed)) return keep(f.landed.kind === "ahead" ? "residue (ahead of its merged PR)" : "unlanded");
  if (f.clean !== true) return keep("unclean");
  if (f.activity && ctx.now.getTime() - f.activity.getTime() < lease) return keep("active within 24h");
  if (f.row.locked) {
    if (!f.lock.ours) return keep("locked (not ours)");
    if (!f.lock.since || ctx.now.getTime() - f.lock.since.getTime() < lease) return keep("locked (ours, within lease)");
  }
  return { decision: "remove", reason: describeLanded(f.landed) };
}

// ── Git and gh helpers ──────────────────────────────────────────────────────

async function git(env: Env, cwd: string, ...args: string[]): Promise<Exec> {
  return await env.runner("git", args, { cwd });
}

async function gitOk(env: Env, cwd: string, ...args: string[]): Promise<string> {
  const r = await git(env, cwd, ...args);
  if (r.code !== 0) throw new WtError("GIT FAILED", `git ${args.join(" ")}`, r.stderr.trim() || `exit ${r.code}`, "fix the git state named above and rerun", "I-3");
  return r.stdout;
}

export async function realpath(p: string): Promise<string> {
  try {
    return await Deno.realPath(p);
  } catch {
    return resolve(p);
  }
}

export async function listFleet(env: Env, anyCwd: string): Promise<Row[]> {
  const out = await gitOk(env, anyCwd, "worktree", "list", "--porcelain", "-z");
  const rows = parseWorktreeList(out);
  for (const r of rows) r.path = await realpath(r.path);
  return rows;
}

/** The main worktree anchors every path; the first entry of `git worktree list` is it. */
export async function mainWorktree(env: Env): Promise<{ main: string; rows: Row[] }> {
  const probe = await git(env, env.cwd, "rev-parse", "--show-toplevel");
  if (probe.code !== 0) {
    throw new WtError("NO MAIN WORKTREE", env.cwd, "not inside a git checkout of the fleet", "run from the repo or one of its worktrees", "I-3");
  }
  const rows = await listFleet(env, env.cwd);
  if (rows.length === 0 || rows[0].bare) {
    throw new WtError("NO MAIN WORKTREE", env.cwd, "the fleet has no main worktree entry", "run from the repo checkout", "I-3");
  }
  return { main: rows[0].path, rows };
}

async function worktreeConfig(env: Env, path: string, key: string): Promise<string | null> {
  const r = await git(env, path, "config", "--worktree", "--get", key);
  return r.code === 0 ? r.stdout.trim() || null : null;
}

async function gitDir(env: Env, path: string): Promise<string> {
  const out = await gitOk(env, path, "rev-parse", "--absolute-git-dir");
  return out.trim();
}

const STATE_FILES = ["rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "BISECT_LOG"];

export async function isClean(env: Env, path: string): Promise<boolean> {
  const st = await git(env, path, "status", "--porcelain", "--untracked-files=normal");
  if (st.code !== 0 || st.stdout.trim() !== "") return false;
  const dir = await gitDir(env, path);
  for (const f of STATE_FILES) {
    try {
      await Deno.stat(join(dir, f));
      return false;
    } catch { /* absent, good */ }
  }
  return true;
}

async function mtime(p: string): Promise<Date | null> {
  try {
    return (await Deno.stat(p)).mtime ?? null;
  } catch {
    return null;
  }
}

/** I-9: liveness is activity, never inference from landedness. */
export async function lastActivity(env: Env, path: string, lockSince: Date | null, tipDate: Date | null): Promise<Date | null> {
  const dir = await gitDir(env, path);
  const candidates = [await mtime(join(dir, "logs", "HEAD")), await mtime(join(dir, "index")), lockSince, tipDate];
  let best: Date | null = null;
  for (const c of candidates) if (c && (!best || c > best)) best = c;
  return best;
}

type HistoryNode = { oid: string; committedDate: string; prs: { number: number; merged: boolean; headRefOid: string }[] };

const HISTORY_QUERY = `query($owner: String!, $name: String!, $oid: GitObjectID!, $depth: Int!) {
  repository(owner: $owner, name: $name) { object(oid: $oid) { ... on Commit {
    history(first: $depth) { nodes { oid committedDate
      associatedPullRequests(first: 5) { nodes { number merged headRefOid } } } } } } } }`;

export async function repoSlug(env: Env, cwd: string): Promise<{ owner: string; name: string }> {
  const url = (await gitOk(env, cwd, "remote", "get-url", "origin")).trim();
  const m = url.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
  if (!m) throw new WtError("NO ORIGIN", url, "origin is not a GitHub remote", "set origin to the GitHub repo", "I-10");
  return { owner: m[1], name: m[2] };
}

export async function history(env: Env, cwd: string, oid: string): Promise<HistoryNode[]> {
  const { owner, name } = await repoSlug(env, cwd);
  const r = await env.runner("gh", ["api", "graphql", "-f", `query=${HISTORY_QUERY}`, "-F", `owner=${owner}`, "-F", `name=${name}`, "-F", `oid=${oid}`, "-F", `depth=${HISTORY_DEPTH}`], { cwd });
  if (r.code !== 0) throw new GhError(r.stderr.trim() || `gh exit ${r.code}`);
  let parsed: { data?: { repository?: { object?: { history?: { nodes?: { oid: string; committedDate: string; associatedPullRequests: { nodes: { number: number; merged: boolean; headRefOid: string }[] } }[] } } } }; errors?: unknown };
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    throw new GhError("gh returned no JSON");
  }
  if (parsed.errors) throw new GhError(JSON.stringify(parsed.errors).slice(0, 200));
  const nodes = parsed.data?.repository?.object?.history?.nodes ?? [];
  return nodes.map((n) => ({ oid: n.oid, committedDate: n.committedDate, prs: n.associatedPullRequests.nodes }));
}

async function mergedPrsByHead(env: Env, cwd: string, branch: string): Promise<{ number: number; headRefOid: string }[]> {
  const r = await env.runner("gh", ["pr", "list", "--head", branch, "--state", "merged", "--limit", "3", "--json", "number,headRefOid"], { cwd });
  if (r.code !== 0) throw new GhError(r.stderr.trim() || `gh exit ${r.code}`);
  try {
    return JSON.parse(r.stdout) as { number: number; headRefOid: string }[];
  } catch {
    throw new GhError("gh pr list returned no JSON");
  }
}

async function treeOf(env: Env, cwd: string, oid: string, pr: number): Promise<string | null> {
  let r = await git(env, cwd, "rev-parse", `${oid}^{tree}`);
  if (r.code !== 0) {
    await git(env, cwd, "fetch", "--quiet", "origin", `refs/pull/${pr}/head`);
    r = await git(env, cwd, "rev-parse", `${oid}^{tree}`);
  }
  return r.code === 0 ? r.stdout.trim() : null;
}

/** I-10: landed is judged against GitHub, per branch. */
export async function classifyLanded(env: Env, main: string, tip: string, branch: string | null): Promise<{ landed: Landed; tipDate: Date | null }> {
  const onMain = await git(env, main, "merge-base", "--is-ancestor", tip, "origin/main");
  if (onMain.code === 0) return { landed: { kind: "on-main" }, tipDate: null };
  const nodes = await history(env, main, tip);
  const tipDate = nodes[0]?.committedDate ? new Date(nodes[0].committedDate) : null;
  const tipNode = nodes[0];
  const tipTree = (await gitOk(env, main, "rev-parse", `${tip}^{tree}`)).trim();
  if (tipNode) {
    for (const pr of tipNode.prs) if (pr.merged && pr.headRefOid === tip) return { landed: { kind: "exact", pr: pr.number }, tipDate };
  }
  const candidates: { number: number; headRefOid: string }[] = [...(tipNode?.prs.filter((p) => p.merged) ?? [])];
  if (branch) candidates.push(...await mergedPrsByHead(env, main, branch));
  for (const pr of candidates) {
    if (pr.headRefOid === tip) return { landed: { kind: "exact", pr: pr.number }, tipDate };
    const t = await treeOf(env, main, pr.headRefOid, pr.number);
    if (t && t === tipTree) return { landed: { kind: "tree", pr: pr.number }, tipDate };
  }
  for (let i = 1; i < nodes.length; i++) {
    for (const pr of nodes[i].prs) if (pr.merged && pr.headRefOid === nodes[i].oid) return { landed: { kind: "ahead", pr: pr.number, by: i }, tipDate };
  }
  const mainTree = (await gitOk(env, main, "rev-parse", "origin/main^{tree}")).trim();
  const mt = await git(env, main, "merge-tree", "--write-tree", "origin/main", tip);
  const resultTree = mt.stdout.split("\n")[0]?.trim();
  if (mt.code === 0 && resultTree === mainTree) return { landed: { kind: "merge-tree" }, tipDate };
  return { landed: { kind: "unlanded" }, tipDate };
}

// ── Fleet inspection ────────────────────────────────────────────────────────

export async function inspect(env: Env, main: string, rows: Row[], opts: { landed: boolean }): Promise<Fleet[]> {
  const cwd = await realpath(env.cwd);
  const out: Fleet[] = [];
  for (const row of rows) {
    const isMain = row.path === main;
    let issue: string | null = null, host: string | null = null, landed: Landed | null = null, clean: boolean | null = null, activity: Date | null = null;
    const lock = parseLock(row.lockReason);
    if (!row.prunable && !row.bare) {
      issue = await worktreeConfig(env, row.path, "mesita.issue") ?? issueFromBranch(row.branch);
      host = await worktreeConfig(env, row.path, "mesita.host");
      clean = await isClean(env, row.path);
      let tipDate: Date | null = null;
      if (!isMain && opts.landed) {
        const c = await classifyLanded(env, main, row.head, row.branch);
        landed = c.landed;
        tipDate = c.tipDate;
      }
      activity = await lastActivity(env, row.path, lock.since, tipDate);
    }
    const base = { row, issue, host, landed, clean, activity, lock };
    out.push({ ...base, ...decide(base, { cwd, main, now: env.now() }) });
  }
  return out;
}

export function table(main: string, fleet: Fleet[], now: Date): string {
  const lines = ["path | branch | landed | clean | activity | lock | issue | decision"];
  for (const f of fleet) {
    const rel = f.row.path === main ? "(shared checkout)" : relative(main, f.row.path);
    const age = f.activity ? `${Math.round((now.getTime() - f.activity.getTime()) / 3_600_000)}h` : "?";
    const lock = f.row.locked ? (f.lock.ours ? "ours" : "other") : "-";
    lines.push(`${rel} | ${f.row.branch ?? "(detached)"} | ${describeLanded(f.landed)} | ${f.clean === null ? "?" : f.clean ? "yes" : "NO"} | ${age} | ${lock} | ${f.issue ?? "-"} | ${f.decision}: ${f.reason}`);
  }
  return lines.join("\n");
}

export function toJson(main: string, fleet: Fleet[]): string {
  return JSON.stringify(fleet.map((f) => ({
    path: relative(main, f.row.path) || ".",
    branch: f.row.branch,
    landed: describeLanded(f.landed),
    clean: f.clean,
    activity: f.activity?.toISOString() ?? null,
    locked: f.row.locked,
    lockOurs: f.lock.ours,
    issue: f.issue,
    host: f.host,
    decision: f.decision,
    reason: f.reason,
  })));
}

// ── repair-lobby (I-4) ──────────────────────────────────────────────────────

export async function repairLobby(env: Env, main: string, opts: { apply: boolean }): Promise<string[]> {
  const notes: string[] = [];
  const fetch = await git(env, main, "fetch", "--quiet", "origin", "main");
  if (fetch.code !== 0) throw new WtError("FETCH FAILED", fetch.stderr.trim() || "git fetch origin main", "offline or not authenticated", "retry with network, or gh auth login", "I-4");
  const headRef = await git(env, main, "symbolic-ref", "-q", "HEAD");
  if (headRef.code !== 0 || headRef.stdout.trim() !== "refs/heads/main") {
    throw new WtError("LOBBY UNKNOWN", headRef.stdout.trim() || "detached HEAD", "the shared checkout must sit on main", "git checkout main in the shared checkout, then rerun", "I-4");
  }
  const head = (await gitOk(env, main, "rev-parse", "HEAD")).trim();
  const origin = (await gitOk(env, main, "rev-parse", "origin/main")).trim();
  const indexTree = (await gitOk(env, main, "write-tree")).trim();
  const headTree = (await gitOk(env, main, "rev-parse", "HEAD^{tree}")).trim();
  const unstaged = (await git(env, main, "diff", "--quiet")).code !== 0;
  if (head === origin && indexTree === headTree && !unstaged) {
    notes.push("shared checkout holds no work of its own: HEAD == origin/main, index == HEAD, working tree == index");
    return notes;
  }
  // Staged work the checkout cannot explain is the one state that refuses. A stale index
  // (the harness moved the ref and left the tree behind) is always an older main tree;
  // an index equal to HEAD carries no staged work, so own commits can be backed up and reset.
  if (indexTree !== headTree) {
    const ancestors = await gitOk(env, main, "rev-list", "--first-parent", "-n", String(ANCESTOR_BOUND), "--format=%T", "origin/main");
    const trees = new Set(ancestors.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("commit ")));
    if (!trees.has(indexTree)) {
      throw new WtError("LOBBY UNKNOWN", `index tree ${indexTree.slice(0, 9)}`, `staged work that is not the tree of any first-parent ancestor of origin/main within ${ANCESTOR_BOUND} commits`, "inspect the shared checkout by hand and file an Ops issue; nothing was reset", "I-4");
    }
  }
  const stamp = env.now().toISOString().replace(/[:.]/g, "-");
  const ownCommits = Number((await gitOk(env, main, "rev-list", "--count", "origin/main..HEAD")).trim());
  if (!opts.apply) {
    notes.push(`would reset the shared checkout to origin/main (${origin.slice(0, 9)}); index at an older main tree${unstaged ? "; unstaged edits would be stashed" : ""}${ownCommits ? `; ${ownCommits} own commit(s) would be backed up` : ""}`);
    return notes;
  }
  if (unstaged) {
    const name = `lobby-${stamp}-${head.slice(0, 9)}`;
    await gitOk(env, main, "stash", "push", "-m", name);
    notes.push(`LOBBY HAD EDITS: stashed as ${name} — the shared checkout carried unstaged edits — recover with git stash list (I-4)`);
  }
  if (ownCommits > 0) {
    const name = `backup/lobby-${stamp}`;
    await gitOk(env, main, "branch", name, "HEAD");
    notes.push(`LOBBY HAD COMMITS: ${ownCommits} backed up on ${name} — the shared checkout is never a workspace — land them through a PR from a workspace (I-4)`);
  }
  await gitOk(env, main, "reset", "--hard", "origin/main");
  notes.push(`reset the shared checkout to origin/main (${origin.slice(0, 9)})`);
  return notes;
}

// ── add (ISOLATE) ───────────────────────────────────────────────────────────

export async function seedFrom(env: Env, main: string, target: string): Promise<{ copied: number; missing: boolean }> {
  const r = await git(env, main, "ls-files", "-o", "-i", "--exclude-from=.worktreeinclude", "-z");
  if (r.code !== 0) return { copied: 0, missing: true };
  const files = r.stdout.split("\0").filter(Boolean);
  let copied = 0;
  for (const f of files) {
    const src = join(main, f);
    const dst = join(target, f);
    try {
      const st = await Deno.stat(src);
      if (!st.isFile) continue;
      await Deno.mkdir(dirname(dst), { recursive: true });
      await Deno.copyFile(src, dst);
      copied++;
    } catch { /* a listed path that vanished; the warning below covers an empty seed */ }
  }
  return { copied, missing: files.length === 0 };
}

async function claimWorkspace(env: Env, main: string, path: string, issue: string, platform: string): Promise<void> {
  const now = env.now();
  await gitOk(env, path, "config", "--worktree", "mesita.issue", issue);
  await gitOk(env, path, "config", "--worktree", "mesita.platform", platform);
  await gitOk(env, path, "config", "--worktree", "mesita.claimedAt", now.toISOString());
  await gitOk(env, path, "config", "--worktree", "mesita.host", env.host);
  const lock = await git(env, main, "worktree", "lock", "--reason", lockReason(issue, now), path);
  if (lock.code !== 0 && !/already locked/.test(lock.stderr)) {
    throw new WtError("GIT FAILED", "git worktree lock", lock.stderr.trim(), "check the worktree registration", "I-9");
  }
}

export async function add(env: Env, args: { id: string; slug?: string; platform?: string; footprint?: string; adopt?: string }): Promise<string[]> {
  const id = validateId(args.id);
  const platform = args.platform ?? "claude-code";
  const prefix = PLATFORM_PREFIX[platform];
  if (!prefix) throw new WtError("INVALID PLATFORM", platform, `known tokens: ${Object.keys(PLATFORM_PREFIX).join(", ")}`, "pass --platform <token>", "I-6");
  const { main, rows } = await mainWorktree(env);
  const out: string[] = [];
  if (args.adopt) {
    const target = await realpath(args.adopt);
    const row = rows.find((r) => r.path === target);
    const fleetDir = join(main, FLEET_DIR);
    if (!row || target === main || !target.startsWith(fleetDir + "/")) {
      throw new WtError("NOT ADOPTABLE", args.adopt, `only a registered worktree under ${FLEET_DIR}/ can be adopted`, "run deno task worktree add without --adopt to create one", "I-3");
    }
    const existing = await worktreeConfig(env, target, "mesita.issue");
    if (existing && existing !== id) {
      // A claim whose PR merged and whose tree is clean is a lobby nobody cleared (MESITA-1577): clear it and go on. A tip still on main is a live claim with no work yet, never adopted over.
      const { landed } = await classifyLanded(env, main, row.head, row.branch);
      const merged = isLanded(landed) && landed!.kind !== "on-main";
      if (!merged || !(await isClean(env, target))) {
        throw new WtError("NOT A LOBBY", `${relative(main, target)} is claimed by ${existing} (${describeLanded(landed)})`, "one live claim per workspace", "add a new workspace for the second issue; a merged PR for the old claim is what lets adopt clear it, or leave it yourself", "I-3");
      }
      if (row.locked) await git(env, main, "worktree", "unlock", target);
      await clearClaim(env, target);
      out.push(`cleared ${existing}: its work landed (${describeLanded(landed)})`);
    }
    // closes.yml reads the issue id off the branch name, so a harness-named branch is renamed in place.
    let branch = row.branch;
    if (branch && !branch.includes(id)) {
      const tail = branch.split("/").pop() ?? "work";
      const slug = validateSlug(args.slug ?? (SLUG_RE.test(tail) && tail.length <= 40 ? tail : "work"));
      const renamed = `${prefix}/${id}-${slug}`;
      const mv = await git(env, target, "branch", "-m", renamed);
      if (mv.code !== 0) throw new WtError("GIT FAILED", "git branch -m", mv.stderr.trim(), "rename the branch by hand, then rerun", "I-3");
      out.push(`renamed branch ${branch} → ${renamed} (closes.yml wants the id in the branch name)`);
      branch = renamed;
    }
    const seed = await seedFrom(env, main, target);
    if (seed.missing) out.push("NO SEED: nothing matched .worktreeinclude in the main worktree — env files are absent there — copy them by hand (I-3)");
    await claimWorkspace(env, main, target, id, platform);
    out.push(composeClaim({ platform, host: env.host, branch: branch ?? "none", worktree: relative(main, target), footprint: args.footprint ?? "" }));
    return out;
  }
  const slug = validateSlug(args.slug ?? "work");
  const name = `${id}-${slug}`;
  const branch = `${prefix}/${name}`;
  const target = join(main, FLEET_DIR, name);
  const check = await git(env, main, "check-ref-format", "--branch", branch);
  if (check.code !== 0) throw new WtError("INVALID SLUG", branch, "git rejects the branch name", "shorten or simplify the slug", "I-3");
  const fetch = await git(env, main, "fetch", "--quiet", "origin", "main");
  if (fetch.code !== 0) throw new WtError("FETCH FAILED", fetch.stderr.trim() || "git fetch origin main", "offline or not authenticated", "retry with network, or gh auth login", "I-3");
  const branchExists = (await git(env, main, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`)).code === 0;
  let pathExists = false;
  try {
    await Deno.stat(target);
    pathExists = true;
  } catch { /* absent, good */ }
  if (branchExists || pathExists) {
    throw new WtError("EXISTS", branchExists ? branch : relative(main, target), "a workspace for this issue was created earlier", `adopt it with --adopt ${relative(main, target)} or remove it first`, "I-3");
  }
  const addRes = await git(env, main, "worktree", "add", target, "-b", branch, "origin/main");
  if (addRes.code !== 0) {
    if (/already checked out|is already used by worktree/.test(addRes.stderr)) {
      throw new WtError("ELSEWHERE", branch, "that branch is checked out in another workspace", "takeover removes the stale one first (I-6)", "I-6");
    }
    throw new WtError("GIT FAILED", "git worktree add", addRes.stderr.trim(), "fix the state named above and rerun", "I-3");
  }
  const seed = await seedFrom(env, main, target);
  if (seed.missing) out.push("NO SEED: nothing matched .worktreeinclude in the main worktree — env files are absent there — copy them by hand (I-3)");
  else out.push(`seeded ${seed.copied} file(s) from .worktreeinclude`);
  await claimWorkspace(env, main, target, id, platform);
  out.push(composeClaim({ platform, host: env.host, branch, worktree: relative(main, target), footprint: args.footprint ?? "" }));
  out.push(`next: enter ${relative(main, target)} (Claude Code: EnterWorktree path=${target}), move ${id} to In Progress, paste the claim line`);
  return out;
}

// ── pr (SHIP) ───────────────────────────────────────────────────────────────

export function withCloses(body: string, id: string): string {
  return new RegExp(`Closes ${id}\\b`).test(body) ? body : `Closes ${id}\n\n${body}`.trim();
}

export async function pr(env: Env): Promise<string[]> {
  const { main } = await mainWorktree(env);
  const cwd = await realpath(env.cwd);
  const branch = (await gitOk(env, cwd, "rev-parse", "--abbrev-ref", "HEAD")).trim();
  const issue = await worktreeConfig(env, cwd, "mesita.issue") ?? issueFromBranch(branch);
  if (!issue) throw new WtError("NO ISSUE", relative(main, cwd) || ".", "this checkout is not a workspace", "deno task worktree add MESITA-<id>, or --adopt this path", "I-3");
  const listed = await env.runner("gh", ["pr", "list", "--head", branch, "--state", "open", "--json", "number,body,isDraft"], { cwd });
  if (listed.code !== 0) throw new GhError(listed.stderr.trim() || `gh exit ${listed.code}`);
  let open: { number: number; body: string; isDraft: boolean }[] = [];
  try {
    open = JSON.parse(listed.stdout);
  } catch { /* treated as none */ }
  if (open.length === 0 && branch.startsWith("claude/")) {
    // Bounded by attempts, not the wall clock: an injected instant sleeper must not spin.
    const attempts = Math.ceil(DRAFT_WAIT_MS / DRAFT_POLL_MS);
    for (let i = 0; i < attempts && open.length === 0; i++) {
      await env.sleep(DRAFT_POLL_MS);
      const again = await env.runner("gh", ["pr", "list", "--head", branch, "--state", "open", "--json", "number,body,isDraft"], { cwd });
      try {
        open = again.code === 0 ? JSON.parse(again.stdout) : [];
      } catch { /* keep waiting */ }
    }
  }
  if (open.length > 0) {
    const p = open[0];
    const body = withCloses(p.body ?? "", issue);
    if (body !== (p.body ?? "")) {
      const ed = await env.runner("gh", ["pr", "edit", String(p.number), "--body", body], { cwd });
      if (ed.code !== 0) throw new GhError(ed.stderr.trim());
    }
    return [`adopted PR #${p.number} on ${branch}${p.isDraft ? " (draft: run gh pr ready before merging)" : ""}; body carries Closes ${issue}`];
  }
  const subject = (await gitOk(env, cwd, "log", "-1", "--format=%s")).trim();
  const created = await env.runner("gh", ["pr", "create", "--head", branch, "--title", subject, "--body", withCloses("", issue)], { cwd });
  if (created.code !== 0) throw new GhError(created.stderr.trim());
  return [`opened ${created.stdout.trim()} on ${branch}; body carries Closes ${issue}`];
}

// ── remove (LEAVE) ──────────────────────────────────────────────────────────

async function backupAndDelete(env: Env, main: string, branch: string, tip: string, now: Date): Promise<string> {
  const date = now.toISOString().slice(0, 10);
  const ref = `refs/swept/${date}/${branch}`;
  await gitOk(env, main, "update-ref", ref, tip);
  const del = await git(env, main, "branch", "-D", branch);
  if (del.code !== 0) return `kept branch ${branch} (backup ${ref}): ${del.stderr.trim()}`;
  return `deleted branch ${branch} (backup ${ref}, 30 days)`;
}

export async function expireSwept(env: Env, main: string, now: Date): Promise<number> {
  const refs = (await git(env, main, "for-each-ref", "--format=%(refname)", "refs/swept/")).stdout.split("\n").filter(Boolean);
  let n = 0;
  for (const ref of refs) {
    const date = ref.split("/")[2];
    const t = Date.parse(date);
    if (!isNaN(t) && now.getTime() - t > SWEPT_TTL_MS) {
      await git(env, main, "update-ref", "-d", ref);
      n++;
    }
  }
  return n;
}

export async function remove(env: Env, id: string): Promise<string[]> {
  validateId(id);
  const { main, rows } = await mainWorktree(env);
  const cwd = await realpath(env.cwd);
  const matches: Row[] = [];
  for (const r of rows) {
    if (r.path === main || r.prunable || r.bare) continue;
    const issue = await worktreeConfig(env, r.path, "mesita.issue") ?? issueFromBranch(r.branch);
    if (issue === id) matches.push(r);
  }
  if (matches.length === 0) throw new WtError("NO ISSUE", id, "no workspace carries this claim", "check deno task boot for the fleet", "I-3");
  if (matches.length > 1) {
    throw new WtError("AMBIGUOUS", matches.map((m) => relative(main, m.path)).join(", "), "two workspaces carry one claim", "adopt the right one and remove the other by hand", "I-3");
  }
  const row = matches[0];
  if (cwd === row.path || cwd.startsWith(row.path + "/")) {
    throw new WtError("INSIDE TARGET", relative(main, row.path), "a workspace cannot remove its own cwd (git would succeed and strand the session)", `cd ${main} first, then rerun`, "I-9");
  }
  const { landed } = await classifyLanded(env, main, row.head, row.branch);
  if (!isLanded(landed)) throw new WtError("UNLANDED", `${row.branch ?? row.head.slice(0, 9)} is ${describeLanded(landed)}`, "only landed work is removed", "ship it, or file a handoff: comment and keep it", "I-10");
  if (!(await isClean(env, row.path))) throw new WtError("UNCLEAN", relative(main, row.path), "the workspace has edits or an operation in progress", "commit, stash or abort, then rerun", "I-10");
  if (row.locked) await git(env, main, "worktree", "unlock", row.path);
  const rm = await git(env, main, "worktree", "remove", row.path);
  if (rm.code !== 0) throw new WtError("GIT FAILED", "git worktree remove", rm.stderr.trim(), "close programs holding files there and rerun", "I-9");
  const out = [`removed ${relative(main, row.path)}`];
  if (row.branch) out.push(await backupAndDelete(env, main, row.branch, row.head, env.now()));
  return out;
}

// ── leave (LEAVE for a launch worktree: clear the claim, keep the checkout) ─────

async function clearClaim(env: Env, path: string): Promise<void> {
  for (const key of ["mesita.issue", "mesita.platform", "mesita.claimedAt", "mesita.host"]) await git(env, path, "config", "--worktree", "--unset", key);
}

/** A landed, clean workspace gives its claim and lock back and stays on disk as a lobby (I-9); idempotent. */
export async function leave(env: Env, id: string): Promise<string[]> {
  validateId(id);
  const { main, rows } = await mainWorktree(env);
  const matches: Row[] = [];
  for (const r of rows) {
    if (r.path === main || r.prunable || r.bare) continue;
    const issue = await worktreeConfig(env, r.path, "mesita.issue") ?? issueFromBranch(r.branch);
    if (issue === id) matches.push(r);
  }
  if (matches.length === 0) throw new WtError("NO ISSUE", id, "no workspace carries this claim", "check deno task boot for the fleet", "I-3");
  if (matches.length > 1) throw new WtError("AMBIGUOUS", matches.map((m) => relative(main, m.path)).join(", "), "two workspaces carry one claim", "remove the wrong one first", "I-3");
  const row = matches[0];
  const { landed } = await classifyLanded(env, main, row.head, row.branch);
  if (!isLanded(landed)) throw new WtError("UNLANDED", `${row.branch ?? row.head.slice(0, 9)} is ${describeLanded(landed)}`, "a claim is cleared only after its work landed", "ship it, or file a handoff: comment and keep the claim", "I-10");
  if (!(await isClean(env, row.path))) throw new WtError("UNCLEAN", relative(main, row.path), "the workspace has edits or an operation in progress", "commit, stash or abort, then rerun", "I-10");
  if (row.locked) await git(env, main, "worktree", "unlock", row.path);
  await clearClaim(env, row.path);
  return [`left ${relative(main, row.path)}: a lobby again on ${row.branch ?? "(detached)"} (${describeLanded(landed)}); the checkout and branch stay`];
}

// ── sweep ───────────────────────────────────────────────────────────────────

export async function sweep(env: Env, opts: { apply: boolean }): Promise<{ lines: string[]; fleet: Fleet[]; json: string; loose: { branch: string; tip: string; landed: Landed }[] }> {
  const { main } = await mainWorktree(env);
  const lines: string[] = [];
  for (const n of await repairLobby(env, main, { apply: opts.apply })) lines.push(n);
  // Orphans present on disk but unregistered: repair before anything prunes.
  const fleetDir = join(main, FLEET_DIR);
  let registered = await listFleet(env, main);
  const known = new Set(registered.map((r) => r.path));
  try {
    for await (const e of Deno.readDir(fleetDir)) {
      if (!e.isDirectory) continue;
      const p = await realpath(join(fleetDir, e.name));
      if (known.has(p)) continue;
      const rep = await git(env, main, "worktree", "repair", p);
      if (rep.code === 0 && rep.stderr.trim() === "" || (await listFleet(env, main)).some((r) => r.path === p)) {
        lines.push(`repaired ${relative(main, p)}`);
      } else {
        lines.push(`ORPHAN: ${relative(main, p)} — its admin entry is gone, git worktree repair cannot re-register it — compare it against its branch tip by hand (read-tree recipe) before deleting; the sweep never touches it (I-10)`);
      }
    }
  } catch { /* no fleet dir yet */ }
  registered = await listFleet(env, main);
  const prunable = registered.filter((r) => r.prunable);
  if (prunable.length > PRUNABLE_REFUSAL) {
    throw new WtError("REPO MOVED?", `${prunable.length} prunable entries`, "that many stale registrations at once means the repo or its worktrees moved", "git worktree repair the moved paths first, then rerun", "I-10");
  }
  for (const r of prunable) {
    lines.push(`${opts.apply ? "pruned" : "would prune"} stale registration ${relative(main, r.path)}`);
    if (opts.apply) {
      if (r.locked) await git(env, main, "worktree", "unlock", r.path);
    }
  }
  if (opts.apply && prunable.length > 0) {
    await git(env, main, "worktree", "prune");
    registered = await listFleet(env, main);
  }
  const fleet = await inspect(env, main, registered, { landed: true });
  const now = env.now();
  lines.push(table(main, fleet, now));
  for (const f of fleet) {
    if (f.decision !== "remove") continue;
    if (!opts.apply) {
      lines.push(`would remove ${relative(main, f.row.path)} (${f.reason})`);
      continue;
    }
    if (f.row.locked) await git(env, main, "worktree", "unlock", f.row.path);
    const rm = await git(env, main, "worktree", "remove", f.row.path);
    if (rm.code !== 0) {
      lines.push(`kept ${relative(main, f.row.path)}: ${rm.stderr.trim()}`);
      continue;
    }
    lines.push(`removed ${relative(main, f.row.path)} (${f.reason})`);
    if (f.row.branch) lines.push(await backupAndDelete(env, main, f.row.branch, f.row.head, now));
  }
  // Loose branches: local heads no worktree checks out. Landed ones are deleted with a
  // backup ref; ahead, unlanded and backup/* branches stay and are reported.
  const loose = await looseBranches(env, main, registered);
  if (loose.length) {
    lines.push("branch | landed | decision");
    for (const b of loose) {
      const removable = isLanded(b.landed) && !b.branch.startsWith("backup/");
      lines.push(`${b.branch} | ${describeLanded(b.landed)} | ${removable ? (opts.apply ? "delete" : "would delete") : "keep"}`);
      if (removable && opts.apply) lines.push(await backupAndDelete(env, main, b.branch, b.tip, now));
    }
  }
  if (opts.apply) {
    const expired = await expireSwept(env, main, now);
    if (expired) lines.push(`expired ${expired} refs/swept/ backup(s) older than 30 days`);
  } else {
    lines.push("dry run: nothing changed; rerun with --apply to remove what is marked remove or delete");
  }
  return { lines, fleet, json: toJson(main, fleet), loose };
}

export async function looseBranches(env: Env, main: string, rows: Row[]): Promise<{ branch: string; tip: string; landed: Landed }[]> {
  const attached = new Set(rows.map((r) => r.branch).filter((b): b is string => b !== null));
  const out: { branch: string; tip: string; landed: Landed }[] = [];
  const refs = (await gitOk(env, main, "for-each-ref", "--format=%(refname:short) %(objectname)", "refs/heads/")).split("\n").filter(Boolean);
  for (const line of refs) {
    const [branch, tip] = line.split(" ");
    if (branch === "main" || attached.has(branch)) continue;
    const { landed } = await classifyLanded(env, main, tip, branch);
    out.push({ branch, tip, landed });
  }
  return out;
}

// ── boot ────────────────────────────────────────────────────────────────────

export async function boot(env: Env): Promise<string[]> {
  const { main, rows } = await mainWorktree(env);
  const cwd = await realpath(env.cwd);
  const lines: string[] = [];
  // The fleet lives inside the shared checkout, so the shared row prefix-matches every worktree: the most specific path wins.
  const here = rows.filter((r) => cwd === r.path || cwd.startsWith(r.path + "/")).sort((a, b) => b.path.length - a.path.length)[0];
  const hereIssue = here && here.path !== main ? await worktreeConfig(env, here.path, "mesita.issue") ?? issueFromBranch(here.branch) : null;
  const hereLanded = here && here.path !== main && hereIssue ? isLanded((await classifyLanded(env, main, here.head, here.branch)).landed) : false;
  if (!here) lines.push(`where: ${cwd} (outside the fleet)`);
  else if (here.path === main) lines.push(`where: the shared checkout (a lobby; never claimable)`);
  else if (hereIssue && hereLanded) lines.push(`where: ${relative(main, here.path)} on ${here.branch ?? "(detached)"}: ${hereIssue} landed, a lobby once its claim is cleared: deno task worktree leave ${hereIssue}, or deno task worktree add MESITA-<id> --adopt ${relative(main, here.path)} for the next issue`);
  else if (hereIssue) lines.push(`where: workspace ${relative(main, here.path)} claimed by ${hereIssue} on ${here.branch ?? "(detached)"}`);
  else lines.push(`where: ${relative(main, here.path)} on ${here.branch ?? "(detached)"} with no claim: a lobby. First claim may adopt it: deno task worktree add MESITA-<id> --adopt ${relative(main, here.path)}`);
  lines.push(`host: ${env.host} (pinned in ~/.config/mesita/host-id; the claim line's host=)`);
  for (const n of await repairLobby(env, main, { apply: true })) lines.push(`shared checkout: ${n}`);
  const fleet = await inspect(env, main, await listFleet(env, main), { landed: true });
  lines.push(table(main, fleet, env.now()));
  const mine = fleet.filter((f) => f.issue && f.host === env.host && f.row.path !== main);
  lines.push(mine.length ? `resumable on this host: ${mine.map((f) => `${f.issue} at ${relative(main, f.row.path)}`).join("; ")}` : "resumable on this host: none");
  const sweepable = fleet.filter((f) => f.decision === "remove").length;
  lines.push(`sweepable: ${sweepable} (deno task worktree sweep --apply from the shared checkout)`);
  lines.push("next: one Linear read for live claims, then PICK");
  return lines;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

export const defaultRunner: Runner = async (cmd, args, opts) => {
  const c = new Deno.Command(cmd, { args, cwd: opts?.cwd, stdout: "piped", stderr: "piped" });
  const o = await c.output();
  const dec = new TextDecoder();
  return { code: o.code, stdout: dec.decode(o.stdout), stderr: dec.decode(o.stderr) };
};

/**
 * A stable four-hex host id. Deno.hostname() follows the DHCP name on macOS and changed twice
 * in one day (MESITA-1583), so the first value computed is pinned in $HOME/.config/mesita/host-id
 * and every later call returns the pinned one. A missing or unwritable home still hashes the
 * hostname, which joins consistently within one run.
 */
export async function hostHash(opts: { home?: string; hostname?: () => string } = {}): Promise<string> {
  const home = opts.home ?? Deno.env.get("HOME") ?? "";
  const dir = home ? `${home}/.config/mesita` : null;
  if (dir) {
    try {
      const saved = (await Deno.readTextFile(`${dir}/host-id`)).trim();
      if (/^[0-9a-f]{4}$/.test(saved)) return saved;
    } catch { /* first run on this machine */ }
  }
  let name = "unknown";
  try {
    name = (opts.hostname ?? Deno.hostname)();
  } catch { /* no --allow-sys; the hash of "unknown" still joins consistently on one machine */ }
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(name));
  const hash = Array.from(new Uint8Array(buf).slice(0, 2)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (dir) {
    try {
      await Deno.mkdir(dir, { recursive: true });
      await Deno.writeTextFile(`${dir}/host-id`, hash + "\n");
    } catch { /* read-only home: unpinned, same as before */ }
  }
  return hash;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export async function main(argv: string[], env: Env): Promise<number> {
  const [cmd, ...rest] = argv;
  try {
    switch (cmd) {
      case "boot":
        for (const l of await boot(env)) env.log(l);
        return 0;
      case "add": {
        const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--")));
        for (const l of await add(env, { id: positional[0] ?? "", slug: positional[1], platform: flag(rest, "--platform"), footprint: flag(rest, "--footprint"), adopt: flag(rest, "--adopt") })) env.log(l);
        return 0;
      }
      case "pr":
        for (const l of await pr(env)) env.log(l);
        return 0;
      case "remove":
        for (const l of await remove(env, rest[0] ?? "")) env.log(l);
        return 0;
      case "leave":
        for (const l of await leave(env, rest[0] ?? "")) env.log(l);
        return 0;
      case "sweep": {
        const r = await sweep(env, { apply: rest.includes("--apply") });
        for (const l of r.lines) env.log(l);
        env.log(`json: ${r.json}`);
        return 0;
      }
      case "repair-lobby": {
        const { main } = await mainWorktree(env);
        for (const l of await repairLobby(env, main, { apply: true })) env.log(l);
        return 0;
      }
      default:
        env.log("usage: worktree.ts boot | add MESITA-<id> [slug] [--platform t] [--footprint p] [--adopt path] | pr | remove MESITA-<id> | leave MESITA-<id> | sweep [--apply] | repair-lobby");
        return 2;
    }
  } catch (e) {
    if (e instanceof WtError) {
      env.log(e.message);
      return 1;
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (/refusing|worktree-isolated|stays inside the worktree/i.test(msg)) {
      env.log(`GUARD: ${msg.split("\n")[0]} — this session is inside an EnterWorktree-entered worktree, where git aimed elsewhere is blocked — run from the launch directory (I-3)`);
      return 1;
    }
    throw e;
  }
}

if (import.meta.main) {
  const env: Env = {
    runner: defaultRunner,
    now: () => new Date(),
    host: await hostHash(),
    cwd: Deno.cwd(),
    log: (l) => console.log(l),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
  Deno.exit(await main(Deno.args, env));
}
