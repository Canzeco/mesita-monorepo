// pipeline-audit.test.ts — the weekly sweep, driven from recorded responses (MESITA-2391).
//
// The world below is trimmed from what `gh api` and `supabase functions list -o json` returned
// on 2026-10-18. A clean world passes; each finding fails; an accepted finding passes; a call
// that fails, or answers in a shape the sweep cannot read, yields `unknown` and fails the sweep.
//
// Run: deno task test:rules   (CI: .github/workflows/rules.yml)

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { parse as parseYaml } from "@std/yaml";

import {
  ACCEPTED_FILE,
  audit,
  bundleOf,
  cliError,
  efDeploy,
  type Exec,
  FUNCTIONS_PATH,
  type Got,
  type Io,
  parseAccepted,
  render,
  type Report,
  runtimeImports,
} from "./pipeline-audit.ts";
import { GOOGLE_TYPE_SUPER } from "../supabase/supabase/functions/_shared/google-type-super.ts";

const repoRoot = dirname(dirname(fromFileUrl(import.meta.url)));
const NOW = new Date("2026-10-19T15:00:00Z");
const secs = (iso: string) => String(Date.parse(iso) / 1000);

// ── The recorded world ──────────────────────────────────────────────────────

type Run = { conclusion: string | null; event: string; created_at: string; html_url: string; actor: { type: string } };
type CheckRun = { id: number; name: string; status: string; conclusion: string | null; app: { slug: string } };
type Merge = { sha: string; pr: number | null; head: string; required: string[] | null; runs: CheckRun[] };

const REQUIRED = ["PR closes its issue", "deno check", "web-admin · lint · typecheck · test · build"];
const F = FUNCTIONS_PATH;
const T = Date.parse("2026-10-18T21:45:26Z"); // the last functions merge

const run = (conclusion: string | null, actor = "User", event = "pull_request", day = "2026-10-18"): Run => ({
  conclusion,
  event,
  created_at: `${day}T21:00:00Z`,
  html_url: `https://github.com/Canzeco/mesita-monorepo/actions/runs/${Math.floor(Math.random() * 1e9)}`,
  actor: { type: actor },
});
const check = (id: number, name: string, conclusion: string | null, app = "github-actions"): CheckRun => ({ id, name, status: "completed", conclusion, app: { slug: app } });
const passing = (from: number): CheckRun[] => [
  check(from, "PR closes its issue", "success"),
  check(from + 1, "deno check", "skipped"),
  check(from + 2, "web-admin · lint · typecheck · test · build", "success"),
  check(from + 3, "detect web changes", "success"),
  check(from + 4, "Vercel Preview Comments", "success", "vercel"),
];

function world() {
  return {
    ruleset: [...REQUIRED],
    required: [...REQUIRED],
    merges: [
      { sha: "0b374f125af50b693449fb70f6db8b204afa2d7f", pr: 2401, head: "31bf0413", required: [...REQUIRED], runs: passing(10) },
      { sha: "ff84fcf0cd67ea567fb865bebc11ed2a8b41d168", pr: 2386, head: "8c1d22aa", required: [...REQUIRED], runs: passing(20) },
    ] as Merge[],
    workflows: {
      "web.yml": { main: [run("cancelled", "User", "push"), run("success", "User", "push")], prs: [...Array(5)].map(() => run("success")).concat([run("failure", "Bot"), run("failure", "Bot")]) },
      // Dependabot fails the closes check by design: 13 of the 20 newest runs on 2026-10-18.
      "closes.yml": { main: [] as Run[], prs: [...Array(13)].map(() => run("failure", "Bot")).concat([...Array(7)].map(() => run("success"))) },
    } as Record<string, { main: Run[]; prs: Run[] }>,
    folders: ["admin-web-get-config", "enricher-edgefunc-sync-sources"],
    cloud: [
      { slug: "admin-web-get-config", version: 447, updated_at: T + 360_000, status: "ACTIVE" },
      // MESITA-2388's R2.0: imports _shared for types only, so the integration left it alone.
      { slug: "enricher-edgefunc-sync-sources", version: 68, updated_at: T - 1_582_000, status: "ACTIVE" },
    ],
    deletedAt: {} as Record<string, string>,
    touchedAt: {} as Record<string, string>,
    functionCommits: [
      {
        sha: "fcd50288ec53743c98bce2e3778dd18aea060fe1",
        time: T,
        changed: [`${F}/_shared/firecrawl-search.ts`, `${F}/_shared/leftover-efs.test.ts`],
        files: {
          [`${F}/admin-web-get-config/index.ts`]: 'import { serve } from "jsr:@std/http@1";\nimport {\n  search,\n} from "../_shared/firecrawl-search.ts";\n',
          [`${F}/enricher-edgefunc-sync-sources/index.ts`]: 'import type { Hit } from "../_shared/firecrawl-search.ts";\nimport { write } from "./write.ts";\n',
          [`${F}/enricher-edgefunc-sync-sources/write.ts`]: "export const write = 1;\n",
          [`${F}/_shared/firecrawl-search.ts`]: "export const search = 1;\n",
        } as Record<string, string>,
      },
    ],
    openPrs: [
      { number: 2400, created_at: "2026-10-17T21:46:41Z", user: { login: "dependabot[bot]", type: "Bot" }, title: "Bump vitest from 4.1.11 to 5.0.5" },
      { number: 2300, created_at: "2026-09-01T00:00:00Z", user: { login: "patocanz", type: "User" }, title: "a human draft" },
    ],
    failGithub: {} as Record<string, Got>,
    failFunctions: null as Got | null,
    rulesetBody: null as unknown,
    // The cloud catalog_membership as `supabase db query --linked -o json` lists it: one row per Google type, some enabled.
    membership: Object.keys(GOOGLE_TYPE_SUPER).sort().map((slug, i) => ({ slug, enabled: i % 2 === 0 })) as { slug: string; enabled: boolean }[],
    failSql: null as Got | null,
  };
}
type World = ReturnType<typeof world>;

