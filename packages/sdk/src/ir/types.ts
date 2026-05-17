/**
 * IR (Intermediate Representation) and artifact metadata types for the Kalp compiler.
 *
 * @module
 */

export type RequirementDescriptor = Record<string, number>;

export type TriggerDescriptor =
  | { type: "lifecycle"; event: "init" | "tick" }
  | { type: "message" }
  | { type: "rpc"; contractName: string }
  | { type: "http"; method: string; path: string }
  | { type: "schedule"; scheduleId: string }
  | { type: "listener"; event: string };

export type NodeKind =
  | "init"
  | "tick"
  | "message"
  | "contract"
  | "route"
  | "listener"
  | "cron"
  | "tool";

export interface NodeDescriptor {
  id: string;
  stableName: string;
  kind: NodeKind;
  name?: string;
  inputSchema?: string;
  outputSchema?: string;
  trigger?: TriggerDescriptor;
  listener?: {
    event: string;
  };
  http?: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    skipAuth?: boolean;
  };
  schedule?: {
    expression: string;
    timezone?: string;
  };
}

export interface SchemaDescriptor {
  type: "json-schema";
  source: string;
  hash: string;
  schema: Record<string, unknown>;
}

export type SchemaRegistry = Record<string, SchemaDescriptor>;

export interface IRGraph {
  schemaVersion: 3;
  requirements: RequirementDescriptor;
  agent: {
    name: string;
    label?: string;
    description?: string;
    tags?: string[];
    skipAuth?: boolean;
    systemPrompt?: string | { dynamic: true };
    stateSchema?: string;
  };
  nodes: Record<string, NodeDescriptor>;
}

export interface BundleNodeBinding {
  bundle: string;
  file: string;
  size: number;
  format: "esm";
  entry: "default";
  sha256: string;
}

export interface BundleTargetManifest {
  abiVersion: number;
  nodes: Record<string, BundleNodeBinding>;
}

export interface BundleManifest {
  schemaVersion: 3;
  targets: Record<string, BundleTargetManifest>;
}

export interface ArtifactTargetManifest {
  abiVersion: number;
  artifactHash: string;
  deploymentHash: string;
}

export interface ArtifactManifest {
  schemaVersion: 3;
  semanticHash: string;
  files: {
    semanticIr: string;
    schemas: string;
    bundleManifest: string;
  };
  targets: Record<string, ArtifactTargetManifest>;
}
