import dotenv from "dotenv";
import { createOllama } from "ollama-ai-provider";

// Load environment variables once at the beginning
dotenv.config();

// Debug: Print all environment variables that might affect the baseURL
console.log("Environment variables:");
console.log("API_BASE_URL:", process.env.API_BASE_URL);
console.log("BASE_URL:", process.env.BASE_URL);
console.log("OLLAMA_HOST:", process.env.OLLAMA_HOST);
console.log("OLLAMA_ORIGINS:", process.env.OLLAMA_ORIGINS);

// Export all your environment variables
// Defaults to Ollama qwen2.5:1.5b
// https://ollama.com/library/qwen2.5
export const modelName = process.env.MODEL_NAME_AT_ENDPOINT ?? "qwen2.5:1.5b";

// Explicitly set the baseURL to local Ollama, ignoring any other BASE_URL variables
export const baseURL = "http://127.0.0.1:11434/api";

// Create and export the model instance
export const model = createOllama({ baseURL }).chat(modelName, {
  simulateStreaming: true,
});

console.log(`ModelName: ${modelName}\nbaseURL: ${baseURL}`);
