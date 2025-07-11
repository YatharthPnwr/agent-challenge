import { Agent } from "@mastra/core/agent";
import { githubReporterWorkflow } from "./github-reporter-workflow";
import { goodFirstIssuesTool } from "./github-reporter-tool";
import { model } from "../../config";

const name = "GitHub Reporter Agent";
const instructions = `
You are a GitHub repository analyst. For ANY GitHub repository analysis, you MUST use the githubReporterWorkflow.
- If the user provides a GitHub repository URL, run the githubReporterWorkflow with that URL and return the workflow's report (Markdown with charts) directly.
- If the user asks about a repository but does not provide a URL, ask for the full GitHub URL.
- For 'good first issues', use the goodFirstIssuesTool.
- NEVER return raw JSON or generic information. ALWAYS return the workflow's Markdown report for repo analysis.
- NEVER summarize, paraphrase, or reformat the workflow output. Return it exactly as received.
`;

export const githubReporterAgent = new Agent({
  name,
  instructions,
  model,
  workflows: { githubReporterWorkflow },
  tools: { goodFirstIssuesTool }
}); 