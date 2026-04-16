import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const createJiraIssue = createTool({
  id: "create_jira_issue",
  description: "Creates a bug ticket in Jira for technical issues requiring engineering.",
  input: z.object({
    summary: z.string(),
    description: z.string(),
    priority: z.string(), // "Low", "Medium", "High", "Critical"
    component: z.string().optional(),
    reporter: z.string(),
  }),
  async execute({ summary, description, priority, component, reporter }) {
    // In real implementation, call Jira REST API
    // POST /rest/api/2/issue

    const issueKey = `PROJ-${Math.floor(Math.random() * 10000)}`;

    return {
      created: true,
      issueKey,
      summary,
      priority,
      component: component ?? "General",
      reporter,
      url: `https://jira.example.com/browse/${issueKey}`,
    };
  },
});
