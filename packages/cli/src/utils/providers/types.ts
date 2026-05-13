export interface ProviderIdentity {
  provider: string;
  accountId: string;
  email: string;
}

export interface RemoteSecret {
  name: string;
  type?: string;
}

export interface DeployResult {
  workerUrl: string;
  customDomains?: string[];
  rawOutput: string;
}

export interface RuntimeProvider {
  name: string;
  login(): Promise<void>;
  whoami(): Promise<ProviderIdentity | null>;
  putSecret(params: {
    cwd: string;
    configPath: string;
    name: string;
    value: string;
  }): Promise<void>;
  listSecrets(params: {
    cwd: string;
    configPath: string;
  }): Promise<RemoteSecret[]>;
  deleteSecret(params: {
    cwd: string;
    configPath: string;
    name: string;
  }): Promise<void>;
  deployRuntime(params: {
    cwd: string;
    configPath: string;
    accountId?: string;
    useSecretsFile?: boolean;
  }): Promise<DeployResult>;
  putManifest(params: {
    cwd: string;
    configPath: string;
    key: string;
    jsonPath: string;
  }): Promise<void>;
  putValue(params: {
    cwd: string;
    configPath: string;
    key: string;
    value: string;
  }): Promise<void>;
  deleteValue(params: {
    cwd: string;
    configPath: string;
    key: string;
  }): Promise<void>;
  getValue(params: {
    cwd: string;
    configPath: string;
    key: string;
  }): Promise<string | null>;
  listNamespaces(params: {
    cwd: string;
    configPath: string;
  }): Promise<Array<{ id: string; title: string }>>;
}
