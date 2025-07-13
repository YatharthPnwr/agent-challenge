/**
 * GitHub Statistics Tool
 * ----------------------
 * This tool fetches comprehensive statistics about a GitHub repository
 * including stars, forks, issues, contributors, and more.
 *
 * Input: { repoUrl: string }
 * Output: Detailed repository statistics and metadata
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { parseGitHubUrl, GitHubRepoResponse, GitHubContributor, GitHubPullRequest } from "./utils";

export const githubStatisticsTool = createTool({
	id: "github-statistics",
	description: "Get comprehensive statistics about a GitHub repository",
	inputSchema: z.object({
		repoUrl: z.string().describe("GitHub repository URL, e.g., https://github.com/vercel/next.js"),
	}),
	outputSchema: z.object({
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
		})).max(3),
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
	}),
	execute: async ({ context }) => {
		return await getGitHubRepoStats(context.repoUrl);
	},
});

export const getGitHubRepoStats = async (repoUrl: string) => {
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
	
	const repoData: GitHubRepoResponse = await repoResponse.json();
	
	// Fetch contributors
	let contributors: GitHubContributor[] = [];
	try {
		const contributorsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`);
		if (contributorsResponse.ok) {
			contributors = await contributorsResponse.json();
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
			const prs: GitHubPullRequest[] = await prsResponse.json();
			openPRs = prs.filter(pr => pr.state === "open").length;
			closedPRs = prs.filter(pr => pr.state === "closed").length;
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
		contributors: contributors.slice(0, 3).map(contributor => ({
			username: contributor.login,
			contributions: contributor.contributions,
			profileUrl: contributor.html_url,
		})),
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
}; 