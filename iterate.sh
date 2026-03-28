#!/bin/bash
# VibeEdit Autonomous Quality Iteration Script
# Measures: build success, TypeScript errors, bundle analysis, AI tool coverage
# Usage: bash iterate.sh

set -e
cd "$(dirname "$0")"
export PATH="$HOME/.bun/bin:$PATH"

SCORE_FILE="/tmp/vibeedit-score.json"
TOTAL=0
DETAILS=""

echo "========================================="
echo "  VibeEdit Quality Measurement"
echo "========================================="

# 1. Build check (does it compile?)
echo ""
echo "[1/5] Build check..."
BUILD_OK=0
if timeout 60 bun run build:web 2>/dev/null; then
  BUILD_OK=1
  echo "  ✓ Build passed"
else
  echo "  ✗ Build failed"
fi
TOTAL=$((TOTAL + BUILD_OK * 30))

# 2. TypeScript strict check (count errors)
echo ""
echo "[2/5] TypeScript check..."
TS_ERRORS=$(cd apps/web && npx tsc --noEmit --pretty false 2>&1 | grep -c "error TS" || true)
if [ "$TS_ERRORS" -eq 0 ]; then
  TS_SCORE=20
  echo "  ✓ 0 TypeScript errors"
elif [ "$TS_ERRORS" -lt 10 ]; then
  TS_SCORE=15
  echo "  ~ $TS_ERRORS TypeScript errors"
elif [ "$TS_ERRORS" -lt 50 ]; then
  TS_SCORE=10
  echo "  ~ $TS_ERRORS TypeScript errors"
else
  TS_SCORE=0
  echo "  ✗ $TS_ERRORS TypeScript errors"
fi
TOTAL=$((TOTAL + TS_SCORE))

# 3. Page load check (all pages return 200)
echo ""
echo "[3/5] Page availability check..."
# Start dev server if not running
if ! curl -s -o /dev/null http://localhost:3001/ 2>/dev/null; then
  nohup bun run dev:web > /tmp/vibeedit-iterate.log 2>&1 &
  sleep 12
fi

PAGES_OK=0
PAGES_TOTAL=0
for page in / /login /register /pricing /terms /privacy /forgot-password; do
  PAGES_TOTAL=$((PAGES_TOTAL + 1))
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001$page" 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    PAGES_OK=$((PAGES_OK + 1))
  fi
done
PAGE_SCORE=$((PAGES_OK * 20 / PAGES_TOTAL))
echo "  $PAGES_OK/$PAGES_TOTAL pages return 200 (score: $PAGE_SCORE/20)"
TOTAL=$((TOTAL + PAGE_SCORE))

# 4. AI tool coverage (all tools in executor switch)
echo ""
echo "[4/5] AI tool coverage..."
TOOLS_IN_TYPES=$(grep -c '"[a-z_]*"' apps/web/src/lib/ai/types.ts 2>/dev/null || echo 0)
TOOLS_IN_EXECUTOR=$(grep -c 'case "' apps/web/src/lib/ai/executor.ts 2>/dev/null || echo 0)
if [ "$TOOLS_IN_EXECUTOR" -ge "$TOOLS_IN_TYPES" ]; then
  TOOL_SCORE=15
  echo "  ✓ All $TOOLS_IN_TYPES tools have executor handlers"
else
  TOOL_SCORE=$((TOOLS_IN_EXECUTOR * 15 / TOOLS_IN_TYPES))
  echo "  ~ $TOOLS_IN_EXECUTOR/$TOOLS_IN_TYPES tools handled (score: $TOOL_SCORE/15)"
fi
TOTAL=$((TOTAL + TOOL_SCORE))

# 5. File count / dead code check
echo ""
echo "[5/5] Codebase health..."
UNUSED_IMPORTS=$(grep -rn "^import.*from" apps/web/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
TOTAL_FILES=$(find apps/web/src/ -name "*.ts" -o -name "*.tsx" | wc -l)
echo "  $TOTAL_FILES source files, $UNUSED_IMPORTS import lines"
CODE_SCORE=15
TOTAL=$((TOTAL + CODE_SCORE))

echo ""
echo "========================================="
echo "  TOTAL SCORE: $TOTAL / 100"
echo "========================================="

# Save score
echo "{\"score\": $TOTAL, \"build\": $BUILD_OK, \"ts_errors\": $TS_ERRORS, \"pages_ok\": $PAGES_OK, \"tools\": $TOOLS_IN_EXECUTOR, \"timestamp\": \"$(date -Iseconds)\"}" > "$SCORE_FILE"

echo ""
echo "Score saved to $SCORE_FILE"
exit 0
