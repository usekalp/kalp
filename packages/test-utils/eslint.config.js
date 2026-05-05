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
              message: "test-utils cannot depend on Cloudflare.",
            },
            {
              group: ["cloudflare:*"],
              message: "test-utils cannot import CF platform APIs.",
            },
            {
              group: ["@cloudflare/*"],
              message: "test-utils cannot import CF worker types.",
            },
          ],
        },
      ],
    },
  },
];
