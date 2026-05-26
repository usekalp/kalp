export interface IdentityConfig {
  strategy?: {
    type: "jwks" | "symmetric" | "apiKey";
    jwksUrl?: string;
    issuer?: string;
    audience?: string;
    secretEnvKey?: string;
    headerName?: string;
    envKey?: string;
  } | null;
  enforceGlobalAuth?: boolean;
  identityId?: string;
}

export interface MappedIdentity {
  userId: string;
  email?: string;
  name?: string;
  claims: Record<string, unknown>;
  providerId?: string;
}

export interface StudioSession {
  username: string;
}