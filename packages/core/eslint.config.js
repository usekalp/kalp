import { config as baseConfig } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@kalphq/cloudflare*"],
              message: "Core cannot depend on Cloudflare package.",
            },
            {
              group: ["@kalphq/test-utils*"],
              message: "Core cannot depend on test-utils.",
            },
            {
              group: ["cloudflare:*"],
              message: "Core cannot import CF platform APIs.",
            },
            {
              group: ["@cloudflare/*"],
              message: "Core cannot import CF worker types.",
            },
          ],
        },
      ],
    },
  },
];