const ok = (data: unknown): Got => ({ ok: true, data });
const out = (stdout: string): Exec => ({ code: 0, stdout, stderr: "" });
const missing = (what: string): Exec => ({ code: 128, stdout: "", stderr: `fatal: path '${what}' does not exist in 'x'` });

function ioFor(w: World): Io & { calls: string[] } {
  const calls: string[] = [];
  const repo = "repos/Canzeco/mesita-monorepo";
  const github = (path: string): Promise<Got> => {
    calls.push(path);
    if (w.failGithub[path]) return Promise.resolve(w.failGithub[path]);
    let m: RegExpExecArray | null;
    if (path === `${repo}/rules/branches/main`) {
      return Promise.resolve(ok(w.rulesetBody ?? [
        { type: "deletion", ruleset_id: 20920166 },
        { type: "required_status_checks", ruleset_id: 20920166, parameters: { strict_required_status_checks_policy: false, required_status_checks: w.ruleset.map((context) => ({ context })) } },
      ]));
    }
    if ((m = /^repos\/Canzeco\/mesita-monorepo\/commits\/(\w+)\/pulls$/.exec(path))) {
      const merge = w.merges.find((x) => x.sha === m![1])!;
      return Promise.resolve(ok(merge.pr === null ? [] : [{ number: merge.pr, merge_commit_sha: merge.sha, head: { sha: merge.head }, created_at: "2026-10-18T21:00:00Z" }]));
    }
    if ((m = /^repos\/Canzeco\/mesita-monorepo\/contents\/\.github\/required-checks\.json\?ref=(\w+)$/.exec(path))) {
      // The contents API answers base64 of the file's UTF-8 bytes, wrapped at 60 characters.
      const declared = w.merges.find((x) => x.head === m![1])!.required;
      if (declared === null) return Promise.resolve({ ok: false, status: 404, message: "gh: Not Found (HTTP 404)" });
      const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(declared, null, 2))));
      return Promise.resolve(ok({ encoding: "base64", content: b64.replace(/(.{60})/g, "$1\n") }));
    }
    if ((m = /^repos\/Canzeco\/mesita-monorepo\/commits\/(\w+)\/check-runs\?per_page=100&page=1$/.exec(path))) {
      const runs = w.merges.find((x) => x.head === m![1])!.runs;
      return Promise.resolve(ok({ total_count: runs.length, check_runs: runs }));
    }
    if ((m = /^repos\/Canzeco\/mesita-monorepo\/actions\/workflows\/([^/]+)\/runs\?(\w+)=/.exec(path))) {
      const wf = w.workflows[m[1]];
      return Promise.resolve(wf ? ok({ total_count: 0, workflow_runs: m[2] === "branch" ? wf.main : wf.prs }) : { ok: false, status: 404, message: "gh: Not Found (HTTP 404)" });
    }
    if (path === `${repo}/pulls?state=open&per_page=100`) return Promise.resolve(ok(w.openPrs));
    return Promise.resolve({ ok: false, status: 404, message: `unexpected call ${path}` });
  };
  const git = (args: string[]): Promise<Exec> => {
    const a = args.join(" ");
    calls.push(`git ${a}`);
    let m: RegExpExecArray | null;
    if (a === "rev-parse --short origin/main") return Promise.resolve(out("0b374f12\n"));
    if (a === "show origin/main:.github/required-checks.json") return Promise.resolve(out(JSON.stringify(w.required)));
    if (a === "log --first-parent -n5 --format=%H origin/main") return Promise.resolve(out(w.merges.map((x) => x.sha).join("\n") + "\n"));
    if (a === "ls-tree --name-only origin/main:.github/workflows") return Promise.resolve(out([...Object.keys(w.workflows), "pipeline-audit.yml"].join("\n")));
    if (a === `ls-tree -d --name-only origin/main:${F}`) return Promise.resolve(out(["_shared", ...w.folders].join("\n")));
    if ((m = new RegExp(`^log -1 --no-renames --diff-filter=D --format=%ct origin/main -- ${F}/(.+)$`).exec(a))) {
      return Promise.resolve(out(w.deletedAt[m[1]] ? `${secs(w.deletedAt[m[1]])}\n` : ""));
    }
    if ((m = new RegExp(`^log -1 --format=%ct origin/main -- ${F}/(.+)$`).exec(a))) {
      return Promise.resolve(out(`${secs(w.touchedAt[m[1]] ?? "2026-10-01T00:00:00Z")}\n`));
    }
    if (a.startsWith(`log -10 --format=%H origin/main -- ${F} `)) return Promise.resolve(out(w.functionCommits.map((c) => c.sha).join("\n")));
    if ((m = /^show -s --format=%ct (\w+)$/.exec(a))) return Promise.resolve(out(`${w.functionCommits.find((c) => c.sha === m![1])!.time / 1000}\n`));
    if ((m = /^diff-tree --no-commit-id --name-only -r (\w+) -- /.exec(a))) return Promise.resolve(out(w.functionCommits.find((c) => c.sha === m![1])!.changed.join("\n")));
    if ((m = /^show (\w+):(.+)$/.exec(a))) {
      const text = w.functionCommits.find((c) => c.sha === m![1])?.files[m[2]];
      return Promise.resolve(text === undefined ? missing(m[2]) : out(text));
    }
    return Promise.resolve({ code: 1, stdout: "", stderr: `unexpected git call: ${a}` });
  };
  const functions = () => Promise.resolve(w.failFunctions ?? ok(w.cloud));
  const sql = () => Promise.resolve(w.failSql ?? ok(w.membership));
  return { github, git, functions, sql, now: NOW, calls };
}

