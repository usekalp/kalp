export interface NamedAnalysis {
  name: string;
  capabilities: string[];
  imports: { external: string[]; internal: string[] };
  blockers: string[];
  warnings: string[];
}

export interface PushValidation {
  ir: { valid: boolean; errors: string[] };
  bindings: { valid: boolean; errors: string[] };
}

export interface PushLogEntry {
  agentName: string;
  hash: string;
  validation: PushValidation;
  analysis: NamedAnalysis[];
  timestamp: string;
}

export function logPush(data: PushLogEntry): void {
  const totalCapabilities = [
    ...new Set(data.analysis.flatMap((a) => a.capabilities)),
  ];
  const totalWarnings = data.analysis.flatMap((a) =>
    a.warnings.map((w) => `${w} in ${a.name}`),
  );
  const totalBlockers = data.analysis.flatMap((a) =>
    a.blockers.map((b) => `${b} in ${a.name}`),
  );

  console.log(
    JSON.stringify(
      {
        event: "agent.push",
        timestamp: data.timestamp,
        agent: data.agentName,
        hash: data.hash.slice(0, 16),
        validation: {
          ir: {
            valid: data.validation.ir.valid,
            errorCount: data.validation.ir.errors.length,
          },
          bindings: {
            valid: data.validation.bindings.valid,
            errorCount: data.validation.bindings.errors.length,
          },
        },
        analysis: {
          handlers: data.analysis.length,
          capabilities: totalCapabilities,
          warnings: totalWarnings,
          blockers: totalBlockers,
        },
      },
      null,
      2,
    ),
  );
}
