// scripts/pipeline-audit.ts — the weekly pipeline sweep (MESITA-2391): the checks no PR can run.
//
//   deno task pipeline-audit                     audit origin/main; a markdown report on stdout
//   deno task pipeline-audit --ef-deploy <sha>   did every function <sha> changed redeploy after it?
//
// Every PR already runs the static gates: scripts/sync-rules.test.ts pins the one gating pattern,
// that each name in .github/required-checks.json is exactly one job, and that every PR job is
// required; sync-rules:check enforces the word budgets. What no PR can see is the live state
// those gates assume, so that is all this script reads:
//
//   required checks   the main-protection ruleset vs .github/required-checks.json
//   merged PRs        the last 5 merges: each passed every required check it owed
//   workflows         red on main, or red on half of the last 20 human PR runs
//   edge functions    cloud slugs vs folders on main; the last functions merge redeployed
//   bot PRs           Dependabot PRs open over 7 days (re-land the month's set under one issue)
//
// Exit 0: no finding outside scripts/pipeline-audit.accepted.json. Exit 1: an unaccepted
// finding, or a check that could not run. Exit 2: bad usage. A check whose call fails reports
// `unknown` with the endpoint, the HTTP status and the permission it needs, and fails the sweep:
// it never reports pass. .github/workflows/pipeline-audit.yml runs it every Monday, and
// `deno task boot` prints the age and result of the last run.
//
// The accepted file maps a finding code to { "reason": "...", "until": "YYYY-MM-DD" }. Past
// `until` the entry no longer accepts and is itself a finding; so is an entry whose finding no
// longer fires (delete it). A PA-UNKNOWN code cannot be accepted.

import { dirname, fromFileUrl, join } from "@std/path";

const repoRoot = dirname(dirname(fromFileUrl(import.meta.url)));

export const REPO = "Canzeco/mesita-monorepo";
export const SUPABASE_PROJECT = "yjalywfzdelacdzccpgb";
export const FUNCTIONS_PATH = "supabase/supabase/functions";
export const MAIN = "origin/main";
export const ACCEPTED_FILE = "scripts/pipeline-audit.accepted.json";
/** The sweep's own workflow: its last run is boot's line, not one of its findings. */
export const SELF = "pipeline-audit.yml";
export const MERGED_PRS = 5;
export const PR_RUNS = 20;
export const MIN_PR_RUNS = 4;
export const BOT_PR_DAYS = 7;
/** supabase-deploy deletes a retired function 3 days after its folder leaves main, and runs weekly. */
export const RETIRED_EF_DAYS = 10;
/** The Supabase integration deploys within minutes of a push to main; younger merges are not judged. */
export const DEPLOY_GRACE_MS = 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const RULESET = `repos/${REPO}/rules/branches/main`;
const PASSING = new Set(["success", "skipped", "neutral"]);
const DECISIVE = new Set(["success", "failure", "timed_out", "startup_failure"]);
const RED = new Set(["failure", "timed_out", "startup_failure"]);

// What each check needs, printed when it could not run. Metadata is readable by any token.
const NEEDS = {
  ruleset: "metadata: read",
  runs: "actions: read",
  pulls: "pull-requests: read",
  checks: "checks: read",
  functions: "SUPABASE_ACCESS_TOKEN, or `supabase login` locally",
  git: "a full clone of origin/main (actions/checkout fetch-depth: 0)",
};

// ── Types ───────────────────────────────────────────────────────────────────

export type Exec = { code: number; stdout: string; stderr: string };
export type Got = { ok: true; data: unknown } | { ok: false; status: number | null; message: string };

/** Everything the sweep reads, so the tests can drive every check from recorded responses. */
export type Io = {
  github: (path: string) => Promise<Got>;
  functions: () => Promise<Got>;
  git: (args: string[]) => Promise<Exec>;
  now: Date;
};