const codes = (r: Report, status?: string) => r.rows.filter((x) => !status || x.status === status).map((x) => x.code);

// ── A clean pipeline ────────────────────────────────────────────────────────

Deno.test("a clean pipeline passes, and every check ran", async () => {
  const r = await audit(ioFor(world()), {});
  assertEquals(r.rows, [], JSON.stringify(r.rows, null, 2));
  assertEquals(r.failed, 0);
  assertEquals(r.checks.map((c) => [c.check, c.unknown === undefined]), [
    ["required-checks", true],
    ["merged-prs", true],
    ["workflows", true],
    ["edge-functions", true],
    ["bot-prs", true],
    ["catalog-membership", true],
  ]);
  assertStringIncludes(render(r, NOW), "**PASS**");
});

Deno.test("bot PR runs and a gate job, Vercel or a cancelled run never count against a check", async () => {
  // closes.yml is red on 13 of its 20 newest PR runs, all Dependabot; web.yml's newest main run was cancelled.
  const r = await audit(ioFor(world()), {});
  assertEquals(codes(r), []);
});

Deno.test("the sweep never judges its own workflow", async () => {
  const io = ioFor(world());
  await audit(io, {});
  assert(!io.calls.some((c) => c.includes("pipeline-audit.yml")), "pipeline-audit.yml was read");
});

// ── Each finding fails ──────────────────────────────────────────────────────

