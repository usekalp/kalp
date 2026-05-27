import { execa } from "execa";
import { readFile } from "node:fs/promises";
import type { RuntimeProvider } from "@/utils/providers/types";
import { getCloudflareIdentity } from "@/utils/auth";
import { secretPut, secretList, secretDelete } from "./cloudflare-secrets";
import {
  kvPutManifest,
  kvPutValue,
  kvPutBulkValues,
  kvDeleteValue,
  kvGetValue,
  kvListNamespaces,
  kvListKeys,
} from "./cloudflare-kv";
import { findWorkerUrl, resolveCustomDomains } from "./cloudflare-domains";

export const cloudflareProvider: RuntimeProvider = {
  name: "cloudflare",
  async login() {
    await execa("npx", ["wrangler", "login"]);
  },
  async whoami() {
    const identity = await getCloudflareIdentity();
    const account = identity?.accounts?.[0];
    const accountId = account?.id ?? account?.account_tag;
    const email = identity?.email;
    if (!accountId || !email) return null;
    return { provider: "cloudflare", accountId, email };
  },
  async putSecret({ cwd, configPath, name, value }) {
    await secretPut(cwd, configPath, name, value);
  },
  async listSecrets({ cwd, configPath }) {
    return secretList(cwd, configPath);
  },
  async deleteSecret({ cwd, configPath, name }) {
    await secretDelete(cwd, configPath, name);
  },
  async deployRuntime({ cwd, configPath, useSecretsFile }) {
    const args = useSecretsFile
      ? ["wrangler", "deploy", "--config", configPath, "--secrets-file", ".env"]
      : ["wrangler", "deploy", "--config", configPath];
    const deploy = await execa("npx", args, { cwd });
    const rawOutput = [deploy.stdout, deploy.stderr].filter(Boolean).join("\n");
    const workerUrl = findWorkerUrl(rawOutput);
    const configText = await readFile(configPath, "utf-8").catch(() => null);
    const workerName = configText?.match(/"name"\s*:\s*"([^"]+)"/)?.[1];
    const customDomains = workerName
      ? await resolveCustomDomains({ cwd, configPath, workerName }).catch(() => [])
      : [];

    if (!workerUrl) {
      if (!workerName) {
        throw new Error("Could not resolve runtime URL from deployment output.");
      }
      return {
        workerUrl: `https://${workerName}.workers.dev`,
        customDomains,
        rawOutput,
      };
    }
    return { workerUrl, customDomains, rawOutput };
  },
  async putManifest({ cwd, configPath, key, jsonPath }) {
    await kvPutManifest(cwd, configPath, key, jsonPath);
  },
  async putValue({ cwd, configPath, key, value }) {
    await kvPutValue(cwd, configPath, key, value);
  },
  async putBulkValues({ cwd, configPath, values }) {
    await kvPutBulkValues(cwd, configPath, values);
  },
  async deleteValue({ cwd, configPath, key }) {
    await kvDeleteValue(cwd, configPath, key);
  },
  async getValue({ cwd, configPath, key }) {
    return kvGetValue(cwd, configPath, key);
  },
  async listNamespaces({ cwd, configPath }) {
    return kvListNamespaces(cwd, configPath);
  },
  async listKeys({ cwd, configPath, prefix }) {
    return kvListKeys(cwd, configPath, prefix ?? "");
  },
};
