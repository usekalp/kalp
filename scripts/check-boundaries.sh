#!/bin/bash
# Dependency boundary enforcement script.
# Validates that no package imports from a forbidden dependency.
# Run via: pnpm check-boundaries
set -e

FAIL=0

echo "=== Checking core purity ==="
if grep -rn --include="*.ts" "cloudflare\|DurableObject\|wrangler\|@kalphq/cloudflare\|@kalphq/test-utils" packages/core/src/ 2>/dev/null; then
  echo "FAIL: core has forbidden imports"
  FAIL=1
fi

echo "=== Checking SDK purity ==="
if grep -rn --include="*.ts" "@kalphq/core\|@kalphq/cloudflare" packages/sdk/src/ 2>/dev/null; then
  echo "FAIL: sdk has forbidden imports"
  FAIL=1
fi

echo "=== Checking test-utils purity ==="
if grep -rn --include="*.ts" "cloudflare\|DurableObject" packages/test-utils/src/ 2>/dev/null; then
  echo "FAIL: test-utils has forbidden imports"
  FAIL=1
fi

if [ $FAIL -eq 1 ]; then
  echo ""
  echo "Boundary check FAILED"
  exit 1
fi

echo ""
echo "All boundaries clean"