const CASES: [string, (w: World) => void, string][] = [
  ["the ruleset requires a name no job reports", (w) => w.ruleset.push("Cursor Bugbot"), "PA-MISSING-CHECK:Cursor Bugbot"],
  ["a declared check the ruleset does not enforce", (w) => (w.ruleset = w.ruleset.filter((n) => n !== "deno check")), "PA-NOT-ENFORCED:deno check"],
  ["a merge whose required check never reported", (w) => (w.merges[1].runs = w.merges[1].runs.filter((c) => c.name !== "deno check")), "PA-MERGED-WITHOUT:deno check"],
  // A name with `·`: a branch file decoded byte by byte would match no ruleset name and owe nothing.
  ["a merge whose lane check never reported", (w) => (w.merges[1].runs = w.merges[1].runs.filter((c) => !c.name.startsWith("web-admin"))), "PA-MERGED-WITHOUT:web-admin · lint · typecheck · test · build"],
  ["a merge whose required check's latest run failed", (w) => w.merges[0].runs.push(check(99, "PR closes its issue", "failure")), "PA-MERGED-WITHOUT:PR closes its issue"],
  ["a commit on main with no PR", (w) => (w.merges[1].pr = null), "PA-NO-PR:ff84fcf"],
  ["a workflow red on main", (w) => w.workflows["web.yml"].main.splice(1, 0, run("failure", "User", "push")), "PA-RED-MAIN:web"],
  ["a workflow red on half its human PR runs", (w) => w.workflows["web.yml"].prs.splice(0, 3, run("failure"), run("timed_out"), run("failure")), "PA-RED-PR:web"],
  ["a deployed function main never had", (w) => w.cloud.push({ slug: "admin-web-ghost", version: 1, updated_at: T, status: "ACTIVE" }), "PA-EF-DRIFT:admin-web-ghost"],
  ["a retired function the cleanup never deleted", (w) => {
    w.cloud.push({ slug: "admin-web-old", version: 9, updated_at: T, status: "ACTIVE" });
    w.deletedAt["admin-web-old"] = "2026-10-05T00:00:00Z";
  }, "PA-EF-DRIFT:admin-web-old"],
  ["a folder on main that is not deployed", (w) => w.folders.push("consumer-web-new"), "PA-EF-DRIFT:consumer-web-new"],
  ["a function whose bundle changed and did not redeploy", (w) => (w.cloud[0].updated_at = T - 60_000), "PA-EF-DRIFT:admin-web-get-config"],
  ["a bot PR open over 7 days", (w) => (w.openPrs[0].created_at = "2026-10-11T00:00:00Z"), "PA-BOT-PR:2400"],
  // MESITA-2759: an admin Reset emptied the table and Create refused most restaurants.
  ["an empty catalog_membership in the cloud", (w) => (w.membership = []), "PA-MEMBERSHIP-DRIFT:empty"],
  ["a catalog_membership with nothing enabled", (w) => w.membership.forEach((r) => (r.enabled = false)), "PA-MEMBERSHIP-DRIFT:none-enabled"],
  ["a Google type missing from the cloud", (w) => (w.membership = w.membership.filter((r) => r.slug !== "restaurant")), "PA-MEMBERSHIP-DRIFT:count"],
];

for (const [name, mutate, code] of CASES) {
  Deno.test(`fails on ${name}: ${code}`, async () => {
    const w = world();
    mutate(w);
    const r = await audit(ioFor(w), {});
    assertEquals(codes(r), [code], JSON.stringify(r.rows, null, 2));
    assertEquals(r.rows[0].status, "fail");
    assertEquals(r.failed, 1);
    assertStringIncludes(render(r, NOW), "**FAIL**");
  });
}

// ── What does not count ─────────────────────────────────────────────────────

Deno.test("a merge owes only the checks its own branch declared", async () => {
  const w = world();
  // #2401's branch was cut before web-admin's check existed. #2386 (2026-10-18) merged two minutes
  // after main created the file, from a branch that never had it: it ran none of those jobs.
  w.merges[0].required = REQUIRED.filter((n) => !n.startsWith("web-admin"));
  w.merges[0].runs = w.merges[0].runs.filter((c) => !c.name.startsWith("web-admin"));
  w.merges[1].required = null;
  w.merges[1].runs = [];
  assertEquals(codes(await audit(ioFor(w), {})), []);
});

