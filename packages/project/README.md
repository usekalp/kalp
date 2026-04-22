# @kalphq/project

Scaffold and template utilities for Kalp projects.

## ❗ Constraints

- **No imports** from `@kalphq/sdk`, `@kalphq/compiler`, or runtime
- **No knowledge** of IR, manifests, or execution
- **Only** filesystem + template generation

This package is shared by `create-kalp` (bootstrap) and `@kalphq/cli` (runtime tooling).
Both depend on it — they must never depend on each other.
