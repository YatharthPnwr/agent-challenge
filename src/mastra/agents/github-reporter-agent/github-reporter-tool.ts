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

interface GitHubLanguage {
	[key: string]: number;
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
	}),
	execute: async ({ context }) => {
		return await getGitHubRepoStats(context.repoUrl);
	},
});

export const repositoryVisualizationTool = createTool({
	id: "repository-visualization",
	description: "Generate bar chart and pie chart visualizations for a GitHub repository",
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
		
		const barChartUrl = generateBarChartUrl({
			stars: repoData.statistics.stars,
			forks: repoData.statistics.forks,
			openIssues: repoData.statistics.openIssues,
			openPRs: repoData.pullRequests.open,
			closedPRs: repoData.pullRequests.closed,
		});
		
		const pieChartUrl = generatePieChartUrl(languages);
		
		// Create a friendly visualization report
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

export const goodFirstIssuesWithGuideTool = createTool({
	id: "good-first-issues-with-guide",
	description: "Fetches beginner-friendly 'good first issues' from a GitHub repository and provides specific, actionable guidance on how to solve each particular issue.",
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
		guide: z.string(),
	}),
	execute: async ({ context }) => {
		const issuesResult = await getGoodFirstIssues(context.repoUrl);
		const guide = await generateIssueSpecificGuide(context.repoUrl, issuesResult.issues);
		
		return {
			...issuesResult,
			guide,
		};
	},
});

function generateBarChartUrl({ stars, forks, openIssues, openPRs, closedPRs }: { stars: number; forks: number; openIssues: number; openPRs: number; closedPRs: number; }) {
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
		return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
	} catch (e) {
		return '';
	}
}