// MESITA-2781: the first CI run's real stderr, trimmed. The report showed only the WARN.
Deno.test("a failed CLI call reports the CLI's error, not the WARN and stack noise around it", () => {
  const stderr = [
    "WARN: environment variable is unset: TWILIO_AUTH_TOKEN",
    "github.com/supabase/cli/internal/utils/flags/db_url.go:154 (0x100e4db6c)",
    "runtime/asm_arm64.s:1268 (0x10021ad14)",
    "",
    "IPv6 is not supported on your current network: dial tcp [2600:1f14:b9e:7b00:2073:c663:6dbb:7c18]:5432: connect: no route to host",
    "Run supabase link --project-ref yjalywfzdelacdzccpgb to setup IPv4 connection.",
  ].join("\n");
  const message = cliError(stderr);
  assertStringIncludes(message, "IPv6 is not supported on your current network");
  assert(!message.includes("WARN") && !message.includes("0x"), message);
});

Deno.test("a membership query that fails is unknown and names what it needs", async () => {
  const w = world();
  w.failSql = { ok: false, status: null, message: "Cannot find project ref. Have you run supabase link?" };
  const r = await audit(ioFor(w), {});
  assertEquals(codes(r), ["PA-UNKNOWN:catalog-membership"]);
  assertStringIncludes(r.rows[0].detail, "supabase/supabase/.temp/project-ref");
});

Deno.test("a branch file the API cannot read is unknown, not owed-nothing", async () => {
  const w = world();
  w.failGithub["repos/Canzeco/mesita-monorepo/contents/.github/required-checks.json?ref=8c1d22aa"] = { ok: false, status: 403, message: "gh: Resource not accessible by integration (HTTP 403)" };
  const r = await audit(ioFor(w), {});
  assertEquals(codes(r), ["PA-UNKNOWN:merged-prs"]);
  assertStringIncludes(r.rows[0].detail, "needs contents: read");
});

Deno.test("a function imported for types only did not change when its import did", async () => {
  // sync-sources sits 26 minutes behind the merge: correct, its bundle never changed (R2.0).
  const r = await audit(ioFor(world()), {});
  assertEquals(codes(r), []);
  const lag = await efDeploy(ioFor(world()), "fcd50288ec53743c98bce2e3778dd18aea060fe1");
  assertEquals(lag.ok, true);
  assertEquals(lag.lines.length, 2, lag.lines.join("\n"));
  assertStringIncludes(lag.lines[1], "admin-web-get-config: version 447");
});

Deno.test("--ef-deploy fails on a changed function that did not redeploy", async () => {
  const w = world();
  w.cloud[0].updated_at = T - 60_000;
  const r = await efDeploy(ioFor(w), "fcd50288ec53743c98bce2e3778dd18aea060fe1");
  assertEquals(r.ok, false);
  assertStringIncludes(r.lines.join("\n"), "admin-web-get-config: version 447, updated 2026-10-18T21:44:26.000Z, NOT redeployed since the merge");
});

Deno.test("windows: a retired slug inside 10 days, a folder or a merge under an hour, too few PR runs are notes", async () => {
  const w = world();
  w.cloud.push({ slug: "admin-web-old", version: 9, updated_at: T, status: "ACTIVE" });
  w.deletedAt["admin-web-old"] = "2026-10-17T00:00:00Z";
  w.folders.push("consumer-web-new");
  w.touchedAt["consumer-web-new"] = "2026-10-19T14:30:00Z";
  w.workflows["closes.yml"].prs = [run("failure"), run("failure"), run("success")];
  const r = await audit(ioFor(w), {});
  assertEquals(codes(r), []);
  assertEquals(r.notes.length, 3, r.notes.join("\n"));
  const young = world();
  young.cloud[0].updated_at = T - 60_000;
  const io = { ...ioFor(young), now: new Date(T + 30 * 60_000) };
  const r2 = await audit(io, {});
  assertEquals(codes(r2), []);
  assertStringIncludes(r2.notes.join("\n"), "under an hour old");
});

// ── Accepted findings ───────────────────────────────────────────────────────

function withBotPr(): World {
  const w = world();
  w.openPrs[0].created_at = "2026-10-01T00:00:00Z";
  return w;
}

