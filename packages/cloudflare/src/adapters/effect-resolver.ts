import type {
  EffectResolver,
  Effect,
  EffectMap,
  EffectType,
} from "@kalphq/core";

export interface CloudflareProviders {
  ai?: {
    baseUrl?: string;
    apiKey?: string;
    defaultModel?: string;
  };
  vault?: Record<string, string>;
}

/**
 * Cloudflare effect resolver for executing external effects.
 *
 * Currently provides stub implementations - real implementations
 * would connect to AI APIs, KV storage, etc.
 */
export class CloudflareEffectResolver implements EffectResolver {
  constructor(private providers?: CloudflareProviders) {}

  async resolve<T extends EffectType>(
    effect: Effect<T>,
  ): Promise<EffectMap[T]["result"]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = effect.payload as any;
    switch (effect.type) {
      case "ai.generate": {
        const { prompt, schema, system } = p;
        const model = this.providers?.ai?.defaultModel ?? "gpt-4o";
        const apiKey = this.providers?.ai?.apiKey ?? "";
        const baseUrl =
          this.providers?.ai?.baseUrl ?? "https://api.openai.com/v1";

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              ...(system ? [{ role: "system", content: system }] : []),
              { role: "user", content: prompt },
            ],
            ...(schema
              ? { response_format: { type: "json_object", schema } }
              : {}),
          }),
        });

        const data = (await response.json()) as {
          choices?: Array<{ message: { content: string } }>;
        };
        const text = data.choices?.[0]?.message?.content ?? "";

        return {
          text,
          parsed: schema ? JSON.parse(text) : undefined,
        } as EffectMap[T]["result"];
      }

      case "storage.get": {
        return undefined as EffectMap[T]["result"];
      }

      case "storage.put": {
        return undefined as EffectMap[T]["result"];
      }

      case "storage.delete": {
        return undefined as EffectMap[T]["result"];
      }

      case "storage.list": {
        return [] as EffectMap[T]["result"];
      }

      case "storage.batch": {
        return undefined as EffectMap[T]["result"];
      }

      case "memory.append": {
        return undefined as EffectMap[T]["result"];
      }

      case "memory.list": {
        return [] as EffectMap[T]["result"];
      }

      case "memory.summarize": {
        return "" as EffectMap[T]["result"];
      }

      case "vault.get": {
        const key = p.key;
        return (this.providers?.vault?.[key] ??
          null) as EffectMap[T]["result"];
      }

      case "mcp.call": {
        return undefined as EffectMap[T]["result"];
      }

      case "fetch": {
        const { url, method, body, headers } = p;
        const response = await fetch(url, {
          method,
          body: body ? JSON.stringify(body) : undefined,
          headers: { ...headers },
        });
        const responseBody = await response.json().catch(() => null);
        return {
          status: response.status,
          body: responseBody,
          headers: Object.fromEntries(response.headers.entries()),
        } as EffectMap[T]["result"];
      }

      default:
        throw new Error(`Unknown effect type: ${effect.type}`);
    }
  }
}
