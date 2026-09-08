#!/usr/bin/env bash
# scripts/preflight.sh — the write gate behind ASDM I-3 and I-4: ONE implementation, every platform.
#
#   bash scripts/preflight.sh check [path]      verdict for the checkout holding <path> (default: cwd); exit 1 = no writes here
#   bash scripts/preflight.sh claude            Claude Code PreToolUse hook on Edit/Write/MultiEdit/NotebookEdit (stdin JSON); exit 2 refuses the write
#   bash scripts/preflight.sh pre-commit        git pre-commit hook, installed by `deno task boot` / `worktree add` (or `install-hook`); exit 1 refuses the commit
#   bash scripts/preflight.sh cursor            Cursor beforeShellExecution hook (stdin JSON): denies git commit/push/merge outside a claimed workspace
#   bash scripts/preflight.sh session-start     Claude Code SessionStart hook: installs the git hook (and deno in a cloud clone), prints the verdict as context
#   bash scripts/preflight.sh install-hook [p]  write the pre-commit wrapper into the fleet's common hooks dir
#
# The rule: a repository write lands only in a WORKSPACE — a checkout a live claim names
# (`git config --worktree mesita.issue`, written by scripts/worktree.ts).
#   · the shared checkout — the main worktree sitting on `main` — is the lobby: never (I-4)
#   · a linked worktree with no claim: not yet — adopt it (`deno task worktree add MESITA-<id> --adopt <path>`)
#   · a claimed checkout whose branch carries ANOTHER issue's id: never (one issue = one branch = one worktree, I-3)
#   · a cloud clone — the main worktree on a harness branch — claimed with a `*-cloud` platform token: yes
#   · a path outside this repository (scratch, memory, another repo): not this law, allowed
# Reads, Q&A and non-code issues never reach this gate: only writes and commits do, so a
# non-code issue needs no workspace and gets none.
#
# bash and git only, on purpose: this runs inside git hooks and in a fresh cloud container,
# where deno is not installed. Deno-side callers (scripts/worktree.ts `preflight`, `boot`,
# `add`) shell out to this file rather than re-implementing the rule.

set -u

SELF="$(cd "$(dirname "$0")" && pwd -P)/$(basename "$0")"
ENTER="enter it (Claude Code: EnterWorktree path=<printed path>; Cursor: open that worktree; Codex: cd into it)"
V_MSG=""

say() { V_MSG=$1; }

# ── helpers ──────────────────────────────────────────────────────────────────

# The nearest existing directory of a path that may not exist yet (Write creates files), physical.
existing_dir() {
  local p=$1
  [ -d "$p" ] || p=$(dirname "$p")
  while [ ! -d "$p" ] && [ "$p" != "/" ] && [ "$p" != "." ]; do p=$(dirname "$p"); done
  (cd "$p" 2>/dev/null && pwd -P)
}

physical() { (cd "$1" 2>/dev/null && pwd -P); }