Deno.test("an accepted finding passes through the end of its until day", async () => {
  for (const until of ["2026-10-31", "2026-10-19"]) {
    const r = await audit(ioFor(withBotPr()), { "PA-BOT-PR:2400": { reason: "the October set re-lands under MESITA-2400", until } });
    assertEquals(r.failed, 0, until);
    assertEquals(r.rows.map((x) => x.status), ["accepted"]);
    assertStringIncludes(render(r, NOW), "**PASS**");
  }
});

Deno.test("past its until date an entry no longer accepts, and is itself a finding", async () => {
  const r = await audit(ioFor(withBotPr()), { "PA-BOT-PR:2400": { reason: "r", until: "2026-10-18" } });
  assertEquals(codes(r, "fail"), ["PA-BOT-PR:2400", "PA-ACCEPTED-EXPIRED:PA-BOT-PR:2400"]);
});

Deno.test("an entry whose finding no longer fires is stale, unless its check could not run", async () => {
  const stale = await audit(ioFor(world()), { "PA-BOT-PR:2400": { reason: "r", until: "2026-10-31" } });
  assertEquals(codes(stale), ["PA-ACCEPTED-STALE:PA-BOT-PR:2400"]);
  const w = world();
  w.failGithub["repos/Canzeco/mesita-monorepo/pulls?state=open&per_page=100"] = { ok: false, status: 502, message: "gh: Bad Gateway (HTTP 502)" };
  const blind = await audit(ioFor(w), { "PA-BOT-PR:2400": { reason: "r", until: "2026-10-31" } });
  assertEquals(codes(blind), ["PA-UNKNOWN:bot-prs"]);
});

Deno.test("a malformed entry, or one for a code no check emits, is a finding, never an acceptance", () => {
  assertEquals(parseAccepted({ "PA-UNKNOWN:workflows": { reason: "r", until: "2026-10-31" } }).problems.map((p) => p.code), ["PA-ACCEPTED-INVALID:PA-UNKNOWN:workflows"]);
  assertEquals(parseAccepted({ "PA-BOT-PR:1": { reason: "r" } }).problems.map((p) => p.code), ["PA-ACCEPTED-INVALID:PA-BOT-PR:1"]);
  assertEquals(parseAccepted({ "PA-BOT-PR:1": { reason: " ", until: "2026-10-31" } }).problems.length, 1);
  assertEquals(parseAccepted({ "PA-BOT-PR:1": { reason: "r", until: "31/10/2026" } }).problems.length, 1);
  assertEquals(parseAccepted([]).problems.map((p) => p.code), ["PA-ACCEPTED-INVALID:file"]);
  assertEquals(parseAccepted(null).problems.map((p) => p.code), ["PA-ACCEPTED-INVALID:file"]);
  assertEquals(parseAccepted({}).problems, []);
});

Deno.test("the shipped accepted file parses", async () => {
  // Shape only: asserting no entry has expired would fail CI on a calendar date.
  const raw = JSON.parse(await Deno.readTextFile(join(repoRoot, ACCEPTED_FILE)));
  assertEquals(parseAccepted(raw).problems, []);
});

// ── Unknown never passes ────────────────────────────────────────────────────

Deno.test("a failed call is unknown: the endpoint, the status and the permission, and the sweep fails", async () => {
  const w = world();
  w.failGithub["repos/Canzeco/mesita-monorepo/rules/branches/main"] = { ok: false, status: 403, message: "gh: Resource not accessible by integration (HTTP 403)" };
  const r = await audit(ioFor(w), {});
  // One ruleset read serves both checks, so both are blind.
  assertEquals(codes(r), ["PA-UNKNOWN:required-checks", "PA-UNKNOWN:merged-prs"]);
  assertEquals(r.rows[0].status, "unknown");
  assertEquals(r.rows[0].detail, "GET /repos/Canzeco/mesita-monorepo/rules/branches/main → HTTP 403; needs metadata: read; gh: Resource not accessible by integration (HTTP 403)");
  assertEquals(r.failed, 2);
  assertStringIncludes(render(r, NOW), "2 check(s) that could not run");
});

Deno.test("an unknown is not acceptable, even when its code is in the accepted file", async () => {
  const w = world();
  w.failFunctions = { ok: false, status: null, message: "Access token not provided. Supply an access token by running supabase login" };
  const r = await audit(ioFor(w), { "PA-UNKNOWN:edge-functions": { reason: "r", until: "2026-10-31" } });
  assertEquals(codes(r), ["PA-UNKNOWN:edge-functions", "PA-ACCEPTED-INVALID:PA-UNKNOWN:edge-functions"]);
  assertStringIncludes(r.rows[0].detail, "needs SUPABASE_ACCESS_TOKEN");
});