export type Finding = { code: string; detail: string };
export type Unknown = { endpoint: string; status: number | null; permission: string; message: string };
export type CheckId = "required-checks" | "merged-prs" | "workflows" | "edge-functions" | "bot-prs";
export type CheckResult = { check: CheckId; findings: Finding[]; notes: string[]; unknown?: Unknown };

export type Accepted = Record<string, { reason: string; until: string }>;
export type Row = { status: "fail" | "accepted" | "unknown"; code: string; detail: string };
export type Report = { head: string; rows: Row[]; notes: string[]; checks: CheckResult[]; failed: number };

type Run = { conclusion: string | null; event: string; created_at: string; html_url: string; actor?: { type?: string } };
type Pull = { number: number; title?: string; created_at: string; merge_commit_sha?: string | null; head: { sha: string }; user?: { login?: string; type?: string } };
type CheckRun = { id: number; name: string; status: string; conclusion: string | null; app?: { slug?: string } };
export type CloudFunction = { slug: string; version: number; updatedAt: number };

/** The code prefix each check owns; an accepted code outside it is invalid. */
export const CHECK_OF: Record<string, CheckId> = {
  "PA-MISSING-CHECK": "required-checks",
  "PA-NOT-ENFORCED": "required-checks",
  "PA-MERGED-WITHOUT": "merged-prs",
  "PA-NO-PR": "merged-prs",
  "PA-RED-MAIN": "workflows",
  "PA-RED-PR": "workflows",
  "PA-EF-DRIFT": "edge-functions",
  "PA-BOT-PR": "bot-prs",
};

// ── Reading ─────────────────────────────────────────────────────────────────

/** A call that failed: the check reports `unknown` instead of a verdict. */
class Blind extends Error {
  constructor(readonly unknown: Unknown) {
    super(unknown.message);
  }
}

async function gh(io: Io, path: string, permission: string): Promise<unknown> {
  const got = await io.github(path);
  if (!got.ok) throw new Blind({ endpoint: `GET /${path}`, status: got.status, permission, message: got.message });
  return got.data;
}

async function git(io: Io, args: string[]): Promise<string> {
  const r = await io.git(args);
  if (r.code !== 0) {
    throw new Blind({ endpoint: `git ${args.join(" ")}`, status: null, permission: NEEDS.git, message: firstLine(r.stderr) });
  }
  return r.stdout;
}

function firstLine(text: string): string {
  return text.trim().split("\n")[0]?.trim() || "(no message)";
}

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
const days = (ms: number) => Math.floor(ms / DAY_MS);

/** The names the ruleset requires, read from the rules the API says apply to main. */
export function rulesetChecks(rules: unknown): string[] {
  if (!Array.isArray(rules)) throw new Error(`${RULESET} did not return a list of rules`);
  return rules
    .filter((r) => r?.type === "required_status_checks")
    .flatMap((r) => (r.parameters?.required_status_checks ?? []) as { context: string }[])
    .map((c) => c.context);
}

export function parseRequired(text: string, where: string): string[] {
  const list = JSON.parse(text);
  if (!Array.isArray(list) || !list.every((n) => typeof n === "string")) {
    throw new Error(`${where} is not a JSON list of check names`);
  }
  return list;
}

/** .github/required-checks.json as of a commit; null when the file did not exist there yet. */
async function requiredAt(io: Io, rev: string): Promise<string[] | null> {
  const text = await fileAt(io, rev, ".github/required-checks.json");
  return text === null ? null : parseRequired(text, `.github/required-checks.json at ${rev.slice(0, 7)}`);
}

/** Every check run on a commit, past the 100 a page holds. */
async function checkRunsOf(io: Io, sha: string): Promise<CheckRun[]> {
  const runs: CheckRun[] = [];
  for (let page = 1; page <= 5; page++) {
    const data = await gh(io, `repos/${REPO}/commits/${sha}/check-runs?per_page=100&page=${page}`, NEEDS.checks) as { total_count: number; check_runs: CheckRun[] };
    runs.push(...data.check_runs);
    if (runs.length >= data.total_count || data.check_runs.length === 0) break;
  }
  return runs;
}

