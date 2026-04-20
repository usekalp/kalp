import * as p from "@clack/prompts";

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

export async function promptAgentDetails(): Promise<{
  name: string;
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
  };
}