common_dir() { # the repository identity: every worktree of one repo shares it
  local c
  c=$(git -C "$1" rev-parse --git-common-dir 2>/dev/null) || return 1
  case "$c" in /*) ;; *) c="$1/$c" ;; esac
  physical "$c"
}

# The main worktree anchors the fleet: the first entry of `git worktree list`.
main_worktree() {
  local m
  m=$(git -C "$1" worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')
  [ -n "$m" ] && physical "$m"
}

# A claim key on a checkout. `--worktree` needs extensions.worktreeConfig once the repo has
# several worktrees; scripts/worktree.ts enables it before it writes a claim, so a failure
# here means "no claim", never a guess.
claim() { git -C "$1" config --worktree --get "$2" 2>/dev/null || true; }

in_cloud() { [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || [ "${MESITA_CLOUD:-}" = "1" ]; }

# One JSON field by dotted path (numbers index arrays), through whichever parser the host has.
jget() {
  local json=$1 path=$2
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$json" | jq -r --arg p "$path" '($p | split(".") | map(tonumber? // .)) as $k | (try getpath($k) catch null) | if type == "string" then . else empty end' 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$json" | python3 -c '
import json, sys
d = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    if isinstance(d, list) and k.isdigit(): d = d[int(k)] if int(k) < len(d) else None
    elif isinstance(d, dict): d = d.get(k)
    else: d = None
print(d if isinstance(d, str) else "")' "$path" 2>/dev/null
  elif command -v node >/dev/null 2>&1; then
    printf '%s' "$json" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  let d = JSON.parse(s);
  for (const k of process.argv[1].split(".")) d = d && typeof d === "object" ? d[k] : undefined;
  process.stdout.write(typeof d === "string" ? d : "");
});' "$path" 2>/dev/null
  fi
}

json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' '; }

# ── the verdict ──────────────────────────────────────────────────────────────

# verdict <path>: 0 = this checkout may receive writes, 1 = it may not. V_MSG explains either way.
verdict() {
  local target=$1 dir top main branch issue platform session bissue
  dir=$(existing_dir "$target")
  top=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || { say "ok: $target is outside any git checkout, not a repository write"; return 0; }
  top=$(physical "$top")
  # Scope: the fleet this hook was installed for. Another repository's checkout is not this law.
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    local pc tc
    pc=$(common_dir "$CLAUDE_PROJECT_DIR" || true)
    tc=$(common_dir "$top" || true)
    if [ -n "$pc" ] && [ "$pc" != "$tc" ]; then say "ok: $top is another repository, not this fleet's law"; return 0; fi
  fi
  main=$(main_worktree "$top" || true)
  branch=$(git -C "$top" symbolic-ref --short -q HEAD 2>/dev/null || echo "(detached)")
  issue=$(claim "$top" mesita.issue)
  platform=$(claim "$top" mesita.platform)
  session=$(claim "$top" mesita.session)
  bissue=$(printf '%s' "$branch" | grep -oE 'MESITA-[0-9]+' | head -1 || true)
  if [ "$top" = "$main" ]; then
    if [ "$branch" = "main" ]; then
      say "SHARED CHECKOUT: $top is the lobby on main — the shared checkout holds no work of its own (I-4) — deno task worktree add MESITA-<id> <slug>, then $ENTER; non-code work needs no workspace"
      return 1
    fi
    if [ -z "$issue" ]; then
      if in_cloud; then
        local deno_hint=""
        command -v deno >/dev/null 2>&1 || deno_hint=" (first: npm install -g deno@2.9.1)"
        say "UNCLAIMED CLONE: $top sits on $branch with no live claim — a cloud clone becomes the issue's workspace when a claim names it (I-3) — deno task worktree add MESITA-<id> <slug> --adopt .$deno_hint, move the issue to In Progress, paste the printed claim line"
      else
        say "UNCLAIMED CHECKOUT: $top sits on $branch with no live claim — the shared checkout works only on main and never carries a claim (I-4) — git switch main && deno task worktree repair-lobby, then deno task worktree add MESITA-<id> <slug> and $ENTER"
      fi
      return 1
    fi
    case "$platform" in
      *-cloud) ;;
      *)
        say "SHARED CHECKOUT: $top carries claim $issue with platform '${platform:-none}' — only a cloud clone may claim the main worktree (I-4) — deno task worktree leave $issue once landed, then a worktree for the next issue"
        return 1
        ;;
    esac
  elif [ -z "$issue" ]; then
    say "UNCLAIMED WORKTREE: $top on $branch has no live claim — a checkout becomes a workspace when a claim names it (I-3) — deno task worktree add MESITA-<id> <slug> --adopt $top, move the issue to In Progress, paste the printed claim line"
    return 1
  fi
  if [ -n "$bissue" ] && [ "$bissue" != "$issue" ]; then
    say "CLAIM MISMATCH: $top is claimed by $issue but sits on $branch — one code issue = one branch = one worktree, never a branch switch inside a claimed workspace (I-3) — git switch the $issue branch, or deno task worktree add $bissue <slug> for a second workspace"
    return 1
  fi
  if [ "$top" = "$main" ]; then
    say "ok: cloud clone $top claimed by $issue on $branch${session:+ (session $session)}"
  else
    say "ok: workspace $top claimed by $issue on $branch"
  fi
  return 0
}

# ── the git hook ─────────────────────────────────────────────────────────────

# The wrapper lives in the fleet's COMMON hooks dir, so every worktree of the repo runs it, and
# it execs the committing checkout's own copy of this file (updates flow with the tree). The
# absolute fallback is for a checkout that predates the file. A cloud session's harness sets
# core.hooksPath to passthrough stubs that chain-call exactly this path.
install_hook() {
  local top=$1 common hook hp
  common=$(common_dir "$top") || return 0
  hook="$common/hooks/pre-commit"
  mkdir -p "$common/hooks"
  if [ -f "$hook" ] && ! grep -q "mesita preflight" "$hook" 2>/dev/null; then
    echo "preflight: $hook exists and is not ours — chain 'bash scripts/preflight.sh pre-commit' into it by hand"
    return 0
  fi
  cat >"$hook" <<EOF
#!/bin/sh
# mesita preflight — generated by scripts/preflight.sh install-hook; the law is scripts/preflight.sh (ASDM I-3, I-4)
top=\$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
if [ -f "\$top/scripts/preflight.sh" ]; then exec bash "\$top/scripts/preflight.sh" pre-commit; fi
if [ -f "$SELF" ]; then exec bash "$SELF" pre-commit; fi
exit 0
EOF
  chmod +x "$hook"
  hp=$(git -C "$top" config --get core.hooksPath 2>/dev/null || true)
  case "$hp" in
    "" | *ccr-git-hooks*) echo "preflight: pre-commit hook installed at $hook" ;;
    *) echo "preflight: core.hooksPath=$hp is set, so git runs hooks there, not $hook — chain 'bash scripts/preflight.sh pre-commit' into it by hand" ;;
  esac
}

# ── modes ────────────────────────────────────────────────────────────────────

mode_check() {
  local target=${1:-$PWD}
  if verdict "$target"; then echo "preflight: $V_MSG"; exit 0; fi
  echo "preflight: $V_MSG"
  exit 1
}

mode_claude() {
  local input tool cwd file target
  input=$(cat)
  tool=$(jget "$input" tool_name)
  cwd=$(jget "$input" cwd)
  file=$(jget "$input" tool_input.file_path)
  [ -n "$file" ] || file=$(jget "$input" tool_input.notebook_path)
  target=${file:-${cwd:-$PWD}}
  case "$target" in /*) ;; *) target="${cwd:-$PWD}/$target" ;; esac
  if verdict "$target"; then exit 0; fi
  # Exit 2 is the harness's unconditional refusal; stderr is what the agent reads.
  printf '%s\n' "PREFLIGHT REFUSED ${tool:-write} → $target" "$V_MSG" >&2
  exit 2
}

mode_pre_commit() {
  local top
  top=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
  unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX
  if verdict "$top"; then exit 0; fi
  printf '%s\n' "PREFLIGHT REFUSED commit in $top" "$V_MSG" "(a human may pass --no-verify; an agent never does)" >&2
  exit 1
}

mode_cursor() {
  local input cmd cwd root target msg
  input=$(cat)
  cmd=$(jget "$input" command)
  case "$cmd" in
    *"git commit"* | *"git push"* | *"git merge"* | *"git rebase"* | *"git cherry-pick"* | *"git revert"* | *"git am"*) ;;
    *) printf '{"permission":"allow"}\n'; exit 0 ;;
  esac
  cwd=$(jget "$input" cwd)
  root=$(jget "$input" workspace_roots.0)
  target=${cwd:-${root:-$PWD}}
  if verdict "$target"; then printf '{"permission":"allow"}\n'; exit 0; fi
  msg=$(json_escape "PREFLIGHT REFUSED: $V_MSG")
  printf '{"permission":"deny","user_message":"%s","agent_message":"%s"}\n' "$msg" "$msg"
  exit 0
}

mode_session_start() {
  local top
  top=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
  if in_cloud && ! command -v deno >/dev/null 2>&1; then
    # deno.land is not reachable through the cloud egress; the npm registry is. The script
    # (boot, worktree add) needs deno; this gate does not.
    if npm install -g deno@2.9.1 >/dev/null 2>&1; then echo "preflight: installed deno 2.9.1 via npm (cloud clone)"
    else echo "preflight: deno unavailable (npm install failed) — writes are still gated; the script needs deno"; fi
  fi
  install_hook "$top"
  verdict "$top" || true
  echo "preflight: $V_MSG"
  exit 0
}

case "${1:-}" in
  check) mode_check "${2:-}" ;;
  claude) mode_claude ;;
  pre-commit) mode_pre_commit ;;
  cursor) mode_cursor ;;
  session-start) mode_session_start ;;
  install-hook) install_hook "$(physical "${2:-$PWD}")" ;;
  *)
    echo "usage: preflight.sh check [path] | claude | pre-commit | cursor | session-start | install-hook [path]" >&2
    exit 2
    ;;
esac
