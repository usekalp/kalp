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
              group: ["@kalphq/test-utils*"],
              message: "Cloudflare package cannot depend on test-utils.",
            },
          ],
        },
      ],
    },
  },
];
