import type { EffectMap } from "@kalphq/core";

export async function resolveFetch(
  payload: Record<string, unknown>,
): Promise<EffectMap["fetch"]["result"]> {
  const { url, method, body, headers } = payload as {
    url: string;
    method: string;
    body?: unknown;
    headers?: Record<string, string>;
  };
  const response = await fetch(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: headers ?? {},
  });
  const responseBody = await response.json().catch(() => null);
  return {
    status: response.status,
    body: responseBody,
    headers: Object.fromEntries(response.headers.entries()),
  } as EffectMap["fetch"]["result"];
}