export function parseFunctions(data: unknown): CloudFunction[] {
  if (!Array.isArray(data)) throw new Error("the functions list is not a JSON list");
  return data.map((f) => {
    const updatedAt = typeof f.updated_at === "number" ? f.updated_at : Date.parse(f.updated_at);
    if (typeof f.slug !== "string" || Number.isNaN(updatedAt)) throw new Error(`unreadable function entry: ${JSON.stringify(f).slice(0, 120)}`);
    return { slug: f.slug, version: Number(f.version), updatedAt };
  });
}

async function cloudFunctions(io: Io): Promise<CloudFunction[]> {
  const got = await io.functions();
  if (!got.ok) {
    throw new Blind({ endpoint: `supabase functions list --project-ref ${SUPABASE_PROJECT}`, status: got.status, permission: NEEDS.functions, message: got.message });
  }
  return parseFunctions(got.data);
}

async function functionFolders(io: Io): Promise<string[]> {
  const folders = lines(await git(io, ["ls-tree", "-d", "--name-only", `${MAIN}:${FUNCTIONS_PATH}`])).filter((f) => f !== "_shared");
  if (folders.length === 0) throw new Error(`${MAIN} has no folders under ${FUNCTIONS_PATH}`);
  return folders;
}

// The Supabase integration redeploys a function only when its bundle changes (MESITA-2388's
// R2.0: a function importing supabase-js for types only kept its version through merges that
// redeployed all the others). So "the functions a commit changed" means the functions whose
// bundle holds a file it changed: index.ts and every file it reaches through runtime relative
// imports. `import type` and `export type` are erased before bundling; jsr:/npm: specifiers are
// not repo files. A line the pattern misreads only ever adds a file, never drops one.
const IMPORT_RE = /^\s*(?:import|export)\s+(type\s+)?[^;]*?\sfrom\s+["'](\.{1,2}\/[^"']+)["']|^\s*import\s+["'](\.{1,2}\/[^"']+)["']/gm;

export function runtimeImports(source: string): string[] {
  const specs: string[] = [];
  for (const m of source.matchAll(IMPORT_RE)) if (!m[1]) specs.push(m[2] ?? m[3]);
  return specs;
}

/** Every repo file a function's bundle holds, read through `read` (null: no such file). */
export async function bundleOf(entry: string, read: (path: string) => Promise<string | null>): Promise<Set<string>> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const path = stack.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const source = await read(path);
    if (source !== null) for (const spec of runtimeImports(source)) stack.push(join(dirname(path), spec));
  }
  return seen;
}

/** The functions whose bundle a commit changed, read as of that commit. */
export async function changedFunctions(io: Io, sha: string, folders: string[]): Promise<{ time: number; slugs: string[] }> {
  const time = Number((await git(io, ["show", "-s", "--format=%ct", sha])).trim()) * 1000;
  const changed = new Set(lines(await git(io, ["diff-tree", "--no-commit-id", "--name-only", "-r", sha, "--", FUNCTIONS_PATH])));
  if (changed.size === 0) return { time, slugs: [] };
  const files = new Map<string, Promise<string | null>>();
  const read = (path: string) => {
    if (!files.has(path)) files.set(path, fileAt(io, sha, path));
    return files.get(path)!;
  };
  const slugs: string[] = [];
  for (const slug of folders) {
    const bundle = await bundleOf(`${FUNCTIONS_PATH}/${slug}/index.ts`, read);
    if ([...bundle].some((p) => changed.has(p))) slugs.push(slug);
  }
  return { time, slugs };
}

async function fileAt(io: Io, rev: string, path: string): Promise<string | null> {
  const r = await io.git(["show", `${rev}:${path}`]);
  if (r.code === 0) return r.stdout;
  if (/does not exist|exists on disk, but not in/.test(r.stderr)) return null;
  throw new Blind({ endpoint: `git show ${rev.slice(0, 7)}:${path}`, status: null, permission: NEEDS.git, message: firstLine(r.stderr) });
}

