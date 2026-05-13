import { cloudflareProvider } from "@/utils/providers/cloudflare";
import type { RuntimeProvider } from "@/utils/providers/types";

export function resolveProvider(): RuntimeProvider {
  return cloudflareProvider;
}

export type {
  RuntimeProvider,
  ProviderIdentity,
  DeployResult,
  RemoteSecret,
} from "@/utils/providers/types";
