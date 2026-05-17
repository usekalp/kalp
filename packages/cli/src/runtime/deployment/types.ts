import type { IRGraph, SchemaRegistry, ArtifactManifest, BundleManifest } from "@kalphq/sdk";

export interface AgentCapabilities {
  hasMessage: boolean;
  hasState: boolean;
  hasListeners: boolean;
  routeCount: number;
  contractCount: number;
}

export interface CompiledRoute {
  id: string;
  stableName: string;
  method: string;
  path: string;
  nodeId: string;
  kind: "route" | "contract" | "listener" | "hook";
}

export interface CompiledDeployment {
  hash: string;
  generation: number;
  metadataHash: string;
  runtimeHash: string;
  bundleHash: string;
  semanticHash: string;
  semanticIr: IRGraph;
  schemas: SchemaRegistry;
  artifactManifest: ArtifactManifest;
  bundleManifest: BundleManifest;
  bundleFiles: Record<string, { code: string; size: number; sha256: string }>;
  routingTable: CompiledRoute[];
  capabilities: AgentCapabilities;
  compiledAt: string;
}
