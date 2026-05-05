import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineRoute } from "../src";

describe("defineRoute", () => {
  it("attaches kind route", () => {
    const route = defineRoute({
      id: "health",
      method: "GET",
      path: "/health",
      handler: async () => ({ ok: true }),
    });

    expect(route.kind).toBe("route");
    expect(route.id).toBe("health");
    expect(route.path).toBe("/health");
    expect(route.method).toBe("GET");
    expect("handler" in route).toBe(true);
  });

  it("supports all HTTP methods", () => {
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

    for (const method of methods) {
      const route = defineRoute({
        id: `route-${method.toLowerCase()}`,
        method,
        path: `/test`,
        handler: async () => {},
      });

      expect(route.method).toBe(method);
    }
  });

  it("supports input schema", () => {
    const route = defineRoute({
      id: "create-user",
      method: "POST",
      path: "/users",
      inputSchema: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
      handler: async () => ({ created: true }),
    });

    expect(route.inputSchema).toBeDefined();
  });
});
