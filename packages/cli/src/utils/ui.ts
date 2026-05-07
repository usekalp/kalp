import * as p from "@clack/prompts";
import type { TemplateId } from "@kalphq/project";

/**
 * Prompt user to select an agent template.
 */
export async function promptTemplateSelection(): Promise<TemplateId> {
  const answer = await p.select({
    message: "Choose an agent template:",
    options: [
      {
        value: "researcher",
        label: "🔬 Researcher",
        hint: "Deterministic scheduling - pause 24h and auto-resume",
      },
      {
        value: "support",
        label: "🎧 Support Agent",
        hint: "Human-in-the-Loop - pause for days until resolved",
      },
      {
        value: "blank",
        label: "⬜ Blank",
        hint: "Minimal structure with modern Kalp v1 syntax",
      },
    ],
  });

  if (p.isCancel(answer)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  return answer as TemplateId;
}

export async function promptProjectName(opts?: {
  message?: string;
  placeholder?: string;
  allowCurrentDir?: boolean;
}): Promise<string> {
  const message = opts?.message ?? "Project name?";
  const placeholder = opts?.placeholder ?? "my-project";
  const allowCurrentDir = opts?.allowCurrentDir ?? false;

  const answer = await p.text({
    message,
    placeholder,
    validate: (v) => {
      const value = v.trim();
      if (!value) return "Project name is required.";
      if (allowCurrentDir && value === ".") return;
      if (!/^[a-z0-9-]+$/.test(value)) {
        return allowCurrentDir
          ? "Use lowercase letters, numbers, and dashes only (or . for current directory)."
          : "Use lowercase letters, numbers, and dashes only.";
      }
    },
  });

  if (p.isCancel(answer)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  return answer.trim();
}

export async function promptAgentDetails(opts?: {
  includeTemplate?: boolean;
}): Promise<{
  name: string;
  template?: TemplateId;
}> {
  const answers = await p.group(
    {
      name: () =>
        p.text({
          message: "Agent name?",
          placeholder: "my-agent",
          validate: (v) => {
            if (!v.trim()) return "Agent name is required.";
            if (!/^[a-z0-9-]+$/.test(v)) {
              return "Use lowercase letters, numbers, and dashes only.";
            }
          },
        }),
      ...(opts?.includeTemplate && {
        template: () => promptTemplateSelection(),
      }),
    },
    {
      onCancel: () => {
        p.cancel("Cancelled.");
        process.exit(0);
      },
    },
  );

  return {
    name: answers.name,
    template: answers.template as TemplateId | undefined,
  };
}
