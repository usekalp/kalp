import type { ModelTierMap } from "@kalphq/sdk";
import type { EffectMap } from "@kalphq/core";

export interface AiTransportConfig {
  modelTiers?: ModelTierMap;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  cloudflareGatewayId?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
}

function resolveModel(
  tier: string,
  modelTiers?: ModelTierMap,
): string {
  const fromMap = modelTiers?.[tier];
  if (fromMap) return fromMap;

  const defaults: Record<string, string> = {
    low: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    high: "@cf/meta/llama-3.1-8b-instruct",
  };
  return defaults[tier] ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
}

function isWorkersAiModel(model: string): boolean {
  return model.startsWith("@cf/") || model.startsWith("@hf/");
}

async function callWorkersAi(
  model: string,
  messages: Array<{ role: string; content: string }>,
  config: { accountId: string; apiToken: string },
  options?: { stream?: boolean; responseFormat?: { type: string }; temperature?: number },
): Promise<{ text: string }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      stream: options?.stream,
      ...(options?.responseFormat ? { response_format: options.responseFormat } : {}),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "Unknown error");
    throw new Error(`Workers AI request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    result?: { response?: string };
    success?: boolean;
    errors?: Array<{ message: string }>;
  };

  if (!data.success) {
    throw new Error(
      `Workers AI error: ${data.errors?.[0]?.message ?? "Unknown error"}`,
    );
  }

  return { text: data.result?.response ?? "" };
}

async function callOpenAiCompatible(
  model: string,
  messages: Array<{ role: string; content: string }>,
  config: { apiKey: string; baseUrl: string },
  options?: { stream?: boolean; responseFormat?: { type: string }; temperature?: number },
): Promise<{ text: string }> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: options?.stream,
      ...(options?.responseFormat ? { response_format: options.responseFormat } : {}),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "Unknown error");
    throw new Error(`AI request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message: { content: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text };
}

async function callAi(
  model: string,
  messages: Array<{ role: string; content: string }>,
  transport: AiTransportConfig,
  options?: { stream?: boolean; responseFormat?: { type: string }; temperature?: number },
): Promise<{ text: string }> {
  if (isWorkersAiModel(model)) {
    if (!transport.cloudflareAccountId || !transport.cloudflareApiToken) {
      throw new Error(
        `Model "${model}" requires Cloudflare Workers AI, but CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are not configured`,
      );
    }
    return callWorkersAi(
      model,
      messages,
      { accountId: transport.cloudflareAccountId, apiToken: transport.cloudflareApiToken },
      options,
    );
  }

  const apiKey = transport.openaiApiKey;
  const baseUrl = transport.openaiBaseUrl ?? "https://api.openai.com/v1";
  if (!apiKey) {
    throw new Error(
      `Model "${model}" requires an API key (OPENAI_API_KEY), but none is configured`,
    );
  }
  return callOpenAiCompatible(model, messages, { apiKey, baseUrl }, options);
}

export async function resolveAiGenerate(
  payload: Record<string, unknown>,
  transport: AiTransportConfig,
): Promise<EffectMap["ai.generate"]["result"]> {
  const { tier, prompt, schema, system } = payload as {
    tier: string;
    prompt: string;
    schema?: unknown;
    system?: string;
  };

  const model = resolveModel(tier, transport.modelTiers);
  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const { text } = await callAi(model, messages, transport, {
    responseFormat: schema ? { type: "json_object" } : undefined,
  });

  let parsed: unknown;
  if (schema) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  return { text, parsed, tier, resolvedModel: model };
}

export async function resolveAiStream(
  payload: Record<string, unknown>,
  transport: AiTransportConfig,
): Promise<EffectMap["ai.stream"]["result"]> {
  const { tier, prompt, system } = payload as {
    tier: string;
    prompt: string;
    system?: string;
  };

  const model = resolveModel(tier, transport.modelTiers);
  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const { text } = await callAi(model, messages, transport, {
    stream: true,
  });

  return text;
}

export async function resolveAiClassify(
  payload: Record<string, unknown>,
  transport: AiTransportConfig,
): Promise<EffectMap["ai.classify"]["result"]> {
  const { tier, input, classes, confidenceThreshold } = payload as {
    tier: string;
    input: string;
    classes: string[];
    confidenceThreshold?: number;
  };

  void confidenceThreshold;

  const model = resolveModel(tier, transport.modelTiers);
  const classList = classes.map((c) => `"${c}"`).join(", ");

  const { text: rawText } = await callAi(
    model,
    [
      {
        role: "system",
        content: [
          "You are a classification engine.",
          `Classify the following input into exactly one of these categories: ${classList}.`,
          "Respond with ONLY the category name, nothing else.",
        ].join("\n"),
      },
      { role: "user", content: input },
    ],
    transport,
    { temperature: 0 },
  );

  const trimmed = rawText.trim();
  const match = classes.find(
    (c) => c.toLowerCase() === trimmed.toLowerCase(),
  );
  return (match ?? trimmed) as EffectMap["ai.classify"]["result"];
}
