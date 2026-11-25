// pnpm step-end [--testflight] — runs the step-end workflow on this commit and
// posts its result as a commit status. Red means the PR is not merged.

import { execFileSync, spawnSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sha = git("rev-parse", "HEAD");
if (git("status", "--porcelain")) {
  console.error("Commit first: the status is posted on a commit, so the run must be of that commit.");
  process.exit(1);
}

const inputs = process.argv.includes("--testflight") ? ["-F", "testflight=true"] : [];
const run = spawnSync(
  "pnpm",
  ["dlx", "eas-cli@27.11.0", "workflow:run", ".eas/workflows/step-end.yml", "--wait", "--non-interactive", "--json", ...inputs],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
let result = {};
try {
  result = JSON.parse(run.stdout);
} catch {
  // The exit code is the verdict.
}
const ok = run.status === 0;
execFileSync("gh", [
  "api",
  `repos/{owner}/{repo}/statuses/${sha}`,
  "-f",
  `state=${ok ? "success" : "failure"}`,
  "-f",
  "context=mobile step-end",
  "-f",
  `description=${ok ? "Built and walked on both phones" : "Red: do not merge"}`,
  ...(result.url ? ["-f", `target_url=${result.url}`] : []),
]);
console.log(JSON.stringify({ sha, ok, url: result.url ?? null }));
process.exit(ok ? 0 : 1);
