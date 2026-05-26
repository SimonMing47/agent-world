#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${AGENTWORLD_REPO_URL:-}"
BRANCH="${AGENTWORLD_BRANCH:-main}"
INSTALL_DIR="${AGENTWORLD_HOME:-$HOME/.agentworld/agent-world}"
BIN_DIR="${AGENTWORLD_BIN_DIR:-$HOME/.local/bin}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "agentworld installer: missing required command: $1" >&2
    exit 1
  fi
}

need_command git
need_command node

if [ -z "$REPO_URL" ]; then
  echo "agentworld installer: AGENTWORLD_REPO_URL must point to your internal git repository mirror." >&2
  echo "example: AGENTWORLD_REPO_URL=ssh://git.example.local/agent-world.git scripts/install.sh" >&2
  exit 1
fi

mkdir -p "$(dirname "$INSTALL_DIR")"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "[agentworld] Updating existing checkout: $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch --tags origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout "$BRANCH"
  git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
else
  echo "[agentworld] Cloning $REPO_URL#$BRANCH into $INSTALL_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

node "$INSTALL_DIR/scripts/agentworld-cli.mjs" install "$@"

mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/agentworld" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec node "$INSTALL_DIR/scripts/agentworld-cli.mjs" "\$@"
EOF
chmod +x "$BIN_DIR/agentworld"

echo
echo "[agentworld] CLI installed: $BIN_DIR/agentworld"
echo "[agentworld] Start AgentWorld: agentworld start"
echo "[agentworld] Upgrade later: agentworld upgrade"
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo "[agentworld] Add this to your shell profile if agentworld is not found:"
  echo "export PATH=\"$BIN_DIR:\$PATH\""
fi
