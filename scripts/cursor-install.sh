#!/usr/bin/env bash
# scripts/cursor-install.sh — the Cursor cloud environment's install step (.cursor/environment.json).
#
#   bun and gstack's Cursor skills, under the home directory (~/.cursor/skills)
#   deno 2.9.1, the version CI pins: deno task boot, worktree, sync-rules
#   every pnpm root (a tracked pnpm-lock.yaml), installed from its lockfile
#
# The repo carries no copy of gstack: the home install is the only one, so a skill never runs
# prose older than its bins. Any failing step stops the install; a pnpm root that fails names
# itself on stderr.

set -euo pipefail

cd "$(dirname "$0")/.."
printf '>>> [install] start\n'

# --- bun (gstack requirement) ---
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
fi
if ! grep -q 'BUN_INSTALL' "$HOME/.bashrc" 2>/dev/null; then
  printf '\nexport BUN_INSTALL="$HOME/.bun"\nexport PATH="$BUN_INSTALL/bin:$PATH"\n' >>"$HOME/.bashrc"
fi

# --- deno, pinned ---
DENO_VERSION=2.9.1
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
case "$(deno --version 2>/dev/null || true)" in
  "deno $DENO_VERSION "*) ;;
  *) curl -fsSL https://deno.land/install.sh | sh -s -- -y "v$DENO_VERSION" ;;
esac
if ! grep -q 'DENO_INSTALL' "$HOME/.bashrc" 2>/dev/null; then
  printf '\nexport DENO_INSTALL="$HOME/.deno"\nexport PATH="$DENO_INSTALL/bin:$PATH"\n' >>"$HOME/.bashrc"
fi

# --- gstack (Cursor host → ~/.cursor/skills) ---
# gstack's setup has no Cursor host, so its skill docs are generated for Cursor and linked in.
GSTACK_DIR="$HOME/gstack"
CURSOR_SKILLS="$HOME/.cursor/skills"
CURSOR_GSTACK="$CURSOR_SKILLS/gstack"
if [ -d "$GSTACK_DIR/.git" ]; then
  git -C "$GSTACK_DIR" pull --ff-only || true
else
  rm -rf "$GSTACK_DIR"
  git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git "$GSTACK_DIR"
fi
(
  cd "$GSTACK_DIR"
  bun install --frozen-lockfile 2>/dev/null || bun install
  bun run build
  bun run gen:skill-docs --host cursor
  bunx playwright install chromium || true
)
mkdir -p "$CURSOR_SKILLS" "$CURSOR_GSTACK" "$CURSOR_GSTACK/browse" "$CURSOR_GSTACK/gstack-upgrade" "$CURSOR_GSTACK/review"
GEN_DIR="$GSTACK_DIR/.cursor/skills"
find "$CURSOR_SKILLS" -maxdepth 1 \( -type l -o -type d \) -name 'gstack*' ! -path "$CURSOR_GSTACK" -exec rm -rf {} + 2>/dev/null || true
if [ -f "$GEN_DIR/gstack/SKILL.md" ]; then ln -snf "$GEN_DIR/gstack/SKILL.md" "$CURSOR_GSTACK/SKILL.md"; fi
ln -snf "$GSTACK_DIR/bin" "$CURSOR_GSTACK/bin"
[ -d "$GSTACK_DIR/browse/dist" ] && ln -snf "$GSTACK_DIR/browse/dist" "$CURSOR_GSTACK/browse/dist"
[ -d "$GSTACK_DIR/browse/bin" ] && ln -snf "$GSTACK_DIR/browse/bin" "$CURSOR_GSTACK/browse/bin"
if [ -f "$GEN_DIR/gstack-upgrade/SKILL.md" ]; then
  ln -snf "$GEN_DIR/gstack-upgrade/SKILL.md" "$CURSOR_GSTACK/gstack-upgrade/SKILL.md"
fi
for f in checklist.md design-checklist.md greptile-triage.md TODOS-format.md; do
  [ -f "$GSTACK_DIR/review/$f" ] && ln -snf "$GSTACK_DIR/review/$f" "$CURSOR_GSTACK/review/$f"
done
[ -f "$GSTACK_DIR/ETHOS.md" ] && ln -snf "$GSTACK_DIR/ETHOS.md" "$CURSOR_GSTACK/ETHOS.md"
for skill_dir in "$GEN_DIR"/gstack*/; do
  skill_name="$(basename "$skill_dir")"
  [ "$skill_name" = "gstack" ] && continue
  [ -f "$skill_dir/SKILL.md" ] || continue
  ln -snf "$skill_dir" "$CURSOR_SKILLS/$skill_name"
done
printf '>>> gstack %s: %s skills under %s\n' "$(cat "$GSTACK_DIR/VERSION" 2>/dev/null || echo unknown)" "$(find "$CURSOR_SKILLS" -maxdepth 1 -name 'gstack*' | wc -l | tr -d ' ')" "$CURSOR_SKILLS"

# --- every pnpm root, exactly as its lockfile pins it ---
corepack enable
corepack prepare pnpm@11.1.2 --activate
while IFS= read -r -d '' lock; do
  dir=$(dirname "$lock")
  printf '>>> pnpm install --frozen-lockfile in %s\n' "$dir"
  if ! (cd "$dir" && pnpm install --frozen-lockfile); then
    printf 'cursor-install: %s failed: run pnpm install in %s and commit the lockfile\n' "$dir" "$dir" >&2
    exit 1
  fi
done < <(git ls-files -z '*pnpm-lock.yaml')

printf '<<< [install] complete\n'
