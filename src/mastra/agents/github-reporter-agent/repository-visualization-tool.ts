/**
 * Repository Visualization Tool
 * -----------------------------
 * This tool generates bar chart, pie chart, and commits over time visualizations
 * for a GitHub repository.
 *
 * Input: { repoUrl: string }
 * Output: Rich markdown with embedded charts and insights
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { 
	parseGitHubUrl, 
	getRepositoryLanguages, 
	getRepoCommitActivity, 
	generateBarChartUrl, 
	generatePieChartUrl, 
	generateCommitsOverTimeChartUrl, 
	generateInsights 
} from "./utils";
import { getGitHubRepoStats } from "./github-statistics-tool";

export const repositoryVisualizationTool = createTool({
	id: "repository-visualization",
	description: "Generate bar chart, pie chart, and commits over time visualizations for a GitHub repository",
	inputSchema: z.object({
		repoUrl: z.string().describe("GitHub repository URL, e.g., https://github.com/vercel/next.js"),
	}),
	outputSchema: z.object({
		visualization: z.string(),
		repository: z.object({
			name: z.string(),
			fullName: z.string(),
		}),
	}),
	execute: async ({ context }) => {
		const repoData = await getGitHubRepoStats(context.repoUrl);
		const languages = await getRepositoryLanguages(context.repoUrl);
		const commitActivity = await getRepoCommitActivity(context.repoUrl);
		const commitsChartUrl = generateCommitsOverTimeChartUrl(commitActivity);
		
		const barChartUrl = generateBarChartUrl({
			stars: repoData.statistics.stars,
			forks: repoData.statistics.forks,
			openIssues: repoData.statistics.openIssues,
			openPRs: repoData.pullRequests.open,
			closedPRs: repoData.pullRequests.closed,
		});
		
		const pieChartUrl = generatePieChartUrl(languages);
		
		const languageCount = Object.keys(languages).length;
		const topLanguage = repoData.statistics.primaryLanguage || "Not specified";
		const totalStars = repoData.statistics.stars.toLocaleString();
		const totalForks = repoData.statistics.forks.toLocaleString();
		
		const visualization = `# 📊 Repository Visualization

## 🎯 ${repoData.repository.fullName}

Welcome to your repository visualization! Here's a beautiful breakdown of your project's key metrics and language distribution.

---

## 📈 **Repository Statistics Overview**

Your repository has some impressive numbers! Let's take a look at the key metrics:

- ⭐ **${totalStars}** stars (that's amazing!)
- 🍴 **${totalForks}** forks (great community engagement!)
- 🐛 **${repoData.statistics.openIssues.toLocaleString()}** open issues
- 🔄 **${repoData.pullRequests.open}** open pull requests
- ✅ **${repoData.pullRequests.closed}** closed pull requests

${barChartUrl ? `![Repository Statistics Bar Chart](${barChartUrl})` : ''}

---

## 🎨 **Language Distribution**

Your project uses **${languageCount}** different programming languages, with **${topLanguage}** being the primary language. Here's how the code is distributed:

${pieChartUrl ? `![Language Distribution Pie Chart](${pieChartUrl})` : ''}

---

## 📆 **Commits Over Time**

Here's how the commit activity has trended over the past year (each point is a week):

${commitsChartUrl ? `![Commits Over Time Line Chart](${commitsChartUrl})` : 'No commit activity data available.'}

---

## 💡 **Quick Insights**

${generateInsights(repoData, languages)}

---

✨ *Visualization generated with ❤️ by your GitHub Reporter Agent!* ✨`;
		
		return {
			visualization,
			repository: {
				name: repoData.repository.name,
				fullName: repoData.repository.fullName,
			},
		};
	},
}); 