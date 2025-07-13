/**
 * GitHub Reporter Agent - Shared Utilities
 * ----------------------------------------
 * This file contains all shared types, interfaces, and utility functions
 * used across the GitHub reporter tools.
 */

// Type definitions
export interface GitHubRepoResponse {
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

export interface GitHubContributor {
	login: string;
	contributions: number;
	avatar_url: string;
	html_url: string;
}

export interface GitHubPullRequest {
	number: number;
	state: string;
	title: string;
	created_at: string;
	closed_at: string | null;
}

export interface GitHubLanguage {
	[key: string]: number;
}

// Utility functions
export const parseGitHubUrl = (url: string): { owner: string; repo: string } => {
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

// Chart generation utilities
export function generateBarChartUrl({ stars, forks, openIssues, openPRs, closedPRs }: { stars: number; forks: number; openIssues: number; openPRs: number; closedPRs: number; }) {
	const safeData = [stars, forks, openIssues, openPRs, closedPRs].map(x => (typeof x === 'number' && isFinite(x) ? x : 0));
	// If all data is zero, treat as no data
	if (safeData.every(x => x === 0)) return '';
	const chartConfig = {
		type: 'bar',
		data: {
			labels: ['Stars', 'Forks', 'Open Issues', 'Open PRs', 'Closed PRs'],
			datasets: [{
				label: 'GitHub Repo Stats',
				backgroundColor: ['#facc15', '#38bdf8', '#f87171', '#34d399', '#a78bfa'],
				data: safeData,
			}]
		},
		options: {
			plugins: {
				legend: { display: false },
				title: { display: true, text: 'Repository Statistics' }
			},
			scales: {
				y: { beginAtZero: true }
			}
		}
	};
	try {
		return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=500&height=220`;
	} catch (e) {
		return '';
	}
}

export function getColorPalette(n: number): string[] {
	const baseColors = [
		'#facc15', '#38bdf8', '#f87171', '#34d399', '#a78bfa',
		'#fb7185', '#fbbf24', '#10b981', '#8b5cf6', '#06b6d4',
		'#eab308', '#0ea5e9', '#ef4444', '#22d3ee', '#6366f1',
		'#f472b6', '#fde68a', '#4ade80', '#c084fc', '#7dd3fc'
	];
	const colors: string[] = [];
	for (let i = 0; i < n; i++) {
		colors.push(baseColors[i % baseColors.length]);
	}
	return colors;
}

export function generatePieChartUrl(languages: GitHubLanguage) {
	const languageNames = Array.isArray(Object.keys(languages)) && Object.keys(languages).length > 0 ? Object.keys(languages) : [];
	const languageBytes = Array.isArray(Object.values(languages)) && Object.values(languages).length > 0 ? Object.values(languages) : [];
	if (languageNames.length === 0 || languageBytes.length === 0) return '';
	const colors = getColorPalette(languageNames.length);
	const chartConfig = {
		type: 'pie',
		data: {
			labels: languageNames,
			datasets: [{
				data: languageBytes,
				backgroundColor: colors,
				borderWidth: 0
			}]
		},
		options: {
			plugins: {
				legend: { display: true, position: 'bottom' },
				title: { display: true, text: 'Language Distribution' },
				datalabels: { display: false },
				tooltip: { enabled: false }
			},
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: null }
		}
	};
	try {
		return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=500&height=220`;
	} catch (e) {
		return '';
	}
}

// Generate a QuickChart line chart for commits over time
export function generateCommitsOverTimeChartUrl(commits: { labels: string[]; data: number[] }) {
	if (!commits.labels.length || !commits.data.length) return '';
	const chartConfig = {
		type: 'line',
		data: {
			labels: commits.labels,
			datasets: [{
				label: 'Commits per Week',
				data: commits.data,
				fill: false,
				borderColor: '#a78bfa',
				backgroundColor: '#a78bfa',
				tension: 0.2,
				pointRadius: 1,
				pointHoverRadius: 3,
			}],
		},
		options: {
			plugins: {
				legend: { display: false },
				title: { display: true, text: 'Commits Over Time' },
			},
			scales: {
				y: { beginAtZero: true }
			},
		}
	};
	try {
		return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=500&height=220`;
	} catch (e) {
		return '';
	}
}

// Helper function to generate insights
export function generateInsights(repoData: any, languages: GitHubLanguage): string {
	const insights = [];
	
	// Star insights
	if (repoData.statistics.stars > 1000) {
		insights.push("🌟 **Star Power**: This repository has gained significant popularity with over 1,000 stars!");
	} else if (repoData.statistics.stars > 100) {
		insights.push("⭐ **Growing Popularity**: The repository is gaining traction with a good number of stars!");
	}
	
	// Language insights
	const languageCount = Object.keys(languages).length;
	if (languageCount > 5) {
		insights.push("🔧 **Multi-Language Project**: This is a diverse project using multiple programming languages!");
	} else if (languageCount === 1) {
		insights.push("🎯 **Focused Development**: A single-language project shows focused and consistent development!");
	}
	
	// Activity insights
	const lastUpdate = new Date(repoData.activity.lastUpdate);
	const daysSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
	if (daysSinceUpdate < 7) {
		insights.push("🚀 **Active Development**: The repository is actively maintained with recent updates!");
	} else if (daysSinceUpdate < 30) {
		insights.push("📅 **Regular Updates**: The project receives regular maintenance and updates!");
	}
	
	// Fork insights
	if (repoData.statistics.forks > repoData.statistics.stars * 0.5) {
		insights.push("🤝 **Community Driven**: High fork-to-star ratio indicates strong community engagement!");
	}
	
	// Default insight if none generated
	if (insights.length === 0) {
		insights.push("📊 **Data Ready**: Your repository data is ready for analysis and insights!");
	}
	
	return insights.map(insight => `- ${insight}`).join('\n');
}

// GitHub API helper functions
export const getRepositoryLanguages = async (repoUrl: string): Promise<GitHubLanguage> => {
	const { owner, repo } = parseGitHubUrl(repoUrl);
	
	try {
		const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`);
		if (!response.ok) {
			console.warn("Failed to fetch languages:", response.statusText);
			return {};
		}
		return await response.json();
	} catch (error) {
		console.warn("Failed to fetch languages:", error);
		return {};
	}
};

// Fetch commit activity (aggregate by month for shorter URLs)
export async function getRepoCommitActivity(repoUrl: string): Promise<{ labels: string[]; data: number[] }> {
	const { owner, repo } = parseGitHubUrl(repoUrl);
	const githubToken = process.env.GITHUB_TOKEN;
	const headers: Record<string, string> = {
		"Accept": "application/vnd.github+json"
	};
	if (githubToken) {
		headers["Authorization"] = `Bearer ${githubToken}`;
	}
	try {
		const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`, { headers });
		if (!response.ok) return { labels: [], data: [] };
		const weeks = await response.json();
		if (!Array.isArray(weeks) || weeks.length === 0) return { labels: [], data: [] };
		// Aggregate by month
		const monthly: Record<string, number> = {};
		weeks.forEach((w: any) => {
			const d = new Date(w.week * 1000);
			const month = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
			monthly[month] = (monthly[month] || 0) + w.total;
		});
		const labels = Object.keys(monthly);
		const data = labels.map(month => monthly[month]);
		return { labels, data };
	} catch (e) {
		return { labels: [], data: [] };
	}
}

// Fetch detailed issue information from GitHub API
export async function fetchIssueDetails(owner: string, repo: string, issueNumber: number): Promise<any> {
	const githubToken = process.env.GITHUB_TOKEN;
	const headers: Record<string, string> = {
		"Accept": "application/vnd.github+json"
	};
	if (githubToken) {
		headers["Authorization"] = `Bearer ${githubToken}`;
	}
	
	try {
		const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, { headers });
		if (response.ok) {
			return await response.json();
		}
	} catch (error) {
		console.warn(`Failed to fetch issue #${issueNumber}:`, error);
	}
	
	// Return basic info if API call fails
	return {
		title: `Issue #${issueNumber}`,
		body: "Unable to fetch issue details",
		labels: [],
		comments: 0
	};
} 