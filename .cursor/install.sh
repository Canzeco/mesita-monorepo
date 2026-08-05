#!/usr/bin/env bash
# Cloud Agent install for mesita-monorepo (referenced by .cursor/environment.json).
#
# Idempotent: installs the dev toolchain and every app's node deps. With
# environment builds this runs once to bake the snapshot; it is also safe to
# re-run on a warm VM. Nothing here starts a long-running server — the apps are
# launched on demand via the preview configs in .claude/launch.json.
#
# Toolchain provisioned:
#   - pnpm 11.1.2  (web + mobile app installs; pinned to match CI + packageManager)
#   - deno 2.9.1   (supabase edge-function lint/test + root `deno task sync-rules`)
#   - supabase CLI (edge functions deploy / local tooling)
#   - bun          (gstack agent tooling)
set -euo pipefail

log() { printf '>>> [install] %s\n' "$*"; }
log "start"

export HOME="${HOME:-/home/ubuntu}"
LOCAL_BIN="$HOME/.local/bin"
mkdir -p "$LOCAL_BIN"

export DENO_INSTALL="$HOME/.deno"
export BUN_INSTALL="$HOME/.bun"
export PATH="$DENO_INSTALL/bin:$BUN_INSTALL/bin:$LOCAL_BIN:$PATH"

# Persist PATH for interactive shells (idempotent — appended once).
ensure_bashrc() {
  local line="$1"
  grep -qsF -- "$line" "$HOME/.bashrc" 2>/dev/null || printf '%s\n' "$line" >> "$HOME/.bashrc"
}
ensure_bashrc 'export DENO_INSTALL="$HOME/.deno"'
ensure_bashrc 'export BUN_INSTALL="$HOME/.bun"'
ensure_bashrc 'export PATH="$HOME/.deno/bin:$HOME/.bun/bin:$HOME/.local/bin:$PATH"'

# --- deno 2.9.1 (pinned to the version denoland/setup-deno uses in CI) ---
DENO_VERSION="2.9.1"
if ! command -v deno >/dev/null 2>&1 || ! deno --version 2>/dev/null | grep -q "deno ${DENO_VERSION}"; then
  log "installing deno ${DENO_VERSION}"
  curl -fsSL https://deno.land/install.sh | sh -s "v${DENO_VERSION}"
fi
log "deno: $(deno --version | head -1)"

# --- supabase CLI (pinned; CI uses supabase/setup-cli@latest) ---
SUPABASE_VERSION="2.111.0"
if ! command -v supabase >/dev/null 2>&1 || [ "$(supabase --version 2>/dev/null)" != "${SUPABASE_VERSION}" ]; then
  log "installing supabase CLI ${SUPABASE_VERSION}"
  tmp="$(mktemp -d)"
  curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/supabase_linux_amd64.tar.gz" -o "$tmp/sb.tar.gz"
  tar -xzf "$tmp/sb.tar.gz" -C "$tmp" supabase
  install -m 0755 "$tmp/supabase" "$LOCAL_BIN/supabase"
  rm -rf "$tmp"
fi
log "supabase: $(supabase --version)"

# --- bun (gstack requirement) ---
if ! command -v bun >/dev/null 2>&1; then
  log "installing bun"
  curl -fsSL https://bun.sh/install | bash
fi
log "bun: $(bun --version)"

# --- gstack agent tooling (Cursor host -> ~/.cursor/skills) ---
# Non-fatal: gstack is optional agent tooling; a failure here (e.g. upstream
# clone/build hiccup) must not block the core dev environment below.
setup_gstack() {
  # `setup --host cursor` is not wired in gstack bash yet (hosts/cursor.ts exists;
  # gen:skill-docs --host cursor works). Install via gen + symlink until upstream catches up.
  local GSTACK_DIR="$HOME/gstack"
  local CURSOR_SKILLS="$HOME/.cursor/skills"
  local CURSOR_GSTACK="$CURSOR_SKILLS/gstack"
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
  local GEN_DIR="$GSTACK_DIR/.cursor/skills"
  find "$CURSOR_SKILLS" -maxdepth 1 \( -type l -o -type d \) -name 'gstack*' ! -path "$CURSOR_GSTACK" -exec rm -rf {} + 2>/dev/null || true
  if [ -f "$GEN_DIR/gstack/SKILL.md" ]; then ln -snf "$GEN_DIR/gstack/SKILL.md" "$CURSOR_GSTACK/SKILL.md"; fi
  ln -snf "$GSTACK_DIR/bin" "$CURSOR_GSTACK/bin"
  [ -d "$GSTACK_DIR/browse/dist" ] && ln -snf "$GSTACK_DIR/browse/dist" "$CURSOR_GSTACK/browse/dist"
  [ -d "$GSTACK_DIR/browse/bin" ] && ln -snf "$GSTACK_DIR/browse/bin" "$CURSOR_GSTACK/browse/bin"
  if [ -f "$GEN_DIR/gstack-upgrade/SKILL.md" ]; then
    mkdir -p "$CURSOR_GSTACK/gstack-upgrade"
    ln -snf "$GEN_DIR/gstack-upgrade/SKILL.md" "$CURSOR_GSTACK/gstack-upgrade/SKILL.md"
  fi
  for f in checklist.md design-checklist.md greptile-triage.md TODOS-format.md; do
    [ -f "$GSTACK_DIR/review/$f" ] && ln -snf "$GSTACK_DIR/review/$f" "$CURSOR_GSTACK/review/$f"
  done
  [ -f "$GSTACK_DIR/ETHOS.md" ] && ln -snf "$GSTACK_DIR/ETHOS.md" "$CURSOR_GSTACK/ETHOS.md"
  for skill_dir in "$GEN_DIR"/gstack*/; do
    local skill_name
    skill_name="$(basename "$skill_dir")"
    [ "$skill_name" = "gstack" ] && continue
    [ -f "$skill_dir/SKILL.md" ] || continue
    ln -snf "$skill_dir" "$CURSOR_SKILLS/$skill_name"
  done
  printf '>>> gstack: %s skills under %s\n' "$(find "$CURSOR_SKILLS" -maxdepth 1 -name 'gstack*' | wc -l | tr -d ' ')" "$CURSOR_SKILLS"
}
if setup_gstack; then
  log "gstack tooling ready"
else
  log "gstack tooling skipped (non-fatal)"
fi

# --- monorepo package deps (each app is its own independent install root) ---
corepack enable
corepack prepare pnpm@11.1.2 --activate
log "pnpm: $(pnpm --version)"
for d in apps/*/; do
  if [ -f "$d/package.json" ]; then
    log "pnpm install: $d"
    ( cd "$d" && pnpm install )
  fi
done

log "complete"
