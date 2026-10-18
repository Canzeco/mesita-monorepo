// The cloud half of every Edge Function retirement.
//
// Deploying only adds, so a function whose folder left main stays callable
// until supabase/scripts/cleanup-retired-efs.sh deletes its slug
// (.github/workflows/supabase-deploy.yml runs it on main). These tests run
// the real script against throwaway git repos and a fake `supabase` CLI, and
// pin every guard that stands between a merge and a deleted live function:
// the 3-day wait, the folder floor, the cap, the fresh fetch before each
// delete, whole-slug matching, and the "does not exist" tolerance.

import { assert, assertEquals, assertMatch, assertStringIncludes } from "jsr:@std/assert@1";

const SCRIPT = new URL("../../../scripts/cleanup-retired-efs.sh", import.meta.url).pathname;
const WORKFLOW = new URL("../../../../.github/workflows/supabase-deploy.yml", import.meta.url);
const FUNCTIONS = "supabase/supabase/functions";
const DAY = 86_400;
const NOW = Math.floor(Date.now() / 1000);

// Throwaway repos must not read the developer's git config (signing, hooks).
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

const FAKE_SUPABASE = `#!/usr/bin/env bash
echo "$*" >> "$FAKE_CALLS"
case "$1 $2" in
  "functions list")
    if [ -n "\${FAKE_LIST_FAIL:-}" ]; then echo "list failed" >&2; exit 1; fi
    if [ -n "\${FAKE_ON_LIST:-}" ]; then bash -c "$FAKE_ON_LIST" >/dev/null 2>&1; fi
    cat "$FAKE_LIST" ;;
  "functions delete")
    if grep -Fxq -- "$3" "$FAKE_GONE"; then
      echo "Function $3 does not exist on the Supabase project" >&2; exit 1
    fi
    if grep -Fxq -- "$3" "$FAKE_BROKEN"; then echo "unexpected delete function status 500" >&2; exit 1; fi
    echo "Deleted Function $3 from project $5." ;;
  *) echo "fake supabase: unexpected $*" >&2; exit 3 ;;
esac
`;

async function sh(cwd: string, cmd: string, args: string[], env: Record<string, string> = {}) {
  const out = await new Deno.Command(cmd, { args, cwd, env: { ...GIT_ENV, ...env }, stdout: "piped", stderr: "piped" })
    .output();
  const text = new TextDecoder().decode(out.stdout) + new TextDecoder().decode(out.stderr);
  if (!out.success) throw new Error(`${cmd} ${args.join(" ")} failed: ${text}`);
  return text.trim();
}

