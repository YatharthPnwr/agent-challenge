import { Agent } from "@mastra/core/agent";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { model } from "../../config";

interface GitHubContributor {
	login: string;
	contributions: number;
	avatar_url: string;
	html_url: string;
}

interface GitHubPullRequest {
	number: number;
	state: string;
	title: string;
	created_at: string;
	closed_at: string | null;
}

const agent = new Agent({
  name: "GitHub Repository Analyst",
  model,
  instructions: `
        You are a GitHub repository analyst who excels at providing comprehensive insights about repositories. Analyze the repository data and provide detailed reports.

        When analyzing a repository, structure your response exactly as follows:

        📊 REPOSITORY OVERVIEW
        ═══════════════════════

        🏷️ BASIC INFORMATION
        • Name: [repository name]
        • Full Name: [owner/repo]
        • Description: [description or "No description provided"]
        • Owner: [owner name] ([owner type])

        📈 STATISTICS
        • Stars: [number] ⭐
        • Forks: [number] 🍴
        • Open Issues: [number] 🐛
        • Watchers: [number] 👀
        • Primary Language: [language or "Not specified"]

        👥 TOP CONTRIBUTORS
        [List top 3 contributors with their contribution counts]

        📅 ACTIVITY TIMELINE
        • Created: [date]
        • Last Updated: [date]
        • Last Push: [date]

        🔄 PULL REQUESTS
        • Open: [number]
        • Closed: [number]
        • Total: [number]

        📜 LICENSE
        • [License name] ([SPDX ID]) or "No license specified"

        🏷️ STATUS
        • Private: [Yes/No]
        • Archived: [Yes/No]
        • Disabled: [Yes/No]

        💡 INSIGHTS
        [Provide 2-3 interesting insights about the repository based on the data]

        Guidelines:
        - Format dates in a readable format (e.g., "January 15, 2024")
        - Provide insights about repository health, activity level, and community engagement
        - Keep the report informative but concise
        - Use emojis and formatting for better readability
      `,
});

const repoDataSchema = z.object({
  repository: z.object({
    name: z.string(),
    fullName: z.string(),
    description: z.string().nullable(),
    owner: z.string(),
    ownerType: z.string(),
  }),
  statistics: z.object({
    stars: z.number(),
    forks: z.number(),
    openIssues: z.number(),
    watchers: z.number(),
    primaryLanguage: z.string().nullable(),
  }),
  contributors: z.array(z.object({
    username: z.string(),
    contributions: z.number(),
    profileUrl: z.string(),
  })),
  activity: z.object({
    lastPush: z.string(),
    lastUpdate: z.string(),
    createdAt: z.string(),
  }),
  pullRequests: z.object({
    open: z.number(),
    closed: z.number(),
    total: z.number(),
  }),
  license: z.object({
    name: z.string(),
    spdxId: z.string(),
  }).nullable(),
  status: z.object({
    isPrivate: z.boolean(),
    isArchived: z.boolean(),
    isDisabled: z.boolean(),
  }),
});

const parseGitHubUrl = (url: string): { owner: string; repo: string } => {
  const githubRegex = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/.*)?$/;
  const match = url.match(githubRegex);
  
  if (!match) {
    throw new Error("Invalid GitHub repository URL. Please provide a URL in the format: https://github.com/owner/repo");
  }
  
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""), // Remove .git suffix if present
  };
};

const fetchRepoData = createStep({
  id: "fetch-repo-data",
  description: "Fetches comprehensive data about a GitHub repository",
  inputSchema: z.object({
    repoUrl: z.string().describe("The GitHub repository URL to analyze"),
  }),
  outputSchema: repoDataSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error("Input data not found");
    }

    const { repoUrl } = inputData;
    const { owner, repo } = parseGitHubUrl(repoUrl);
    
    // Fetch repository data
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    
    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        throw new Error(`Repository '${owner}/${repo}' not found. Please check the URL and ensure the repository exists.`);
      } else if (repoResponse.status === 403) {
        throw new Error("Rate limit exceeded. Please try again later or use a GitHub token for higher limits.");
      } else {
        throw new Error(`Failed to fetch repository data: ${repoResponse.status} ${repoResponse.statusText}`);
      }
    }
    
    const repoData = await repoResponse.json();
    
    // Fetch contributors
    let contributors: Array<{
      username: string;
      contributions: number;
      profileUrl: string;
    }> = [];
    try {
      const contributorsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`);
      if (contributorsResponse.ok) {
        const contributorsData = await contributorsResponse.json() as GitHubContributor[];
        contributors = contributorsData.slice(0, 3).map((contributor: GitHubContributor) => ({
          username: contributor.login,
          contributions: contributor.contributions,
          profileUrl: contributor.html_url,
        }));
      }
    } catch (error) {
      console.warn("Failed to fetch contributors:", error);
    }
    
    // Fetch pull requests
    let openPRs = 0;
    let closedPRs = 0;
    try {
      const prsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100`);
      if (prsResponse.ok) {
        const prs = await prsResponse.json() as GitHubPullRequest[];
        openPRs = prs.filter((pr: GitHubPullRequest) => pr.state === "open").length;
        closedPRs = prs.filter((pr: GitHubPullRequest) => pr.state === "closed").length;
      }
    } catch (error) {
      console.warn("Failed to fetch pull requests:", error);
    }

    return {
      repository: {
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        owner: repoData.owner.login,
        ownerType: repoData.owner.type,
      },
      statistics: {
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        watchers: repoData.watchers_count,
        primaryLanguage: repoData.language,
      },
      contributors,
      activity: {
        lastPush: repoData.pushed_at,
        lastUpdate: repoData.updated_at,
        createdAt: repoData.created_at,
      },
      pullRequests: {
        open: openPRs,
        closed: closedPRs,
        total: openPRs + closedPRs,
      },
      license: repoData.license ? {
        name: repoData.license.name,
        spdxId: repoData.license.spdx_id,
      } : null,
      status: {
        isPrivate: repoData.private,
        isArchived: repoData.archived,
        isDisabled: repoData.disabled,
      },
    };
  },
});