// ── The checks ──────────────────────────────────────────────────────────────

/** What the ruleset enforces vs what the repo declares. sync-rules.test.ts pins the declared list to the jobs. */
async function checkRequired(io: Io): Promise<Omit<CheckResult, "check">> {
  const enforced = rulesetChecks(await gh(io, RULESET, NEEDS.ruleset));
  const declared = parseRequired(await git(io, ["show", `${MAIN}:.github/required-checks.json`]), ".github/required-checks.json");
  const findings: Finding[] = [];
  for (const name of enforced.filter((n) => !declared.includes(n))) {
    findings.push({ code: `PA-MISSING-CHECK:${name}`, detail: "the ruleset requires it, but .github/required-checks.json does not list it, so no PR job reports it and every PR waits on it: drop it from the ruleset or add the job" });
  }
  for (const name of declared.filter((n) => !enforced.includes(n))) {
    findings.push({ code: `PA-NOT-ENFORCED:${name}`, detail: "listed in .github/required-checks.json, but the main-protection ruleset does not require it, so a red run still merges: add it to the ruleset" });
  }
  return { findings, notes: [] };
}

/**
 * Each of the last merges passed every required check it owed. A name is owed when the ruleset
 * requires it now AND the merge's own .github/required-checks.json listed it, so a check added
 * later never fails an older PR. A miss means a bypass, or a check renamed under the ruleset.
 */
async function checkMerged(io: Io): Promise<Omit<CheckResult, "check">> {
  const enforced = rulesetChecks(await gh(io, RULESET, NEEDS.ruleset));
  const findings: Finding[] = [];
  const misses = new Map<string, string[]>();
  for (const sha of lines(await git(io, ["log", "--first-parent", `-n${MERGED_PRS}`, "--format=%H", MAIN]))) {
    const pulls = await gh(io, `repos/${REPO}/commits/${sha}/pulls`, NEEDS.pulls) as Pull[];
    const pr = pulls.find((p) => p.merge_commit_sha === sha);
    if (!pr) {
      findings.push({ code: `PA-NO-PR:${sha.slice(0, 7)}`, detail: `${sha.slice(0, 7)} is on main without a merged PR (I-2: main moves only by squash PR)` });
      continue;
    }
    const declared = await requiredAt(io, sha);
    const owed = enforced.filter((n) => declared?.includes(n));
    if (owed.length === 0) continue;
    const runs = (await checkRunsOf(io, pr.head.sha)).filter((r) => r.app?.slug === "github-actions");
    for (const name of owed) {
      const latest = runs.filter((r) => r.name === name).sort((a, b) => b.id - a.id)[0];
      const verdict = !latest ? "missing" : PASSING.has(latest.conclusion ?? "") ? null : latest.conclusion ?? latest.status;
      if (verdict) misses.set(name, [...(misses.get(name) ?? []), `#${pr.number} ${verdict}`]);
    }
  }
  for (const [name, prs] of misses) {
    findings.push({ code: `PA-MERGED-WITHOUT:${name}`, detail: `merged without this required check passing: ${prs.join(", ")}` });
  }
  return { findings, notes: [] };
}

/**
 * Red on main is red. On PRs, a failure is often the PR's own bug, so a workflow is flagged only
 * when half its recent human runs failed. Bot runs are left out: Dependabot fails the closes
 * check by design, and its PRs are the bot-prs check's business.
 */
