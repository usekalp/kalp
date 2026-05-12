export interface ProviderIdentity {
  provider: string;
  accountId: string;
  email: string;
}

export interface DeployResult {
  workerUrl: string;
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
  deployRuntime(params: {
    cwd: string;
    configPath: string;
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
