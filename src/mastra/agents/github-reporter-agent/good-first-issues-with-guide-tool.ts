/**
 * Good First Issues With Guide Tool
 * ---------------------------------
 * This tool fetches beginner-friendly 'good first issues' from a GitHub repository and provides
 * specific, actionable guidance on how to solve each particular issue.
 *
 * Input: { repoUrl: string }
 * Output: List of good first issues and a detailed guide (see outputSchema)
 *
 * Usage: Used to help new contributors not only find issues, but also get step-by-step guidance
 * for solving them.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { parseGitHubUrl, fetchIssueDetails } from "./utils";
import { getGoodFirstIssues } from "./good-first-issues-tool";

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
   - Follow the project's coding conventions and patterns

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
   - Follow the project's testing patterns
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
   - Research similar implementations in the codebase

2. **Plan Your Approach**
   - Break down the work into smaller, manageable tasks
   - Identify dependencies and potential challenges
   - Consider the impact on existing functionality

3. **Implement the Solution**
   - Follow the project's coding standards and patterns
   - Make incremental changes and test frequently
   - Document your approach and decisions

4. **Test and Refine**
   - Test your implementation thoroughly
   - Get feedback from the community
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
		suggestions = `- **Source files**: Check the main source code files\n`;
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