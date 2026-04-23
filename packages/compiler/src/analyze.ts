import { Project, SyntaxKind, Node } from "ts-morph";

// Types

export interface HandlerAnalysis {
  capabilities: string[];
  imports: {
    external: string[];
    internal: string[];
  };
  blockers: string[];
  warnings: string[];
}

// Detection patterns

const CTX_NAMESPACES = [
  "actions",
  "storage",
  "ai",
  "vault",
  "auth",
  "memory",
  "state",
  "history",
] as const;

const BLOCKER_IDENTIFIERS = new Set([
  "eval",
  "Function",
  "globalThis",
  "window",
  "self",
  "child_process",
  "worker_threads",
]);

const BLOCKER_IMPORTS = new Set([
  "fs",
  "node:fs",
  "child_process",
  "node:child_process",
  "worker_threads",
  "node:worker_threads",
]);

const WARNING_IDENTIFIERS = new Set([
  "setTimeout",
  "setInterval",
  "XMLHttpRequest",
]);

const WARNING_IMPORTS = new Set(["axios"]);

// Helpers

function isInternalImport(specifier: string): boolean {
  return (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("~/")
  );
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

// Core analysis

export function analyzeHandler(code: string): HandlerAnalysis {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
    },
  });

  const sourceFile = project.createSourceFile("handler.ts", code);

  const capabilities = new Set<string>();
  const externalImports = new Set<string>();
  const internalImports = new Set<string>();
  const blockers = new Set<string>();
  const warnings = new Set<string>();

  // Scan imports
  for (const decl of sourceFile.getImportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    if (isInternalImport(specifier)) {
      internalImports.add(specifier);
    } else {
      externalImports.add(specifier);
    }
    if (BLOCKER_IMPORTS.has(specifier)) {
      blockers.add(`import("${specifier}")`);
    }
    if (WARNING_IMPORTS.has(specifier)) {
      warnings.add(`import("${specifier}")`);
    }
  }

  // Walk all nodes
  // Known limitation: aliased namespace references (e.g., `const a = actions; a.run(...)`)
  // are not detected. This requires full data-flow analysis, deferred to v2.
  sourceFile.forEachDescendant((node: Node) => {
    // ctx.namespace.method detection (e.g., ctx.actions.run)
    if (Node.isPropertyAccessExpression(node)) {
      const expr = node.getExpression();
      const name = node.getName();

      if (Node.isPropertyAccessExpression(expr)) {
        const obj = expr.getExpression();
        const ns = expr.getName();
        if (
          Node.isIdentifier(obj) &&
          obj.getText() === "ctx" &&
          CTX_NAMESPACES.includes(ns as (typeof CTX_NAMESPACES)[number])
        ) {
          capabilities.add(`${ns}.${name}`);
        }
      }

      // Destructured namespace detection (e.g., actions.run, storage.put)
      if (Node.isIdentifier(expr)) {
        const objName = expr.getText();
        if (
          CTX_NAMESPACES.includes(objName as (typeof CTX_NAMESPACES)[number])
        ) {
          capabilities.add(`${objName}.${name}`);
        }
      }
    }

    // eval() and new Function() detection
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      const callText = expr.getText();

      if (callText === "eval") {
        blockers.add("eval()");
      }

      if (callText === "Function" || callText === "new Function") {
        blockers.add("Function()");
      }

      if (WARNING_IDENTIFIERS.has(callText)) {
        warnings.add(`${callText}()`);
      }

      // Bare fetch() — not ctx.actions.fetch
      if (callText === "fetch") {
        const parent = node.getParent();
        const grandParent = parent?.getParent();
        const isCtxFetch =
          Node.isPropertyAccessExpression(parent) ||
          Node.isPropertyAccessExpression(grandParent);
        if (!isCtxFetch) {
          warnings.add("fetch()");
        }
      }
    }

    // new Function(...)
    if (Node.isNewExpression(node)) {
      const expr = node.getExpression();
      if (Node.isIdentifier(expr) && expr.getText() === "Function") {
        blockers.add("new Function()");
      }
      if (Node.isIdentifier(expr) && expr.getText() === "Date") {
        warnings.add("new Date()");
      }
    }

    // Identifier-based detection (globalThis, window, self, etc.)
    if (Node.isIdentifier(node)) {
      const text = node.getText();
      if (BLOCKER_IDENTIFIERS.has(text)) {
        const parent = node.getParent();
        const isImportDecl =
          parent?.getKind() === SyntaxKind.ImportDeclaration ||
          parent?.getKind() === SyntaxKind.ImportSpecifier;
        if (!isImportDecl) {
          blockers.add(text);
        }
      }
      if (text === "process" || text === "process.env") {
        const parent = node.getParent();
        if (
          Node.isPropertyAccessExpression(parent) &&
          parent.getName() === "env"
        ) {
          warnings.add("process.env");
        }
      }
    }

    // Dynamic import()
    if (
      node.getKind() === SyntaxKind.ImportKeyword &&
      node.getParent()?.getKind() === SyntaxKind.CallExpression
    ) {
      const callParent = node.getParent();
      if (callParent && Node.isCallExpression(callParent)) {
        const callExpr = callParent.getExpression();
        if (callExpr.getKind() === SyntaxKind.ImportKeyword) {
          blockers.add("dynamic import()");
        }
      }
    }

    // Math.random() and Date.now()
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      if (Node.isPropertyAccessExpression(expr)) {
        const obj = expr.getExpression().getText();
        const method = expr.getName();
        if (obj === "Math" && method === "random") {
          warnings.add("Math.random()");
        }
        if (obj === "Date" && method === "now") {
          warnings.add("Date.now()");
        }
      }
    }
  });

  return {
    capabilities: dedupe([...capabilities]),
    imports: {
      external: dedupe([...externalImports]),
      internal: dedupe([...internalImports]),
    },
    blockers: dedupe([...blockers]),
    warnings: dedupe([...warnings]),
  };
}