async function checkWorkflows(io: Io): Promise<Omit<CheckResult, "check">> {
  const files = lines(await git(io, ["ls-tree", "--name-only", `${MAIN}:.github/workflows`]))
    .filter((f) => /\.ya?ml$/.test(f) && f !== SELF);
  const findings: Finding[] = [];
  const notes: string[] = [];
  for (const file of files) {
    const stem = file.replace(/\.ya?ml$/, "");
    const onMain = await gh(io, `repos/${REPO}/actions/workflows/${file}/runs?branch=main&status=completed&per_page=10`, NEEDS.runs) as { workflow_runs: Run[] };
    const last = onMain.workflow_runs.find((r) => r.event !== "pull_request" && DECISIVE.has(r.conclusion ?? ""));
    if (last && RED.has(last.conclusion!)) {
      findings.push({ code: `PA-RED-MAIN:${stem}`, detail: `its last run on main, ${last.created_at.slice(0, 10)}, ended ${last.conclusion}: ${last.html_url}` });
    }
    const onPrs = await gh(io, `repos/${REPO}/actions/workflows/${file}/runs?event=pull_request&status=completed&per_page=100`, NEEDS.runs) as { workflow_runs: Run[] };
    const human = onPrs.workflow_runs.filter((r) => r.actor?.type !== "Bot" && DECISIVE.has(r.conclusion ?? "")).slice(0, PR_RUNS);
    const red = human.filter((r) => RED.has(r.conclusion!));
    if (human.length >= MIN_PR_RUNS && red.length * 2 >= human.length) {
      findings.push({ code: `PA-RED-PR:${stem}`, detail: `${red.length} of its last ${human.length} PR runs failed (bot runs left out); latest: ${red[0].html_url}` });
    } else if (human.length < MIN_PR_RUNS && human.length > 0) {
      notes.push(`${stem}: ${human.length} human PR run(s), too few to judge`);
    }
  }
  return { findings, notes };
}

/** Cloud == repo (I-5): every folder deployed, every deployed slug a folder, the last merge live. */
async function checkFunctions(io: Io): Promise<Omit<CheckResult, "check">> {
  const cloud = await cloudFunctions(io);
  const folders = await functionFolders(io);
  const now = io.now.getTime();
  const findings: Finding[] = [];
  const notes: string[] = [];
  for (const fn of cloud.filter((f) => !folders.includes(f.slug))) {
    const deleted = (await git(io, ["log", "-1", "--no-renames", "--diff-filter=D", "--format=%ct", MAIN, "--", `${FUNCTIONS_PATH}/${fn.slug}`])).trim();
    if (!deleted) {
      findings.push({ code: `PA-EF-DRIFT:${fn.slug}`, detail: `deployed, but ${MAIN} never had its folder: it was deployed outside a merge` });
      continue;
    }
    const age = now - Number(deleted) * 1000;
    if (age > RETIRED_EF_DAYS * DAY_MS) {
      findings.push({ code: `PA-EF-DRIFT:${fn.slug}`, detail: `still deployed ${days(age)} days after its folder left main; supabase-deploy's cleanup deletes after 3 days and runs weekly, so read its runs` });
    } else {
      notes.push(`${fn.slug}: folder left main ${days(age)} day(s) ago; the cleanup deletes it after 3`);
    }
  }
  for (const slug of folders.filter((s) => !cloud.some((f) => f.slug === s))) {
    const added = Number((await git(io, ["log", "-1", "--format=%ct", MAIN, "--", `${FUNCTIONS_PATH}/${slug}`])).trim()) * 1000;
    if (now - added < DEPLOY_GRACE_MS) notes.push(`${slug}: merged under an hour ago, not judged yet`);
    else findings.push({ code: `PA-EF-DRIFT:${slug}`, detail: `a folder on main that is not deployed: the integration deploys only functions declared in supabase/supabase/config.toml` });
  }
  // The newest merge that changed a function's bundle (test files change none) must be live.
  const recent = lines(await git(io, ["log", "-10", "--format=%H", MAIN, "--", FUNCTIONS_PATH, `:(exclude,glob)${FUNCTIONS_PATH}/**/*.test.ts`]));
  for (const sha of recent) {
    const deploy = await deployRows(io, sha, cloud, folders);
    if (deploy.rows.length === 0) continue;
    if (now - deploy.time < DEPLOY_GRACE_MS) {
      notes.push(`the last functions merge, ${sha.slice(0, 7)}, is under an hour old; its deploy is not judged yet`);
    }
    for (const row of deploy.rows.filter((r) => r.deployed === false && now - deploy.time >= DEPLOY_GRACE_MS)) {
      findings.push({ code: `PA-EF-DRIFT:${row.slug}`, detail: `version ${row.version} updated ${new Date(row.updatedAt!).toISOString()}, before ${sha.slice(0, 7)} changed its bundle: that merge never reached the cloud` });
    }
    return { findings, notes };
  }
  notes.push("none of the last 10 functions merges changed a function's bundle");
  return { findings, notes };
}