function at(daysAgo: number) {
  const date = `@${NOW - Math.round(daysAgo * DAY)} +0000`;
  return { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
}

const LIVE = Array.from({ length: 30 }, (_, i) => `admin-web-live-${String(i + 1).padStart(2, "0")}`);

interface Setup {
  live?: string[];
  retired?: Array<[slug: string, daysAgo: number]>;
  cloud: string[];
  gone?: string[];
  broken?: string[];
  shallow?: boolean;
  noFunctionsDir?: boolean;
}

interface Fixture {
  dir: string;
  seed: string;
  work: string;
  origin: string;
  env: Record<string, string>;
}

// seed: where history is written · origin.git: what `origin main` resolves to ·
// work: the checkout the script runs in (a clone, so origin/main is real).
async function fixture(s: Setup): Promise<Fixture> {
  const dir = await Deno.makeTempDir({ prefix: "cleanup-efs-" });
  const seed = `${dir}/seed`, origin = `${dir}/origin.git`, work = `${dir}/work`, bin = `${dir}/bin`;
  await sh(dir, "git", ["init", "-q", "-b", "main", seed]);
  const retired = [...(s.retired ?? [])].sort((a, b) => b[1] - a[1]);
  const folders = s.noFunctionsDir ? [] : [...(s.live ?? LIVE), ...retired.map(([slug]) => slug), "_shared"];
  await Deno.mkdir(`${seed}/supabase`, { recursive: true });
  await Deno.writeTextFile(`${seed}/supabase/.keep`, "");
  for (const f of folders) {
    await Deno.mkdir(`${seed}/${FUNCTIONS}/${f}`, { recursive: true });
    await Deno.writeTextFile(`${seed}/${FUNCTIONS}/${f}/index.ts`, `// ${f}\n`);
  }
  await sh(seed, "git", ["add", "-A"]);
  await sh(seed, "git", ["commit", "-q", "-m", "functions"], at(30));
  for (const [slug, daysAgo] of retired) {
    await sh(seed, "git", ["rm", "-q", "-r", `${FUNCTIONS}/${slug}`]);
    await sh(seed, "git", ["commit", "-q", "-m", `retire ${slug}`], at(daysAgo));
  }
  await sh(dir, "git", ["init", "-q", "--bare", "-b", "main", origin]);
  await sh(seed, "git", ["remote", "add", "origin", origin]);
  await sh(seed, "git", ["push", "-q", "origin", "main"]);
  await sh(dir, "git", ["clone", "-q", ...(s.shallow ? ["--depth", "1"] : []), `file://${origin}`, work]);

  await Deno.mkdir(bin);
  await Deno.writeTextFile(`${bin}/supabase`, FAKE_SUPABASE, { mode: 0o755 });
  const write = async (name: string, text: string) => {
    await Deno.writeTextFile(`${dir}/${name}`, text);
    return `${dir}/${name}`;
  };
  const env = {
    PATH: `${bin}:${Deno.env.get("PATH")}`,
    FAKE_LIST: await write("list.json", JSON.stringify(s.cloud.map((slug) => ({ slug, status: "ACTIVE" })))),
    FAKE_GONE: await write("gone.txt", (s.gone ?? []).map((g) => `${g}\n`).join("")),
    FAKE_BROKEN: await write("broken.txt", (s.broken ?? []).map((g) => `${g}\n`).join("")),
    FAKE_CALLS: await write("calls.txt", ""),
    GITHUB_STEP_SUMMARY: await write("summary.md", ""),
    CLEANUP_DELETED_FILE: `${dir}/deleted.txt`,
    MAX_DELETE: "",
  };
  return { dir, seed, work, origin, env };
}

async function run(fx: Fixture, args: string[] = [], env: Record<string, string> = {}) {
  const out = await new Deno.Command("bash", {
    args: [SCRIPT, ...args],
    cwd: fx.work,
    env: { ...GIT_ENV, ...fx.env, ...env },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const read = async (p: string) => {
    try {
      return await Deno.readTextFile(p);
    } catch {
      return "";
    }
  };
  const calls = (await read(fx.env.FAKE_CALLS)).split("\n").filter(Boolean);
  const announced = (await read(fx.env.CLEANUP_DELETED_FILE)).split("\n").filter(Boolean);
  const summary = await read(fx.env.GITHUB_STEP_SUMMARY);
  await Deno.remove(fx.dir, { recursive: true });
  return {
    code: out.code,
    output: new TextDecoder().decode(out.stdout) + new TextDecoder().decode(out.stderr),
    deletes: calls.filter((c) => c.startsWith("functions delete ")).map((c) => c.split(" ")[2]),
    calls,
    announced,
    summary,
  };
}

Deno.test("cleanup: deletes a slug whose folder left main 3+ days ago, and waits on a newer one", async () => {
  const fx = await fixture({
    retired: [["admin-web-old", 4], ["admin-web-new", 1]],
    cloud: [...LIVE, "admin-web-old", "admin-web-new"],
  });
  const r = await run(fx);
  assertEquals(r.code, 0, r.output);
  assertEquals(r.deletes, ["admin-web-old"]);
  assertStringIncludes(r.output, "wait admin-web-new");
  assertEquals(r.announced, ["admin-web-old"]);
  assertStringIncludes(r.summary, "deleted `admin-web-old`");
  assert(
    r.calls.includes("functions delete admin-web-old --project-ref yjalywfzdelacdzccpgb --yes"),
    r.calls.join("\n"),
  );
});

Deno.test("cleanup: nothing to do when cloud == repo", async () => {
  const r = await run(await fixture({ cloud: LIVE }));
  assertEquals(r.code, 0, r.output);
  assertStringIncludes(r.output, "0 slugs qualify");
  assertEquals(r.deletes, []);
});

Deno.test("cleanup: slugs match whole, never part of another slug", async () => {
  // A retired slug that is a prefix of a live folder, and a live folder that
  // is a prefix of a retired slug: the retired ones go, the live ones stay.
  const fx = await fixture({
    live: [...LIVE, "admin-web-create-place-api-key", "admin-web-list"],
    retired: [["admin-web-create-place", 5], ["admin-web-list-logs", 5]],
    cloud: [...LIVE, "admin-web-create-place", "admin-web-create-place-api-key", "admin-web-list", "admin-web-list-logs"],
  });
  const r = await run(fx);
  assertEquals(r.code, 0, r.output);
  assertEquals(r.deletes, ["admin-web-create-place", "admin-web-list-logs"]);
});

Deno.test("cleanup: more than MAX_DELETE qualifying refuses and deletes nothing", async () => {
  const retired = ["a", "b", "c", "d", "e", "f"].map((x): [string, number] => [`admin-web-gone-${x}`, 10]);
  const setup = { retired, cloud: [...LIVE, ...retired.map(([s]) => s)] };
  const refused = await run(await fixture(setup));
  assertEquals(refused.code, 1, refused.output);
  assertEquals(refused.deletes, []);
  assertStringIncludes(refused.output, "6 slugs qualify (cap 5)");
  assertStringIncludes(refused.output, "rerun with max_delete=6 via workflow_dispatch");
  assertStringIncludes(refused.summary, "cleanup refused");

  const raised = await run(await fixture(setup), [], { MAX_DELETE: "6" });
  assertEquals(raised.code, 0, raised.output);
  assertEquals(raised.deletes.length, 6);
});

Deno.test("cleanup: --dry-run prints the set, deletes nothing, even above the cap", async () => {
  const retired = ["a", "b", "c", "d", "e", "f"].map((x): [string, number] => [`admin-web-gone-${x}`, 10]);
  const r = await run(await fixture({ retired, cloud: [...LIVE, ...retired.map(([s]) => s)] }), ["--dry-run"]);
  assertEquals(r.code, 0, r.output);
  assertEquals(r.deletes, []);
  assertStringIncludes(r.output, "6 slugs qualify: admin-web-gone-a");
  assertStringIncludes(r.output, "a real run refuses this");
  assertStringIncludes(r.output, "dry run: nothing deleted");
});

Deno.test("cleanup: fewer than 30 folders on origin/main refuses", async () => {
  const r = await run(await fixture({ live: LIVE.slice(0, 29), retired: [["admin-web-old", 9]], cloud: ["admin-web-old"] }));
  assertEquals(r.code, 1, r.output);
  assertStringIncludes(r.output, "29 function folders");
  assertStringIncludes(r.output, "floor 30");
  assertEquals(r.deletes, []);
});

Deno.test("cleanup: an empty or missing functions tree refuses, never 'all retired'", async () => {
  const r = await run(await fixture({ noFunctionsDir: true, cloud: LIVE }));
  assertEquals(r.code, 1, r.output);
  assertStringIncludes(r.output, "origin/main has no supabase/supabase/functions");
  assertEquals(r.deletes, []);
});

Deno.test("cleanup: a slug main never had a folder for is reported, not deleted", async () => {
  const r = await run(await fixture({ cloud: [...LIVE, "admin-web-deployed-by-hand"] }));
  assertEquals(r.code, 0, r.output);
  assertStringIncludes(r.output, "skip admin-web-deployed-by-hand: in the cloud, but origin/main never had its folder");
  assertEquals(r.deletes, []);
});

Deno.test("cleanup: a failed functions list is an error, never an empty cloud", async () => {
  const r = await run(await fixture({ cloud: LIVE }), [], { FAKE_LIST_FAIL: "1" });
  assertEquals(r.code, 1, r.output);
  assertStringIncludes(r.output, "supabase functions list failed");
  assertEquals(r.deletes, []);
});

Deno.test("cleanup: a folder that is back on origin/main by delete time is skipped", async () => {
  const fx = await fixture({ retired: [["admin-web-old", 4], ["admin-web-older", 6]], cloud: [...LIVE, "admin-web-old", "admin-web-older"] });
  // A revert merges while the script runs: the listing happens after the first
  // fetch, so the fresh fetch before each delete is the only thing that sees it.
  const restore = [
    `git -C '${fx.seed}' revert --no-edit HEAD`,
    `git -C '${fx.seed}' push -q origin main`,
  ].join(" && ");
  const r = await run(fx, [], { FAKE_ON_LIST: restore });
  assertEquals(r.code, 0, r.output);
  assertStringIncludes(r.output, "skip admin-web-old: its folder is back on origin/main");
  assertEquals(r.deletes, ["admin-web-older"]);
});

Deno.test("cleanup: a failed fetch before a delete stops every delete", async () => {
  const fx = await fixture({ retired: [["admin-web-old", 4]], cloud: [...LIVE, "admin-web-old"] });
  const r = await run(fx, [], { FAKE_ON_LIST: `mv '${fx.origin}' '${fx.origin}.moved'` });
  assertEquals(r.code, 1, r.output);
  assertStringIncludes(r.output, "fetching origin/main again failed");
  assertEquals(r.deletes, []);
});

Deno.test("cleanup: 'does not exist' is the goal state; any other delete error stops the run", async () => {
  const retired: Array<[string, number]> = [["admin-web-a", 5], ["admin-web-b", 5], ["admin-web-c", 5]];
  const cloud = [...LIVE, "admin-web-a", "admin-web-b", "admin-web-c"];
  const tolerated = await run(await fixture({ retired, cloud, gone: ["admin-web-a"] }));
  assertEquals(tolerated.code, 0, tolerated.output);
  assertStringIncludes(tolerated.output, "admin-web-a was already gone");
  assertEquals(tolerated.announced, ["admin-web-b", "admin-web-c"]);

  const stopped = await run(await fixture({ retired, cloud, broken: ["admin-web-b"] }));
  assertEquals(stopped.code, 1, stopped.output);
  assertStringIncludes(stopped.output, "deleting admin-web-b failed");
  assertEquals(stopped.deletes, ["admin-web-a", "admin-web-b"]);
  assertEquals(stopped.announced, ["admin-web-a"], "a run that fails midway still announces what it deleted");
});

Deno.test("cleanup: a shallow clone refuses (deletion dates need the history)", async () => {
  const r = await run(await fixture({ retired: [["admin-web-old", 4]], cloud: [...LIVE, "admin-web-old"], shallow: true }));
  assertEquals(r.code, 1, r.output);
  assertStringIncludes(r.output, "shallow clone");
  assertEquals(r.deletes, []);
});

Deno.test("cleanup: bad usage exits 2 and touches nothing", async () => {
  const typo = await run(await fixture({ cloud: LIVE }), ["--dryrun"]);
  assertEquals(typo.code, 2, typo.output);
  assertEquals(typo.calls, []);
  const cap = await run(await fixture({ cloud: LIVE }), [], { MAX_DELETE: "five" });
  assertEquals(cap.code, 2, cap.output);
  assertEquals(cap.calls, []);
});

Deno.test("supabase-deploy.yml: the integration deploys; the workflow only cleans up, on main", async () => {
  const wf = await Deno.readTextFile(WORKFLOW);
  assertEquals(/functions deploy/.test(wf), false, "a second deployer races the Supabase GitHub integration");
  assertEquals(wf.includes("leftover=("), false, "the hand-kept slug list is back");
  assertStringIncludes(wf, "run: supabase/scripts/cleanup-retired-efs.sh");
  assertStringIncludes(wf, "if: github.ref == 'refs/heads/main'");
  assertMatch(wf, /\n {2}schedule:\n {4}- cron: "[^"]+"/);
  assertStringIncludes(wf, "fetch-depth: 0");
  assertMatch(wf, /uses: supabase\/setup-cli@[0-9a-f]{40} # v\d+\.\d+\.\d+\n\s+with:\n\s+version: 2\.100\.0\n/);
  assertStringIncludes(wf, "MAX_DELETE: ${{ inputs.max_delete }}");
  assertEquals(/^permissions:/m.test(wf), false, "contents: write belongs to the cleanup job only");
  assertEquals(wf.match(/contents: write/g)?.length, 1);
});
