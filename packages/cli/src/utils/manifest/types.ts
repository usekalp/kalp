import type {
  ArtifactManifest,
  BundleManifest,
  IRGraph,
  SchemaRegistry,
} from "@kalphq/sdk";

export interface BundledArtifactFile {
  file: string;
  code: string;
  size: number;
  sha256: string;
}

export interface AgentManifestV3 {
  format: "kalp-agent-manifest";
  schemaVersion: 3;
  artifactManifest: ArtifactManifest;
  semanticIr: IRGraph;
  schemas: SchemaRegistry;
  bundleManifest: BundleManifest;
  bundles: Record<string, BundledArtifactFile>;
  metadata?: {
    generatedAt?: string;
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

