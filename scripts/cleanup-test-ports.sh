#!/usr/bin/env bash
# Kill orphaned processes holding the ports Playwright's webServer and the
# dev server use. Runs as the `pretest:e2e` hook and from local-ci.sh so the
# next test run never connects to a stale build from a previous worktree.
#
# Background: when a worker tab dies or a worktree is removed, the sirv-cli
# child process can survive bound to :4173. Playwright's webServer config
# defaults `reuseExistingServer: !CI` — so locally it picks up the orphan
# instead of starting fresh. The orphan's build artifacts are stale, or it
# crashes mid-suite with ERR_CONNECTION_REFUSED. Either way the worker pays
# 1-2 cycles to diagnose and manually `lsof -i :4173 && kill <pid>`.
#
# Always exits 0 — failure to kill a phantom process is not a test-blocker.
# Compatible with macOS BSD lsof and GNU lsof on Linux.

set -u

# Ports we own:
#   $PLAYWRIGHT_PORT — Playwright preview webServer (sirv-cli) per
#                      playwright.config.ts; CI sets it per runner, default 4173
#   5173 — Vite dev server per `pnpm dev`
# Only the port THIS run owns is cleared — never the other runner's.
PORTS=("${PLAYWRIGHT_PORT:-4173}" 5173)
KILLED=0

for port in "${PORTS[@]}"; do
  # `-ti` prints PIDs only, one per line; `-nP` skips DNS/service-name lookup
  # for speed and stability across systems.
  pids=$(lsof -nP -ti ":$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086 # word-splitting intended for multi-pid kill
    echo "[cleanup-test-ports] :$port held by PID(s): $pids — sending SIGKILL"
    kill -9 $pids 2>/dev/null || true
    KILLED=$((KILLED + $(printf '%s\n' "$pids" | wc -l)))
  fi
done

# Stray Playwright UI/headed runners can hold ports indirectly via their
# bundled chromium. CI runs are headless and short-lived so this only
# matters for interactive local sessions, but cheap enough to always check.
pkill -9 -f 'playwright.*--ui' 2>/dev/null || true
pkill -9 -f 'playwright.*--headed' 2>/dev/null || true

if [ "$KILLED" -gt 0 ]; then
  # Give the kernel a moment to fully release the listening socket; without
  # this, the very next `sirv-cli --port 4173` can race and reassign to a
  # different port (which is what bit Worker B during PR #107).
  echo "[cleanup-test-ports] cleared $KILLED orphan(s); waiting 1s for sockets to release"
  sleep 1
fi

exit 0
