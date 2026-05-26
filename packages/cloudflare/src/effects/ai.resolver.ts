import type { EffectMap } from "@kalphq/core";

export interface AiProviders {
  ai?: {
    baseUrl?: string;
    apiKey?: string;
    defaultModel?: string;
  };
}

export async function resolveAiGenerate(
  payload: Record<string, unknown>,
  providers: AiProviders,
): Promise<EffectMap["ai.generate"]["result"]> {
  const { prompt, schema, system } = payload as { prompt: string; schema?: unknown; system?: string };
  const model = providers.ai?.defaultModel ?? "gpt-4o";
  const apiKey = providers.ai?.apiKey ?? "";
  const baseUrl = providers.ai?.baseUrl ?? "https://api.openai.com/v1";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user" as const, content: prompt },
      ],
      ...(schema ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  const data = (await response.json()) as {
    choices?: Array<{ message: { content: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";

  let parsed: unknown;
  if (schema) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  return { text, parsed } as EffectMap["ai.generate"]["result"];
}

export async function resolveAiStream(
  payload: Record<string, unknown>,
  providers: AiProviders,
): Promise<EffectMap["ai.stream"]["result"]> {
  const { prompt, system } = payload as { prompt: string; system?: string };
  const model = providers.ai?.defaultModel ?? "gpt-4o";
  const apiKey = providers.ai?.apiKey ?? "";
  const baseUrl = providers.ai?.baseUrl ?? "https://api.openai.com/v1";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user" as const, content: prompt },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`AI stream request failed (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr) as { choices?: Array<{ delta?: { content?: string } }> };
          fullText += parsed.choices?.[0]?.delta?.content ?? "";
        } catch {
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText as EffectMap["ai.stream"]["result"];
}

export async function resolveAiClassify(
  payload: Record<string, unknown>,
  providers: AiProviders,
): Promise<EffectMap["ai.classify"]["result"]> {
  const { prompt, classes, system, confidenceThreshold } = payload as {
    prompt: string;
    classes: string[];
    system?: string;
    confidenceThreshold?: number;
  };
  void confidenceThreshold;

  const model = providers.ai?.defaultModel ?? "gpt-4o";
  const apiKey = providers.ai?.apiKey ?? "";
  const baseUrl = providers.ai?.baseUrl ?? "https://api.openai.com/v1";

  const classList = classes.map((c) => `"${c}"`).join(", ");
  const classifySystem = [
    system ?? "You are a classification engine.",
    `Classify the following input into exactly one of these categories: ${classList}.`,
    "Respond with ONLY the category name, nothing else.",
  ].join("\n");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: classifySystem },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    }),
  });

  const data = (await response.json()) as {
    choices?: Array<{ message: { content: string } }>;
  };
  const rawText = (data.choices?.[0]?.message?.content ?? "").trim();
  const match = classes.find(
    (c) => c.toLowerCase() === rawText.toLowerCase(),
  );
  return (match ?? rawText) as EffectMap["ai.classify"]["result"];
}