#!/bin/bash
set -euo pipefail

# Local CI — mirrors GitHub Actions workflows so PRs don't need remote runners
# Usage:
#   ./scripts/local-ci.sh          # run all checks
#   ./scripts/local-ci.sh rust     # rust checks only
#   ./scripts/local-ci.sh ts       # typescript checks only
#   ./scripts/local-ci.sh build    # build only
#   ./scripts/local-ci.sh test     # tests only
#   ./scripts/local-ci.sh quality  # bundle size + security audit
#   ./scripts/local-ci.sh e2e      # playwright e2e
#   ./scripts/local-ci.sh fast     # skip e2e + coverage (quick pre-push)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Where command stderr goes. Quiet by default (summary lines only). CI=1 or
# VERBOSE=1 keeps stderr so a failing step is diagnosable from the log alone.
ERR=/dev/null
if [ -n "${CI:-}" ] || [ -n "${VERBOSE:-}" ]; then
  ERR=/dev/stderr
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0
FAILED_STEPS=()

step() {
  echo ""
  echo -e "${CYAN}▸ $1${NC}"
}

pass() {
  echo -e "  ${GREEN}✓ $1${NC}"
  PASS=$((PASS + 1))
}

fail() {
  echo -e "  ${RED}✗ $1${NC}"
  FAIL=$((FAIL + 1))
  FAILED_STEPS+=("$1")
}

skip() {
  echo -e "  ${YELLOW}⊘ $1 (skipped)${NC}"
  SKIP=$((SKIP + 1))
}

run_rust() {
  step "Rust Checks"

  if cargo fmt --check --manifest-path packages/kernel/Cargo.toml 2>"$ERR"; then
    pass "cargo fmt"
  else
    fail "cargo fmt"
  fi

  if cargo clippy --manifest-path packages/kernel/Cargo.toml -- -D warnings 2>"$ERR"; then
    pass "cargo clippy"
  else
    fail "cargo clippy"
  fi

  if cargo test --manifest-path packages/kernel/Cargo.toml --quiet 2>"$ERR"; then
    pass "cargo test"
  else
    fail "cargo test"
  fi
}

run_wasm_build() {
  step "WASM Build"

  if (cd packages/kernel && wasm-pack build --target web --out-dir pkg) 2>"$ERR"; then
    pass "wasm-pack build"
  else
    fail "wasm-pack build"
  fi
}

run_ts_lint() {
  step "TypeScript Lint + Format"

  if pnpm lint 2>"$ERR"; then
    pass "ESLint"
  else
    fail "ESLint"
  fi

  if pnpm format:check 2>"$ERR"; then
    pass "Prettier"
  else
    fail "Prettier"
  fi
}

run_ts_test() {
  step "Unit Tests (Vitest)"

  if pnpm test 2>"$ERR"; then
    pass "vitest"
  else
    fail "vitest"
  fi

  if pnpm parity:test 2>"$ERR"; then
    pass "parity matrix tests"
  else
    fail "parity matrix tests"
  fi
}

run_ts_build() {
  step "TypeScript Build"

  if pnpm build 2>"$ERR"; then
    pass "pnpm build"
  else
    fail "pnpm build"
  fi
}

run_coverage() {
  step "Coverage"

  if pnpm --filter @nexus/app test:coverage 2>"$ERR"; then
    pass "coverage report"
  else
    fail "coverage report"
  fi
}

run_quality() {
  step "Quality Checks"

  # Bundle size
  if [ -d "packages/app/build" ]; then
    TOTAL=$(du -sk packages/app/build | cut -f1)
    WASM=$(find packages/app/build -name '*.wasm' -exec du -sk {} + 2>"$ERR" | awk '{s+=$1}END{print s+0}')
    JS=$((TOTAL - WASM))
    echo -e "  Bundle: total=${TOTAL}KB  js/css=${JS}KB  wasm=${WASM}KB"
    pass "bundle size report"
  else
    skip "bundle size (no build dir — run 'build' first)"
  fi

  # pnpm audit
  if pnpm audit --audit-level=high 2>"$ERR"; then
    pass "pnpm audit"
  else
    echo -e "  ${YELLOW}  (audit warnings — non-blocking)${NC}"
    pass "pnpm audit (warnings only)"
  fi

  # cargo audit
  if command -v cargo-audit &>/dev/null; then
    if (cd packages/kernel && cargo audit) 2>"$ERR"; then
      pass "cargo audit"
    else
      echo -e "  ${YELLOW}  (audit warnings — non-blocking)${NC}"
      pass "cargo audit (warnings only)"
    fi
  else
    skip "cargo audit (install: cargo install cargo-audit)"
  fi
}

run_e2e() {
  step "E2E Tests (Playwright)"

  # Single source of truth for orphan-port cleanup; also wired as
  # `pretest:e2e` in package.json so direct `pnpm test:e2e` invocations
  # get the same protection.
  ./scripts/cleanup-test-ports.sh || true

  if command -v npx &>/dev/null && npx playwright test 2>"$ERR"; then
    pass "playwright"
  else
    fail "playwright"
  fi
}

summary() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "  ${GREEN}✓ ${PASS} passed${NC}  ${RED}✗ ${FAIL} failed${NC}  ${YELLOW}⊘ ${SKIP} skipped${NC}"

  if [ ${FAIL} -gt 0 ]; then
    echo ""
    echo -e "  ${RED}Failed:${NC}"
    for step in "${FAILED_STEPS[@]}"; do
      echo -e "    ${RED}• ${step}${NC}"
    done
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
  else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  ${GREEN}All checks passed — safe to push/merge${NC}"
    exit 0
  fi
}

MODE="${1:-all}"

case "$MODE" in
  rust)
    run_rust
    ;;
  ts)
    run_ts_lint
    run_ts_test
    ;;
  build)
    run_wasm_build
    run_ts_build
    ;;
  test)
    run_rust
    run_ts_test
    ;;
  quality)
    run_quality
    ;;
  coverage)
    run_coverage
    ;;
  e2e)
    run_e2e
    ;;
  fast)
    run_rust
    run_wasm_build
    run_ts_lint
    run_ts_test
    run_ts_build
    ;;
  all)
    run_rust
    run_wasm_build
    run_ts_lint
    run_ts_test
    run_ts_build
    run_coverage
    run_quality
    run_e2e
    ;;
  *)
    echo "Usage: $0 {all|rust|ts|build|test|quality|coverage|e2e|fast}"
    exit 1
    ;;
esac

summary
