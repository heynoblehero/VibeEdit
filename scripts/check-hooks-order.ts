#!/usr/bin/env bun
/**
 * Static check: catch React hooks declared *after* an early return inside
 * the same component. That pattern crashes with React error #310 the
 * moment the early-return branch flips, because the number of hooks
 * called changes between renders.
 *
 * We caught two instances of this in src/components/editor (Preview.tsx
 * and CanvasManipulator.tsx) by hand. This script makes sure the third
 * doesn't ship.
 *
 * Detection: parse each component's body via the TS compiler. For every
 * top-level FunctionDeclaration / FunctionExpression / ArrowFunction,
 * walk statements top-to-bottom; once we see a `return` (whether bare
 * or guarded by `if`), any subsequent CallExpression that names a hook
 * (`useState` / `useMemo` / `useEffect` / `useCallback` / `useRef` /
 * `useReducer` / `useLayoutEffect` / `useImperativeHandle`) is reported.
 *
 * Usage: `bun run scripts/check-hooks-order.ts` — exits 1 on findings.
 */

import * as ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const HOOK_NAMES = new Set([
  "useState",
  "useMemo",
  "useEffect",
  "useCallback",
  "useRef",
  "useReducer",
  "useLayoutEffect",
  "useImperativeHandle",
  "useInsertionEffect",
  "useTransition",
  "useDeferredValue",
  "useId",
  "useSyncExternalStore",
]);

interface Finding {
  file: string;
  line: number;
  hook: string;
  earlyReturnLine: number;
}

function isHookCall(node: ts.Node): string | null {
  if (!ts.isCallExpression(node)) return null;
  const expr = node.expression;
  let name: string | null = null;
  if (ts.isIdentifier(expr)) name = expr.text;
  else if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
    name = expr.name.text;
  }
  return name && HOOK_NAMES.has(name) ? name : null;
}

function lineOf(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

/**
 * Walks the *direct statements* of a function body. We don't recurse
 * into nested function/arrow bodies — hooks defined inside an inner
 * callback aren't subject to the same hook-order rule.
 */
function checkFunctionBody(
  body: ts.Block,
  sf: ts.SourceFile,
  findings: Finding[],
  filePath: string,
): void {
  let earlyReturnLine = 0;

  for (const stmt of body.statements) {
    // Track returns at this level. Direct `return` and `if (...) return`.
    if (ts.isReturnStatement(stmt)) {
      if (!earlyReturnLine) earlyReturnLine = lineOf(sf, stmt.getStart(sf));
    } else if (ts.isIfStatement(stmt)) {
      // Walk the `if`/`else` branches looking for any reachable return.
      const visit = (node: ts.Node): boolean => {
        if (ts.isReturnStatement(node)) return true;
        if (ts.isBlock(node)) {
          for (const inner of node.statements) {
            if (ts.isReturnStatement(inner)) return true;
            if (ts.isIfStatement(inner) && visit(inner)) return true;
          }
        }
        return false;
      };
      const thenHit = visit(stmt.thenStatement);
      const elseHit = stmt.elseStatement ? visit(stmt.elseStatement) : false;
      if (thenHit || elseHit) {
        if (!earlyReturnLine) earlyReturnLine = lineOf(sf, stmt.getStart(sf));
      }
    }

    // Once an early return is on the books, any hook call at this level
    // (inside variable declarations or expression statements) is a bug.
    if (earlyReturnLine) {
      const scanForHooks = (node: ts.Node) => {
        // Don't descend into nested function bodies — those have their
        // own hook scope.
        if (
          ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) ||
          ts.isMethodDeclaration(node)
        ) {
          return;
        }
        const hookName = isHookCall(node);
        if (hookName) {
          findings.push({
            file: filePath,
            line: lineOf(sf, node.getStart(sf)),
            hook: hookName,
            earlyReturnLine,
          });
        }
        ts.forEachChild(node, scanForHooks);
      };
      scanForHooks(stmt);
    }
  }
}

function checkSourceFile(filePath: string, source: string): Finding[] {
  const sf = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const findings: Finding[] = [];

  const visit = (node: ts.Node) => {
    let body: ts.Block | undefined;
    let isComponent = false;

    if (ts.isFunctionDeclaration(node) && node.body) {
      const name = node.name?.text ?? "";
      if (/^[A-Z]/.test(name)) {
        body = node.body;
        isComponent = true;
      }
    } else if (ts.isVariableStatement(node)) {
      // const Foo = (...) => { ... } / function expression assigned to PascalCase.
      for (const decl of node.declarationList.declarations) {
        if (
          decl.name &&
          ts.isIdentifier(decl.name) &&
          /^[A-Z]/.test(decl.name.text) &&
          decl.initializer
        ) {
          const init = decl.initializer;
          const fn =
            ts.isArrowFunction(init) || ts.isFunctionExpression(init)
              ? init
              : undefined;
          if (fn && fn.body && ts.isBlock(fn.body)) {
            checkFunctionBody(fn.body, sf, findings, filePath);
          }
        }
      }
    }

    if (body && isComponent) {
      checkFunctionBody(body, sf, findings, filePath);
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return findings;
}

function collectFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      // Skip generated / vendor.
      if (name === "node_modules" || name === ".next") continue;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else if (st.isFile() && full.endsWith(".tsx")) out.push(full);
    }
  };
  walk(root);
  return out;
}

function main(): void {
  const repoRoot = process.cwd();
  const roots = ["src"];
  const files: string[] = [];
  for (const r of roots) files.push(...collectFiles(join(repoRoot, r)));
  const allFindings: Finding[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    allFindings.push(...checkSourceFile(f, src));
  }
  if (allFindings.length === 0) {
    console.log(`✓ ${files.length} files clean — no hooks declared after early returns.`);
    return;
  }
  console.error(
    `✗ Found ${allFindings.length} hook${allFindings.length === 1 ? "" : "s"} declared after an early return:\n`,
  );
  for (const f of allFindings) {
    console.error(
      `  ${relative(repoRoot, f.file)}:${f.line} — ${f.hook}() after early-return at L${f.earlyReturnLine}`,
    );
  }
  console.error(
    `\nReact error #310 fires when the hook count changes between renders.`,
  );
  console.error(`Hoist these hooks above the early return.`);
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(2);
}
