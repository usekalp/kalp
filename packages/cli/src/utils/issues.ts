import p from "picocolors";

/**
 * Severity level for a validation issue.
 */
export type Severity = "error" | "warning" | "info";

/**
 * A structured validation issue found during agent analysis or compilation.
 */
export interface ValidationIssue {
  severity: Severity;
  message: string;
  context?: string;
  location?: string;
  fix?: string;
  debug?: string;
}

interface RenderOptions {
  format?: "pretty" | "json" | "minimal";
  showDebug?: boolean;
}

const severityIcons: Record<Severity, string> = {
  error: p.red("✘"),
  warning: p.yellow("⚠"),
  info: p.blue("ℹ"),
};

const severityLabels: Record<Severity, string> = {
  error: p.red("Error"),
  warning: p.yellow("Warning"),
  info: p.blue("Info"),
};

function groupByContext(
  issues: ValidationIssue[],
): Map<string, ValidationIssue[]> {
  const groups = new Map<string, ValidationIssue[]>();

  for (const issue of issues) {
    const context = issue.context ?? "General";
    const existing = groups.get(context) ?? [];
    existing.push(issue);
    groups.set(context, existing);
  }

  return groups;
}

function renderPrettyIssue(issue: ValidationIssue, showDebug: boolean): string {
  const lines: string[] = [];

  // Header with icon, severity label, and message
  lines.push(
    `${severityIcons[issue.severity]} ${severityLabels[issue.severity]}: ${p.bold(issue.message)}`,
  );

  // Context (location in code)
  if (issue.context) {
    lines.push(p.dim(`   Found in: ${issue.context}`));
  }
  if (issue.location) {
    lines.push(p.dim(`   Location: ${issue.location}`));
  }

  // Empty line before fix
  lines.push("");

  // Fix section
  if (issue.fix) {
    lines.push(p.green("   Fix:"));
    const fixLines = issue.fix.split("\n");
    for (const fixLine of fixLines) {
      lines.push(`     ${fixLine}`);
    }
  }

  // Debug info (optional)
  if (showDebug && issue.debug) {
    lines.push("");
    lines.push(p.dim(`   (debug: ${issue.debug})`));
  }

  return lines.join("\n");
}

function renderGroupedIssues(
  issues: ValidationIssue[],
  showDebug: boolean,
): string {
  const groups = groupByContext(issues);
  const output: string[] = [];

  for (const [context, contextIssues] of groups) {
    // Context header
    output.push(p.cyan(p.bold(`→ ${context}`)));
    output.push("");

    // Issues in this context
    for (const issue of contextIssues) {
      output.push(renderPrettyIssue(issue, showDebug));
      output.push(""); // Empty line between issues
    }
  }

  return output.join("\n");
}

function renderMinimalIssue(issue: ValidationIssue): string {
  const icon =
    issue.severity === "error" ? "✘" : issue.severity === "warning" ? "⚠" : "ℹ";
  const context = issue.context ? ` [${issue.context}]` : "";
  return `${icon} ${issue.message}${context}`;
}

export function renderIssues(
  issues: ValidationIssue[],
  options: RenderOptions = {},
): string {
  const { format = "pretty", showDebug = false } = options;

  if (issues.length === 0) {
    return p.green("✓ No issues found");
  }

  // Sort by severity: errors first, then warnings, then info
  const sorted = [...issues].sort((a, b) => {
    const severityOrder: Record<Severity, number> = {
      error: 0,
      warning: 1,
      info: 2,
    };
    return severityOrder[a.severity]! - severityOrder[b.severity]!;
  });

  switch (format) {
    case "json":
      return JSON.stringify(sorted, null, 2);

    case "minimal":
      return sorted.map(renderMinimalIssue).join("\n");

    case "pretty":
    default: {
      const output: string[] = [];

      // Summary header
      const errorCount = issues.filter((i) => i.severity === "error").length;
      const warningCount = issues.filter(
        (i) => i.severity === "warning",
      ).length;
      const infoCount = issues.filter((i) => i.severity === "info").length;

      if (errorCount > 0) {
        output.push(
          p.red(
            p.bold(`Found ${errorCount} error${errorCount > 1 ? "s" : ""}`),
          ),
        );
      }
      if (warningCount > 0) {
        output.push(
          p.yellow(`${warningCount} warning${warningCount > 1 ? "s" : ""}`),
        );
      }
      if (infoCount > 0) {
        output.push(p.blue(`${infoCount} info`));
      }
      output.push("");

      // Grouped issues
      output.push(renderGroupedIssues(sorted, showDebug));

      return output.join("\n");
    }
  }
}

// Render legacy error strings in DX-first format
export function renderLegacyError(
  error: string,
  showDebug: boolean = true,
): string {
  const lines: string[] = [];

  // Extract debug info if present
  const debugMatch = error.match(/\(debug: (.+)\)$/);
  const debug = debugMatch ? debugMatch[1] : undefined;
  const mainError = debugMatch
    ? error.replace(/\(debug: .+\)$/, "").trim()
    : error;

  lines.push(p.red(p.bold(`✘ ${mainError.split("\n")[0]}`)));

  // Show fix if present in the error
  const fixMatch = mainError.match(/Fix:\n((?:- .+\n?)+)/);
  if (fixMatch) {
    lines.push("");
    lines.push(p.green("   Fix:"));
    const fixLines = fixMatch[1]?.split("\n").filter(Boolean) ?? [];
    for (const line of fixLines) {
      lines.push(`     ${line.replace(/^- /, "")}`);
    }
  }

  if (showDebug && debug) {
    lines.push("");
    lines.push(p.dim(`   (debug: ${debug})`));
  }

  return lines.join("\n");
}
