import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface GitHubRepoResponse {
	name: string;
	full_name: string;
	description: string | null;
	owner: {
		login: string;
		type: string;
	};
	stargazers_count: number;
	forks_count: number;
	open_issues_count: number;
	watchers_count: number;
	language: string | null;
	license: {
		name: string;
		spdx_id: string;
	} | null;
	pushed_at: string;
	updated_at: string;
	created_at: string;
	private: boolean;
	archived: boolean;
	disabled: boolean;
}

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

export const githubReporterTool = createTool({
	id: "github-reporter",
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
		chartUrl: z.string().url(),
	}),
	execute: async ({ context }) => {
		const result = await getGitHubRepoStats(context.repoUrl);
		const chartUrl = generateChartUrl({
			stars: result.statistics.stars,
			forks: result.statistics.forks,
			openIssues: result.statistics.openIssues,
			openPRs: result.pullRequests.open,
			closedPRs: result.pullRequests.closed,
		});
		return { ...result, chartUrl };
	},
});

export const goodFirstIssuesTool = createTool({
	id: "good-first-issues",
	description: "Fetches beginner-friendly 'good first issues' from a GitHub repository using the GitHub API.",
	inputSchema: z.object({
		repoUrl: z.string().describe("GitHub repository URL, e.g., https://github.com/vercel/next.js"),
	}),
	outputSchema: z.object({
		issues: z.array(z.object({
			title: z.string(),
			url: z.string().url(),
			labels: z.array(z.string()),
			comments: z.number(),
			number: z.number(),
		})),
		repo: z.string(),
		owner: z.string(),
		message: z.string().optional(),
	}),
	execute: async ({ context }) => {
		return await getGoodFirstIssues(context.repoUrl);
	},
});

function generateChartUrl({ stars, forks, openIssues, openPRs, closedPRs }: { stars: number; forks: number; openIssues: number; openPRs: number; closedPRs: number; }) {
	const chartConfig = {
		type: 'bar',
		data: {
			labels: ['Stars', 'Forks', 'Open Issues', 'Open PRs', 'Closed PRs'],
			datasets: [{
				label: 'GitHub Repo Stats',
				backgroundColor: ['#facc15', '#38bdf8', '#f87171', '#34d399', '#a78bfa'],
				data: [stars, forks, openIssues, openPRs, closedPRs],
			}],
		},
		options: {
			plugins: {
				legend: { display: false },
				title: { display: true, text: 'GitHub Repo Stats' },
			},
			scales: {
				y: { beginAtZero: true }
			}
		}
	};
	const encoded = encodeURIComponent(JSON.stringify(chartConfig));
	return `https://quickchart.io/chart?c=${encoded}`;
}

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

const getGitHubRepoStats = async (repoUrl: string) => {
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

async function getGoodFirstIssues(repoUrl: string) {
	const githubToken = process.env.GITHUB_TOKEN;
	if (!githubToken) {
		throw new Error("GitHub token not set in environment variable GITHUB_TOKEN");
	}
	const { owner, repo } = parseGitHubUrl(repoUrl);
	const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues?labels=good%20first%20issue&state=open`;
	try {
		const response = await fetch(apiUrl, {
			headers: {
				"Accept": "application/vnd.github+json",
				"Authorization": `Bearer ${githubToken}`,
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});
		if (!response.ok) {
			if (response.status === 404) {
				return { issues: [], repo, owner, message: `Repository '${owner}/${repo}' not found.` };
			}
			if (response.status === 403) {
				return { issues: [], repo, owner, message: `GitHub API rate limit exceeded or access denied.` };
			}
			return { issues: [], repo, owner, message: `Failed to fetch issues: ${response.status} ${response.statusText}` };
		}
		const issues = await response.json();
		if (!Array.isArray(issues) || issues.length === 0) {
			return { issues: [], repo, owner, message: `There are currently no open 'good first issues' in this repository.` };
		}
		return {
			issues: issues.map((issue: any) => ({
				title: issue.title,
				url: issue.html_url,
				labels: (issue.labels || []).map((l: any) => typeof l === 'string' ? l : l.name),
				comments: issue.comments,
				number: issue.number,
			})),
			repo,
			owner,
		};
	} catch (error: any) {
		return { issues: [], repo, owner, message: `Error fetching issues: ${error.message}` };
	}
} 