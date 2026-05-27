import type { Span } from "@swc/core";

export interface SourceLocation {
  line: number;
  column: number;
}

export function spanToLocation(span: Span, source: string): SourceLocation {
  let line = 1;
  let column = 0;

  for (let i = 0; i < span.start && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      column = 0;
    } else {
      column++;
    }
  }

  return { line, column };
}

export function findExportPosition(
  source: string,
  exportName: string,
): SourceLocation | null {
  const patterns = [
    new RegExp(`export\\s+const\\s+${escapeRegex(exportName)}\\s*=`, "g"),
    new RegExp(`export\\s+function\\s+${escapeRegex(exportName)}\\s*\\(`, "g"),
    new RegExp(`export\\s+async\\s+function\\s+${escapeRegex(exportName)}\\s*\\(`, "g"),
    new RegExp(`(?:const|let|var)\\s+${escapeRegex(exportName)}\\s*=`, "g"),
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(source);
    if (match && match.index !== null) {
      return offsetToPosition(source, match.index);
    }
  }

  return null;
}

export function findHandlerBodyOffset(
  source: string,
  exportName: string,
): { start: number; end: number } | null {
  const exportPos = findExportPosition(source, exportName);
  if (!exportPos) return null;

  const exportOffset = positionToOffset(source, exportPos.line, exportPos.column);
  if (exportOffset === null) return null;

  const handlerKeyword = "handler:";
  const handlerIdx = source.indexOf(handlerKeyword, exportOffset);
  if (handlerIdx === -1) return null;

  const arrowIdx = source.indexOf("=>", handlerIdx + handlerKeyword.length);
  const braceIdx = source.indexOf("{", handlerIdx + handlerKeyword.length);

  if (braceIdx !== -1 && (arrowIdx === -1 || braceIdx < arrowIdx)) {
    let depth = 0;
    for (let i = braceIdx; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          return { start: braceIdx, end: i + 1 };
        }
      }
    }
  }

  if (arrowIdx !== -1) {
    const afterArrow = source.indexOf("{", arrowIdx);
    if (afterArrow !== -1 && afterArrow < exportOffset + 2000) {
      let depth = 0;
      for (let i = afterArrow; i < source.length; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}") {
          depth--;
          if (depth === 0) return { start: afterArrow, end: i + 1 };
        }
      }
    }

    const parenStart = source.indexOf("(", arrowIdx + 2);
    if (parenStart !== -1) {
      let depth = 0;
      for (let i = parenStart; i < source.length; i++) {
        if (source[i] === "(") depth++;
        else if (source[i] === ")") {
          depth--;
          if (depth === 0) {
            const arrowBodyStart = i + 1;
            const semicolonIdx = source.indexOf(";", arrowBodyStart);
            const newlineIdx = source.indexOf("\n", arrowBodyStart);
            const end = Math.min(
              semicolonIdx !== -1 ? semicolonIdx : source.length,
              newlineIdx !== -1 ? newlineIdx : source.length,
            );
            return { start: arrowIdx, end };
          }
        }
      }
    }
  }

  return null;
}

function offsetToPosition(source: string, offset: number): SourceLocation {
  let line = 1;
  let column = 0;

  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      column = 0;
    } else {
      column++;
    }
  }

  return { line, column };
}

function positionToOffset(source: string, line: number, column: number): number | null {
  let currentLine = 1;
  let lineStartOffset = 0;

  for (let i = 0; i < source.length; i++) {
    if (currentLine === line) {
      return lineStartOffset + column;
    }
    if (source[i] === "\n") {
      currentLine++;
      lineStartOffset = i + 1;
    }
  }

  if (currentLine === line) {
    return lineStartOffset + column;
  }

  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}