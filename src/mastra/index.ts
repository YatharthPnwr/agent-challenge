import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { weatherAgent } from "./agents/weather-agent/weather-agent"; // This can be deleted later
import { weatherWorkflow } from "./agents/weather-agent/weather-workflow"; // This can be deleted later
import { githubReporterAgent } from "./agents/github-reporter-agent/github-reporter-agent";
import { githubReporterWorkflow } from "./agents/github-reporter-agent/github-reporter-workflow";

console.log("\n--- Mastra Server Startup Info ---");
console.log("Available agent endpoints:");
console.log("  POST /agents/githubReporterAgent/run");
console.log("  POST /agents/weatherAgent/run");
console.log("Available workflow endpoints:");
console.log("  POST /workflows/github-reporter-workflow/run");
console.log("  POST /workflows/weather-workflow/run");
console.log("Model in use:", process.env.MODEL_NAME_AT_ENDPOINT ?? "qwen2.5:1.5b");
console.log("-----------------------------------\n");

export const mastra = new Mastra({
	workflows: { weatherWorkflow, githubReporterWorkflow }, // can be deleted later
	agents: { weatherAgent, githubReporterAgent },
	logger: new PinoLogger({
		name: "Mastra",
		level: "info",
	}),
	server: {
		port: 8080,
		timeout: 10000,
	},
});