async function checkBots(io: Io): Promise<Omit<CheckResult, "check">> {
  const open = await gh(io, `repos/${REPO}/pulls?state=open&per_page=100`, NEEDS.pulls) as Pull[];
  const findings: Finding[] = [];
  for (const pr of open.filter((p) => p.user?.type === "Bot")) {
    const age = io.now.getTime() - Date.parse(pr.created_at);
    if (age > BOT_PR_DAYS * DAY_MS) {
      findings.push({ code: `PA-BOT-PR:${pr.number}`, detail: `${pr.user?.login} PR open ${days(age)} days: ${pr.title ?? ""}. Re-land the month's set under one Linear issue, then close it` });
    }
  }
  return { findings, notes: [] };
}

// ── --ef-deploy ─────────────────────────────────────────────────────────────

export type DeployRow = { slug: string; version: number | null; updatedAt: number | null; deployed: boolean | null };

/** Each function a commit changed, its cloud version, and whether that version is newer than the commit. */
export async function deployRows(io: Io, sha: string, cloud: CloudFunction[], folders: string[]): Promise<{ time: number; rows: DeployRow[] }> {
  const { time, slugs } = await changedFunctions(io, sha, folders);
  const rows = slugs.map((slug): DeployRow => {
    const fn = cloud.find((f) => f.slug === slug);
    // A folder not deployed at all is the folder check's finding, not a lagging deploy.
    return fn ? { slug, version: fn.version, updatedAt: fn.updatedAt, deployed: fn.updatedAt >= time } : { slug, version: null, updatedAt: null, deployed: null };
  });
  return { time, rows };
}

export async function efDeploy(io: Io, sha: string): Promise<{ lines: string[]; ok: boolean }> {
  try {
    const cloud = await cloudFunctions(io);
    const { time, rows } = await deployRows(io, sha, cloud, await functionFolders(io));
    const out = [`functions changed by ${sha.slice(0, 7)} (merged ${new Date(time).toISOString()}): ${rows.length}`];
    for (const r of rows) {
      const state = r.deployed === null ? "NOT DEPLOYED" : r.deployed ? "redeployed after the merge" : "NOT redeployed since the merge";
      out.push(`  ${r.slug}: version ${r.version ?? "-"}, updated ${r.updatedAt ? new Date(r.updatedAt).toISOString() : "-"}, ${state}`);
    }
    return { lines: out, ok: rows.every((r) => r.deployed === true) };
  } catch (e) {
    return { lines: [`unknown: ${describeUnknown(asUnknown(e))}`], ok: false };
  }
}

// ── Judging ─────────────────────────────────────────────────────────────────

function asUnknown(e: unknown): Unknown {
  if (e instanceof Blind) return e.unknown;
  return { endpoint: "(reading the response)", status: null, permission: "-", message: e instanceof Error ? e.message : String(e) };
}

export function describeUnknown(u: Unknown): string {
  return `${u.endpoint} → ${u.status === null ? "no HTTP status" : `HTTP ${u.status}`}; needs ${u.permission}; ${u.message}`;
}

const CHECKS: [CheckId, (io: Io) => Promise<Omit<CheckResult, "check">>][] = [
  ["required-checks", checkRequired],
  ["merged-prs", checkMerged],
  ["workflows", checkWorkflows],
  ["edge-functions", checkFunctions],
  ["bot-prs", checkBots],
];

