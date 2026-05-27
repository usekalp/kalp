import fs from "node:fs";
import path from "node:path";
import type { SourceMetadataManifest, HandlerSourceAnalysis } from "./types";

export function buildManifest(
  handlerAnalyses: HandlerSourceAnalysis[],
): SourceMetadataManifest {
  const primitiveLocations: SourceMetadataManifest["primitiveLocations"] = {};
  const handlerLocations: SourceMetadataManifest["handlerLocations"] = {};

  for (const handler of handlerAnalyses) {
    handlerLocations[handler.nodeId] = {
      file: handler.relativePath,
      line: handler.handlerLine,
      column: handler.handlerColumn,
      exportName: handler.exportName,
      stableName: handler.stableName,
      nodeId: handler.nodeId,
    };

    for (const prim of handler.primitives) {
      primitiveLocations[prim.primitiveId] = {
        file: handler.relativePath,
        line: prim.line,
        column: prim.column,
        handlerId: handler.nodeId,
        primitiveType: prim.primitiveType,
      };
    }
  }

  return {
    schemaVersion: 1,
    primitiveLocations,
    handlerLocations,
  };
}

export function writeManifest(
  manifest: SourceMetadataManifest,
  artifactsDir: string,
): string {
  const filePath = path.join(artifactsDir, "source-metadata.json");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  return filePath;
}