function generatePieChartUrl(languages: GitHubLanguage) {
	const languageNames = Array.isArray(Object.keys(languages)) && Object.keys(languages).length > 0 ? Object.keys(languages) : [];
	const languageBytes = Array.isArray(Object.values(languages)) && Object.values(languages).length > 0 ? Object.values(languages) : [];
	if (languageNames.length === 0 || languageBytes.length === 0) return '';
	const colors = [
		'#facc15', '#38bdf8', '#f87171', '#34d399', '#a78bfa',
		'#fb7185', '#fbbf24', '#10b981', '#8b5cf6', '#06b6d4'
	];
	const chartConfig = {
		type: 'pie',
		data: {
			labels: languageNames,
			datasets: [{
				data: languageBytes,
				backgroundColor: colors.slice(0, languageNames.length),
				borderWidth: 2,
				borderColor: '#ffffff'
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
		return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
	} catch (e) {
		return '';
	}
}

// Helper function to generate insights
function generateInsights(repoData: any, languages: GitHubLanguage): string {
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

// Generate a comprehensive guide for contributing to the repository
function generateContributorGuide(repoUrl: string): string {
	const { owner, repo } = parseGitHubUrl(repoUrl);
	
	return `# 🚀 Complete Guide to Contributing to ${repo}

## 🎯 Perfect for GSOC Applicants & New Contributors!

This comprehensive guide will walk you through the entire process of contributing to this repository, from understanding the issue to submitting your pull request.

---

## 📋 **Step 1: Understanding the Issue**

### Before You Start Coding:
1. **Read the Issue Carefully**: Understand what the issue is asking for
2. **Check Existing Comments**: See if there are any clarifications or discussions
3. **Ask Questions**: If something is unclear, comment on the issue to ask for clarification
4. **Research the Codebase**: Look at similar files or functions to understand the code style

### Questions to Ask Yourself:
- What is the expected behavior?
- What is the current behavior?
- What files will I need to modify?
- Are there any tests I need to update?

---

## 🛠️ **Step 2: Setting Up Your Development Environment**

### Prerequisites:
1. **Install Git**: Make sure you have Git installed on your system
2. **Install Required Tools**: Check the project's README for required dependencies
3. **Set Up Your Editor**: Use a code editor with good support for the project's language

### Fork and Clone:
\`\`\`bash
# Fork the repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/${repo}.git
cd ${repo}

# Add the original repository as upstream
git remote add upstream https://github.com/${owner}/${repo}.git
\`\`\`

### Install Dependencies:
\`\`\`bash
# Check the project's README for specific instructions
npm install  # or yarn install, or other package manager
\`\`\`

---

## 🔧 **Step 3: Making Your Changes**

### Create a New Branch:
\`\`\`bash
# Always work on a new branch
git checkout -b fix/issue-number-description
# Example: git checkout -b fix/123-add-user-authentication
\`\`\`

### Follow the Project's Style Guide:
1. **Code Style**: Follow the project's coding conventions
2. **Naming**: Use descriptive variable and function names
3. **Comments**: Add comments for complex logic
4. **Documentation**: Update documentation if needed

### Best Practices:
- Make small, focused changes
- Test your changes frequently
- Keep commits atomic and well-described
- Follow the existing code patterns

---

## 🧪 **Step 4: Testing Your Changes**

### Run Existing Tests:
\`\`\`bash
# Run the test suite
npm test  # or yarn test, or other test command

# Make sure all tests pass before submitting
\`\`\`

### Manual Testing:
1. **Test the Feature**: Make sure your changes work as expected
2. **Test Edge Cases**: Think about unusual inputs or scenarios
3. **Cross-browser Testing**: If it's a web project, test in different browsers
4. **Performance**: Ensure your changes don't significantly impact performance

### Write New Tests (if applicable):
- Add unit tests for new functions
- Add integration tests for new features
- Update existing tests if you changed behavior

---

## 📝 **Step 5: Committing Your Changes**

### Write Good Commit Messages:
\`\`\`bash
# Use conventional commit format
git commit -m "feat: add user authentication feature

- Add login/logout functionality
- Implement JWT token handling
- Add user profile management
- Fixes #123"
\`\`\`

### Commit Guidelines:
- Use present tense ("add" not "added")
- Use imperative mood ("move cursor" not "moves cursor")
- Keep the first line under 50 characters
- Add a blank line after the first line
- Use bullet points for details

---

## 🔄 **Step 6: Submitting Your Pull Request**

### Push Your Changes:
\`\`\`bash
git push origin fix/issue-number-description
\`\`\`

### Create the Pull Request:
1. Go to your fork on GitHub
2. Click "Compare & pull request"
3. Fill out the PR template (if available)

### PR Description Template:
\`\`\`markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] I have tested my changes locally
- [ ] All existing tests pass
- [ ] I have added new tests for my changes

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works

## Related Issues
Closes #123
\`\`\`

---

## 🤝 **Step 7: Responding to Review Feedback**

### Be Open to Feedback:
1. **Read Reviews Carefully**: Understand what the reviewers are asking for
2. **Ask Questions**: If you don't understand a comment, ask for clarification
3. **Make Requested Changes**: Implement the suggested improvements
4. **Be Patient**: Reviews can take time, especially in popular projects

### Updating Your PR:
\`\`\`bash
# Make changes based on feedback
git add .
git commit -m "address review feedback: improve error handling"
git push origin fix/issue-number-description
\`\`\`

---

## 🎉 **Step 8: Getting Your PR Merged**

### What Happens Next:
1. **Review Process**: Maintainers will review your code
2. **CI/CD Checks**: Automated tests will run
3. **Final Review**: Once approved, your PR will be merged
4. **Celebration**: Congratulations! You've contributed to open source!

---

## 💡 **Pro Tips for GSOC Applicants**

### Make Your Contributions Stand Out:
1. **Quality Over Quantity**: Focus on well-written, tested code
2. **Documentation**: Write clear commit messages and PR descriptions
3. **Communication**: Be responsive to feedback and questions
4. **Learning**: Use each contribution as a learning opportunity
5. **Consistency**: Make regular contributions to show your commitment

### Building Relationships:
- Engage with the community on issues and discussions
- Help other contributors with their questions
- Attend community events or meetings if available
- Show enthusiasm and willingness to learn

---

## 🔗 **Useful Resources**

- [GitHub Flow Guide](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [How to Write a Git Commit Message](https://cbea.ms/git-commit/)
- [Open Source Guide](https://opensource.guide/)

---

## 🆘 **Getting Help**

If you get stuck:
1. **Check the Documentation**: Look at README, CONTRIBUTING, and other docs
2. **Search Issues**: See if someone else had the same problem
3. **Ask in Discussions**: Many projects have GitHub Discussions for questions
4. **Join Community Channels**: Look for Discord, Slack, or other chat channels

---

**Remember**: Every contribution, no matter how small, is valuable to the open source community. Don't be afraid to start small and work your way up! 🌟

*Good luck with your contribution journey!* 🚀`;
}

// Generate issue-specific guidance for each good first issue
async function generateIssueSpecificGuide(repoUrl: string, issues: Array<{ title: string; url: string; labels: string[]; comments: number; number: number; }>): Promise<string> {
	const { owner, repo } = parseGitHubUrl(repoUrl);
	
	if (issues.length === 0) {
		return `# 📋 No Good First Issues Available

Currently, there are no open "good first issue" labeled issues in the ${repo} repository.

## 💡 What You Can Do:

1. **Check Back Later**: New good first issues are added regularly
2. **Look for Other Labels**: Try searching for issues labeled "help wanted", "documentation", or "bug"
3. **Ask the Community**: Comment on existing issues to express interest in contributing
4. **Create Your Own**: If you find a bug or have an improvement idea, create a new issue

## 🔍 Finding Other Issues to Work On:

- Search for issues with labels like: "help wanted", "documentation", "bug", "enhancement"
- Look for issues with low complexity or that are marked as beginner-friendly
- Check the project's CONTRIBUTING.md file for more guidance

*Keep checking back for new good first issues!* 🌟`;
	}

	let guide = `# 🚀 Good First Issues Guide for ${repo}

## 🎯 Issue-Specific Contribution Plans

Below you'll find detailed, actionable plans for each available good first issue. Each plan includes specific steps tailored to that particular issue.

---

`;

	// Generate specific guidance for each issue
	for (let i = 0; i < issues.length; i++) {
		const issue = issues[i];
		const issueNumber = issue.number;
		const issueTitle = issue.title;
		
		// Fetch detailed issue information
		const issueDetails = await fetchIssueDetails(owner, repo, issueNumber);
		
		guide += `## 📋 **Issue #${issueNumber}: ${issueTitle}**

### 🎯 **Issue Analysis**
${analyzeSpecificIssue(issueDetails)}

### 🛠️ **Specific Action Plan**

${generateSpecificActionPlan(issueDetails, repo)}

### 📁 **Files to Focus On**
${generateSpecificFileSuggestions(issueDetails)}

### 🧪 **Testing Approach**
${generateSpecificTestingStrategy(issueDetails)}

### 📝 **What to Submit**
${generateSpecificDeliverables(issueDetails)}

---

`;
	}

	guide += `## 🚀 **Getting Started**

### Prerequisites:
1. **Fork the Repository**: Go to https://github.com/${owner}/${repo} and click "Fork"
2. **Clone Your Fork**: \`git clone https://github.com/YOUR_USERNAME/${repo}.git\`
3. **Set Up Upstream**: \`git remote add upstream https://github.com/${owner}/${repo}.git\`
4. **Install Dependencies**: Check the project's README for setup instructions

### General Workflow:
1. Create a new branch: \`git checkout -b fix/issue-number-description\`
2. Make your changes following the specific plan above
3. Test your changes thoroughly
4. Commit with a clear message: \`git commit -m "fix: address issue #X - brief description"\`
5. Push to your fork: \`git push origin your-branch-name\`
6. Create a pull request with a detailed description

### 💡 **Tips for Success**
- Read the issue comments for additional context
- Ask questions if anything is unclear
- Follow the project's coding style and conventions
- Test your changes before submitting
- Be patient with the review process

---

**Good luck with your contributions!** 🌟`;

	return guide;
}

// Fetch detailed issue information from GitHub API
async function fetchIssueDetails(owner: string, repo: string, issueNumber: number): Promise<any> {
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

// Analyze the specific issue based on its actual content
function analyzeSpecificIssue(issueDetails: any): string {
	const title = issueDetails.title?.toLowerCase() || '';
	const body = issueDetails.body?.toLowerCase() || '';
	const labels = issueDetails.labels?.map((l: any) => l.name?.toLowerCase()) || [];
	
	// Extract key information from the issue
	let analysis = `**Issue Type**: ${determineIssueType(title, body, labels)}\n\n`;
	
	// Look for specific patterns in the issue
	if (body.includes('error') || body.includes('exception') || body.includes('bug')) {
		analysis += `**Problem**: This appears to be a bug or error that needs to be fixed.\n`;
	}
	
	if (body.includes('firefox') || body.includes('chrome') || body.includes('browser')) {
		analysis += `**Browser Specific**: This issue may be browser-specific and needs cross-browser testing.\n`;
	}
	
	if (body.includes('test') || body.includes('spec') || labels.includes('test')) {
		analysis += `**Testing Related**: This involves writing or improving tests.\n`;
	}
	
	if (body.includes('documentation') || body.includes('docs') || labels.includes('documentation')) {
		analysis += `**Documentation**: This requires updating or creating documentation.\n`;
	}
	
	if (body.includes('performance') || body.includes('optimize') || labels.includes('performance')) {
		analysis += `**Performance**: This involves performance improvements or optimizations.\n`;
	}
	
	// Extract specific requirements
	const requirements = extractRequirements(body);
	if (requirements.length > 0) {
		analysis += `\n**Key Requirements**:\n${requirements.map(req => `- ${req}`).join('\n')}\n`;
	}
	
	return analysis;
}

// Determine the type of issue based on content
function determineIssueType(title: string, body: string, labels: string[]): string {
	if (labels.includes('bug')) return 'Bug Fix';
	if (labels.includes('documentation')) return 'Documentation';
	if (labels.includes('enhancement')) return 'Feature Enhancement';
	if (labels.includes('test')) return 'Testing';
	if (labels.includes('performance')) return 'Performance';
	if (title.includes('fix') || body.includes('fix')) return 'Bug Fix';
	if (title.includes('add') || body.includes('add')) return 'Feature Addition';
	if (title.includes('improve') || body.includes('improve')) return 'Improvement';
	return 'General Issue';
}

// Extract specific requirements from issue body
function extractRequirements(body: string): string[] {
	const requirements: string[] = [];
	
	// Look for common requirement patterns
	if (body.includes('should') || body.includes('must') || body.includes('need')) {
		const sentences = body.split(/[.!?]+/);
		sentences.forEach(sentence => {
			if (sentence.includes('should') || sentence.includes('must') || sentence.includes('need')) {
				const cleanSentence = sentence.trim().replace(/^\w+\s+/, ''); // Remove leading words like "This"
				if (cleanSentence.length > 10) {
					requirements.push(cleanSentence);
				}
			}
		});
	}
	
	return requirements.slice(0, 5); // Limit to 5 requirements
}

// Generate specific action plan based on issue details
function generateSpecificActionPlan(issueDetails: any, repo: string): string {
	const title = issueDetails.title?.toLowerCase() || '';
	const body = issueDetails.body?.toLowerCase() || '';
	const issueType = determineIssueType(title, body, issueDetails.labels?.map((l: any) => l.name?.toLowerCase()) || []);
	
	switch (issueType) {
		case 'Bug Fix':
			return `1. **Reproduce the Issue**
   - Follow the exact steps described in the issue
   - Confirm you can reproduce the problem consistently
   - Note any specific conditions (browser, OS, etc.)

2. **Debug and Identify Root Cause**
   - Use browser dev tools or debugging tools
   - Add console.log statements to trace the problem
   - Identify which file(s) and function(s) are involved

3. **Implement the Fix**
   - Make minimal changes to resolve the issue
   - Ensure your fix doesn't break existing functionality
   - Follow React's coding conventions and patterns

4. **Test Thoroughly**
   - Test the fix in the same environment where the bug occurred
   - Test related functionality to ensure nothing broke
   - Test in different browsers if it's a browser-specific issue

5. **Add Tests**
   - Write a test that reproduces the original bug
   - Ensure the test passes with your fix
   - Add regression tests if appropriate`;

		case 'Documentation':
			return `1. **Understand What Needs Documentation**
   - Identify the specific feature or functionality
   - Determine what information is missing or unclear
   - Check existing documentation for style and format

2. **Research the Topic**
   - Understand the feature thoroughly
   - Look at similar documentation in the project
   - Check if there are examples or code samples

3. **Write Clear Documentation**
   - Use clear, concise language
   - Include code examples where helpful
   - Follow the project's documentation style

4. **Review and Refine**
   - Check for accuracy and completeness
   - Ensure proper formatting and grammar
   - Test any code examples you include`;

		case 'Testing':
			return `1. **Understand What to Test**
   - Identify the specific functionality that needs testing
   - Understand the expected behavior
   - Look at existing tests for patterns and conventions

2. **Design Comprehensive Tests**
   - Cover normal usage scenarios
   - Include edge cases and error conditions
   - Plan for both unit and integration tests

3. **Write the Tests**
   - Follow React's testing patterns (Jest, React Testing Library)
   - Make tests readable and maintainable
   - Ensure tests are isolated and repeatable

4. **Verify Test Coverage**
   - Run the tests to ensure they pass
   - Check that they actually test the intended functionality
   - Update tests if the implementation changes`;

		default:
			return `1. **Understand the Issue**
   - Read the issue description and comments carefully
   - Ask questions if anything is unclear
   - Research similar implementations in the React codebase

2. **Plan Your Approach**
   - Break down the work into smaller, manageable tasks
   - Identify dependencies and potential challenges
   - Consider the impact on existing React functionality

3. **Implement the Solution**
   - Follow React's coding standards and patterns
   - Make incremental changes and test frequently
   - Document your approach and decisions

4. **Test and Refine**
   - Test your implementation thoroughly
   - Get feedback from the React community
   - Iterate based on feedback`;
	}
}

// Generate specific file suggestions based on issue content
function generateSpecificFileSuggestions(issueDetails: any): string {
	const title = issueDetails.title?.toLowerCase() || '';
	const body = issueDetails.body?.toLowerCase() || '';
	const labels = issueDetails.labels?.map((l: any) => l.name?.toLowerCase()) || [];
	
	let suggestions = '';
	
	if (title.includes('firefox') || body.includes('firefox') || title.includes('browser')) {
		suggestions += `- **Browser-specific files**: Look for browser detection or compatibility code\n`;
	}
	
	if (title.includes('symbol') || body.includes('symbol') || title.includes('function')) {
		suggestions += `- **Value handling files**: Look for files that handle prop values, especially \`value\` and \`defaultValue\` props\n`;
	}
	
	if (labels.includes('documentation')) {
		suggestions += `- **Documentation files**: \`README.md\`, \`docs/\` directory, API documentation\n`;
	}
	
	if (labels.includes('test')) {
		suggestions += `- **Test files**: \`__tests__/\` directories, \`*.test.js\` files\n`;
	}
	
	if (title.includes('breakpoint') || body.includes('breakpoint')) {
		suggestions += `- **Debugging files**: Look for files related to debugging, development tools, or browser integration\n`;
	}
	
	if (!suggestions) {
		suggestions = `- **Source files**: Check the main React source code files\n`;
		suggestions += `- **Test files**: Look for existing tests related to this functionality\n`;
		suggestions += `- **Documentation**: Update relevant documentation if user-facing changes\n`;
	}
	
	return suggestions;
}

// Generate specific testing strategy
function generateSpecificTestingStrategy(issueDetails: any): string {
	const title = issueDetails.title?.toLowerCase() || '';
	const body = issueDetails.body?.toLowerCase() || '';
	
	let strategy = '';
	
	if (title.includes('firefox') || body.includes('firefox')) {
		strategy += `- **Cross-browser Testing**: Test specifically in Firefox and other browsers\n`;
	}
	
	if (title.includes('symbol') || title.includes('function')) {
		strategy += `- **Type Testing**: Test with Symbol and Function values specifically\n`;
		strategy += `- **Edge Case Testing**: Test with various prop value types\n`;
	}
	
	if (title.includes('breakpoint') || body.includes('breakpoint')) {
		strategy += `- **Debugging Testing**: Test with browser dev tools and breakpoints\n`;
		strategy += `- **Browser Integration Testing**: Test browser-specific behavior\n`;
	}
	
	if (!strategy) {
		strategy = `- **Functional Testing**: Verify the implementation works as expected\n`;
		strategy += `- **Regression Testing**: Ensure existing functionality isn't broken\n`;
		strategy += `- **Edge Case Testing**: Test with unusual inputs or conditions\n`;
	}
	
	return strategy;
}

// Generate specific deliverables
function generateSpecificDeliverables(issueDetails: any): string {
	const title = issueDetails.title?.toLowerCase() || '';
	const body = issueDetails.body?.toLowerCase() || '';
	
	let deliverables = '';
	
	if (title.includes('firefox') || body.includes('firefox')) {
		deliverables += `- **Browser Fix**: Code changes that resolve the Firefox-specific issue\n`;
		deliverables += `- **Cross-browser Tests**: Tests that verify the fix works across browsers\n`;
	}
	
	if (title.includes('symbol') || title.includes('function')) {
		deliverables += `- **Type Handling Fix**: Code that properly handles Symbol and Function values\n`;
		deliverables += `- **Type Tests**: Tests that verify proper handling of different value types\n`;
	}
	
	if (title.includes('breakpoint') || body.includes('breakpoint')) {
		deliverables += `- **Debugging Fix**: Code that resolves the breakpoint-related issue\n`;
		deliverables += `- **Debugging Tests**: Tests that verify debugging functionality works correctly\n`;
	}
	
	if (!deliverables) {
		deliverables = `- **Code Implementation**: The actual code changes to resolve the issue\n`;
		deliverables += `- **Tests**: Tests that verify the fix works and won't regress\n`;
		deliverables += `- **Documentation**: Updates to relevant documentation if needed\n`;
	}
	
	deliverables += `- **Pull Request**: A well-described PR with clear explanation of the changes\n`;
	
	return deliverables;
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

const getRepositoryLanguages = async (repoUrl: string): Promise<GitHubLanguage> => {
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