/** Read the accepted file. A malformed entry is a finding, never a silent acceptance. */
export function parseAccepted(raw: unknown): { entries: Accepted; problems: Finding[] } {
  const entries: Accepted = {};
  const problems: Finding[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { entries, problems: [{ code: "PA-ACCEPTED-INVALID:file", detail: `${ACCEPTED_FILE} must be one JSON object keyed by finding code` }] };
  }
  for (const [code, entry] of Object.entries(raw as Record<string, unknown>)) {
    const e = entry as { reason?: unknown; until?: unknown };
    const owner = CHECK_OF[code.split(":")[0]];
    const until = typeof e?.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.until) && !Number.isNaN(Date.parse(e.until)) ? e.until : null;
    if (!owner || !code.includes(":")) {
      problems.push({ code: `PA-ACCEPTED-INVALID:${code}`, detail: `not a code a check emits (prefixes: ${Object.keys(CHECK_OF).join(", ")}); PA-UNKNOWN is never accepted` });
    } else if (typeof e?.reason !== "string" || e.reason.trim() === "" || !until) {
      problems.push({ code: `PA-ACCEPTED-INVALID:${code}`, detail: `needs { "reason": "<why>", "until": "YYYY-MM-DD" }` });
    } else {
      entries[code] = { reason: e.reason, until };
    }
  }
  return { entries, problems };
}

/** An entry accepts through the end of its `until` day (UTC). */
function expired(until: string, now: Date): boolean {
  return now.getTime() >= Date.parse(until) + DAY_MS;
}

export function judge(checks: CheckResult[], accepted: Accepted, problems: Finding[], now: Date): Row[] {
  const rows: Row[] = [];
  for (const c of checks) {
    if (c.unknown) rows.push({ status: "unknown", code: `PA-UNKNOWN:${c.check}`, detail: describeUnknown(c.unknown) });
    for (const f of c.findings) {
      const a = accepted[f.code];
      if (a && !expired(a.until, now)) rows.push({ status: "accepted", code: f.code, detail: `${f.detail} (accepted to ${a.until}: ${a.reason})` });
      else rows.push({ status: "fail", code: f.code, detail: f.detail });
    }
  }
  const ran = new Set(checks.filter((c) => !c.unknown).map((c) => c.check));
  const fired = new Set(checks.flatMap((c) => c.findings.map((f) => f.code)));
  for (const [code, a] of Object.entries(accepted)) {
    if (expired(a.until, now)) {
      rows.push({ status: "fail", code: `PA-ACCEPTED-EXPIRED:${code}`, detail: `accepted to ${a.until}: fix it, or renew the entry with a new reason` });
    } else if (ran.has(CHECK_OF[code.split(":")[0]]) && !fired.has(code)) {
      rows.push({ status: "fail", code: `PA-ACCEPTED-STALE:${code}`, detail: `its finding no longer fires: delete the entry from ${ACCEPTED_FILE}` });
    }
  }
  for (const p of problems) rows.push({ status: "fail", ...p });
  return rows;
}

export async function audit(io: Io, rawAccepted: unknown): Promise<Report> {
  // One ruleset read serves two checks: memoize every GitHub call for the run.
  const memo = new Map<string, Promise<Got>>();
  const cached: Io = {
    ...io,
    github: (path) => {
      if (!memo.has(path)) memo.set(path, io.github(path));
      return memo.get(path)!;
    },
  };
  const head = (await cached.git(["rev-parse", "--short", MAIN])).stdout.trim() || "(unresolved)";
  const checks: CheckResult[] = [];
  for (const [check, fn] of CHECKS) {
    try {
      checks.push({ check, ...(await fn(cached)) });
    } catch (e) {
      checks.push({ check, findings: [], notes: [], unknown: asUnknown(e) });
    }
  }
  const { entries, problems } = parseAccepted(rawAccepted);
  const rows = judge(checks, entries, problems, io.now);
  return { head, rows, notes: checks.flatMap((c) => c.notes.map((n) => `${c.check}: ${n}`)), checks, failed: rows.filter((r) => r.status !== "accepted").length };
}

const cell = (s: string) => s.replaceAll("|", "\\|").replaceAll("\n", " ");