const generateReport = createStep({
  id: "generate-report",
  description: "Generates a comprehensive report about the repository (with emojis), using the LLM only for summary/insights.",
  inputSchema: repoDataSchema,
  outputSchema: z.object({
    report: z.string(),
  }),
  execute: async ({ inputData }) => {
    const repoData = inputData;
    if (!repoData) {
      throw new Error("Repository data not found");
    }
    // Ask the LLM for 2-3 interesting insights about the repo, not the whole Markdown
    const insightPrompt = `Given the following GitHub repository data, return ONLY 2-3 short bullet points of actionable insights for a developer or contributor. Do NOT repeat the repository data or generate a full report. Only output the bullet points.\n\n${JSON.stringify(repoData, null, 2)}`;
    let insights = "";
    try {
      const response = await agent.stream([
        { role: "user", content: insightPrompt },
      ]);
      for await (const chunk of response.textStream) {
        insights += chunk;
      }
    } catch (e) {
      insights = "(No insights available.)";
    }
    // Only keep the first 3 bullet points (lines starting with - or *)
    const insightLines = insights.split(/\r?\n/).filter(line => line.trim().startsWith("-") || line.trim().startsWith("*"));
    const topInsights = insightLines.slice(0, 3).join("\n");
    // Compose the emoji-rich Markdown report in code, now with a stats table
    const { repository, statistics, contributors, activity, pullRequests, license, status } = repoData;
    const contributorsList = contributors.length > 0
      ? contributors.map((c, i) => `- ${i + 1}. [${c.username}](${c.profileUrl}) — **${c.contributions.toLocaleString()}** commits`).join("\n")
      : "- No contributors found.";
    const licenseText = license ? `${license.name} (${license.spdxId})` : "No license specified";
    const statusText = `- 🔒 Private: **${status.isPrivate ? "Yes" : "No"}**\n- 🗄️ Archived: **${status.isArchived ? "Yes" : "No"}**\n- 🚦 Disabled: **${status.isDisabled ? "Yes" : "No"}**`;
    const activityText = `- **Created:** ${new Date(activity.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}\n- **Last Updated:** ${new Date(activity.lastUpdate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}\n- **Last Push:** ${new Date(activity.lastPush).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;
    const prText = `- 🔄 **Open PRs:** ${pullRequests.open}\n- ✅ **Closed PRs:** ${pullRequests.closed}\n- 📦 **Total PRs:** ${pullRequests.total}`;
    const statsTable = `| Stat | Value |\n|------|-------|\n| ⭐ Stars | ${statistics.stars.toLocaleString()} |\n| 🍴 Forks | ${statistics.forks.toLocaleString()} |\n| 🐛 Open Issues | ${statistics.openIssues.toLocaleString()} |\n| 👀 Watchers | ${statistics.watchers.toLocaleString()} |\n| 📝 Language | ${statistics.primaryLanguage || "Not specified"} |\n| 🏷️ License | ${licenseText} |\n| 🔒 Private | ${status.isPrivate ? "Yes" : "No"} |\n| 🗄️ Archived | ${status.isArchived ? "Yes" : "No"} |\n| 🚦 Disabled | ${status.isDisabled ? "Yes" : "No"} |\n| 🕒 Created | ${new Date(activity.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} |\n| 🔄 Last Updated | ${new Date(activity.lastUpdate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} |\n| ⏩ Last Push | ${new Date(activity.lastPush).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} |`;
    const friendlyIntro = `# 📊 GitHub Repository Report\n\n[${repository.fullName}](https://github.com/${repository.fullName})\n\n${repository.description ? `> _${repository.description}_` : ""}`;
    const friendlyOutro = `\n---\n✨ _This report was generated by your friendly GitHub Reporter Agent!_ ✨`;

    const markdown = `
${friendlyIntro}

## 📈 Statistics

${statsTable}

## 👤 Owner

- **${repository.owner}** (${repository.ownerType})

## 👥 Top Contributors

${contributorsList}

## 🕒 Activity Timeline

${activityText}

## 🔄 Pull Requests

${prText}

## 📜 License

- ${licenseText}

## 🏷️ Status

${statusText}

## 💡 Insights

${topInsights || insights}
${friendlyOutro}
`;
    return {
      report: markdown,
    };
  },
});

const githubReporterWorkflow = createWorkflow({
  id: "github-reporter-workflow",
  inputSchema: z.object({
    repoUrl: z.string().describe("The GitHub repository URL to analyze"),
  }),
  outputSchema: z.object({
    report: z.string(),
  }),
})
  .then(fetchRepoData)
  .then(generateReport);

githubReporterWorkflow.commit();

export { githubReporterWorkflow };