Deno.test("a response in a shape the sweep cannot read is unknown, not pass", async () => {
  const w = world();
  w.rulesetBody = { message: "Moved Permanently" };
  const r = await audit(ioFor(w), {});
  assertEquals(codes(r), ["PA-UNKNOWN:required-checks", "PA-UNKNOWN:merged-prs"]);
  const g = world();
  g.cloud = [{ slug: 42 }] as never;
  assertEquals(codes(await audit(ioFor(g), {})), ["PA-UNKNOWN:edge-functions"]);
});

Deno.test("a git failure is unknown too: a shallow clone cannot date a folder", async () => {
  const w = world();
  const io = ioFor(w);
  const r = await audit({ ...io, git: (args) => args[0] === "ls-tree" && args[1] === "-d" ? Promise.resolve({ code: 128, stdout: "", stderr: "fatal: not a valid object name origin/main" }) : io.git(args) }, {});
  assertEquals(codes(r), ["PA-UNKNOWN:edge-functions"]);
  assertStringIncludes(r.rows[0].detail, "fetch-depth: 0");
});

// ── Bundles ─────────────────────────────────────────────────────────────────

Deno.test("runtimeImports keeps what reaches the bundle and drops what types erase", () => {
  const source = [
    'import { a } from "./a.ts";',
    "import {",
    "  b,",
    '} from "../_shared/b.ts";',
    'import type { C } from "../_shared/c.ts";',
    'export type { D } from "./d.ts";',
    'export * from "./e.ts";',
    'import "./f.ts";',
    'import { createClient } from "jsr:@supabase/supabase-js@2";',
    '// import { g } from "./g.ts";',
  ].join("\n");
  assertEquals(runtimeImports(source), ["./a.ts", "../_shared/b.ts", "./e.ts", "./f.ts"]);
});

Deno.test("bundleOf follows imports across folders, once each, and stops at a missing file", async () => {
  const files: Record<string, string> = {
    "fn/x/index.ts": 'import { s } from "../_shared/s.ts";\nimport { h } from "./h.ts";\n',
    "fn/x/h.ts": 'import { s } from "../_shared/s.ts";\n',
    "fn/_shared/s.ts": 'import { gone } from "./gone.ts";\n',
  };
  const reads: string[] = [];
  const bundle = await bundleOf("fn/x/index.ts", (p) => {
    reads.push(p);
    return Promise.resolve(files[p] ?? null);
  });
  assertEquals([...bundle].sort(), ["fn/_shared/gone.ts", "fn/_shared/s.ts", "fn/x/h.ts", "fn/x/index.ts"]);
  assertEquals(reads.length, 4);
});

// ── The workflow ────────────────────────────────────────────────────────────

Deno.test("the workflow runs weekly and on dispatch, on main only, with its permissions spelled out", async () => {
  const doc = parseYaml(await Deno.readTextFile(join(repoRoot, ".github", "workflows", "pipeline-audit.yml"))) as {
    on: { schedule: { cron: string }[]; workflow_dispatch: unknown };
    permissions: Record<string, string>;
    jobs: Record<string, { if?: string; steps: { run?: string; env?: Record<string, string> }[] }>;
  };
  assertEquals(doc.on.schedule, [{ cron: "0 15 * * 1" }]);
  assert("workflow_dispatch" in doc.on);
  assertEquals(doc.permissions, { contents: "read", actions: "read", checks: "read", "pull-requests": "read" });
  const [job] = Object.values(doc.jobs);
  assertEquals(job.if, "github.ref == 'refs/heads/main'");
  const audit = job.steps.find((s) => s.run?.includes("deno task pipeline-audit"));
  assert(audit, "no step runs deno task pipeline-audit");
  assertStringIncludes(audit.run!, "set -o pipefail");
  assertEquals(Object.keys(audit.env ?? {}).sort(), ["GH_TOKEN", "SUPABASE_ACCESS_TOKEN"]);
  const tasks = JSON.parse(await Deno.readTextFile(join(repoRoot, "deno.json"))).tasks;
  assertStringIncludes(tasks["pipeline-audit"], "scripts/pipeline-audit.ts");
  assertStringIncludes(tasks["test:rules"], "scripts/pipeline-audit.test.ts");
});