export function render(report: Report, now: Date, extraNotes: string[] = []): string {
  const unknown = report.rows.filter((r) => r.status === "unknown").length;
  const fails = report.rows.filter((r) => r.status === "fail").length;
  const out = [`## Pipeline audit · ${MAIN} ${report.head} · ${now.toISOString().slice(0, 10)}`, ""];
  out.push(report.failed === 0
    ? "**PASS**: no finding outside the accepted list."
    : `**FAIL**: ${fails} finding(s) to fix or accept, ${unknown} check(s) that could not run.`);
  out.push("");
  if (report.rows.length > 0) {
    out.push("| Result | Code | Detail |", "| --- | --- | --- |");
    for (const r of report.rows) out.push(`| ${r.status} | \`${cell(r.code)}\` | ${cell(r.detail)} |`);
    out.push("");
  }
  const verdict = (c: CheckResult) => c.unknown ? "unknown" : c.findings.length === 0 ? "ok" : `${c.findings.length} finding(s)`;
  out.push(`Checks: ${report.checks.map((c) => `${c.check} ${verdict(c)}`).join(" · ")}`);
  const notes = [...extraNotes, ...report.notes];
  if (notes.length > 0) out.push("", "Notes:", ...notes.map((n) => `- ${n}`));
  out.push("", `Accept a finding in \`${ACCEPTED_FILE}\` with a reason and an \`until\` date; a check that could not run is never accepted.`);
  return out.join("\n");
}

// ── CLI ─────────────────────────────────────────────────────────────────────

export const USAGE = "usage: deno task pipeline-audit [--ef-deploy <sha>]";

async function exec(cmd: string, args: string[], cwd: string): Promise<Exec> {
  try {
    const o = await new Deno.Command(cmd, { args, cwd, stdout: "piped", stderr: "piped" }).output();
    const dec = new TextDecoder();
    return { code: o.code, stdout: dec.decode(o.stdout), stderr: dec.decode(o.stderr) };
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return { code: 127, stdout: "", stderr: `${cmd} is not installed` };
    throw e;
  }
}

function json(r: Exec): Got {
  if (r.code !== 0) {
    const status = /HTTP (\d{3})/.exec(r.stderr)?.[1];
    return { ok: false, status: status ? Number(status) : null, message: firstLine(r.stderr) };
  }
  try {
    return { ok: true, data: JSON.parse(r.stdout) };
  } catch {
    return { ok: false, status: null, message: `not JSON: ${firstLine(r.stdout)}` };
  }
}

function liveIo(): Io {
  return {
    github: async (path) => json(await exec("gh", ["api", path], repoRoot)),
    functions: async () => json(await exec("supabase", ["functions", "list", "--project-ref", SUPABASE_PROJECT, "-o", "json"], join(repoRoot, "supabase"))),
    git: (args) => exec("git", args, repoRoot),
    now: new Date(),
  };
}

async function main(args: string[]): Promise<number> {
  const io = liveIo();
  const fetched = await io.git(["fetch", "--quiet", "origin", "main"]);
  const notes = fetched.code === 0 ? [] : [`git fetch origin main failed (${firstLine(fetched.stderr)}); audited the local ${MAIN}`];
  if (args.length === 2 && args[0] === "--ef-deploy" && /^[0-9a-f]{7,40}$/.test(args[1])) {
    const r = await efDeploy(io, args[1]);
    for (const l of [...notes, ...r.lines]) console.log(l);
    return r.ok ? 0 : 1;
  }
  if (args.length !== 0) {
    console.error(USAGE);
    return 2;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await Deno.readTextFile(join(repoRoot, ACCEPTED_FILE)));
  } catch (e) {
    raw = e instanceof Deno.errors.NotFound ? {} : null; // null: unreadable, reported as invalid
  }
  const report = await audit(io, raw);
  console.log(render(report, io.now, notes));
  return report.failed === 0 ? 0 : 1;
}

if (import.meta.main) Deno.exit(await main(Deno.args));
