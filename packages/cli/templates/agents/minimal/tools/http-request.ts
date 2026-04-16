import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const httpRequest = createTool({
  id: "http_request",
  description: "Generic HTTP client for external API calls.",
  input: z.object({
    url: z.string(),
    method: z.string().default("GET"), // "GET", "POST", "PUT", "DELETE"
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
  }),
  async execute({ url, method, headers, body }) {
    // In real implementation, use fetch or axios
    // This is a stub showing the pattern

    return {
      statusCode: 200,
      status: "ok",
      url,
      method,
      bodyLength: body?.length ?? 0,
      timestamp: new Date().toISOString(),
    };
  },
});
