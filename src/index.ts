import "dotenv/config";
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "node:readline";

const SYSTEM_PROMPT = `You are a stock market analyst agent. You help users with:
- Current stock prices and market data
- Company financial analysis
- Market trends and comparisons
- Stock performance over time

Use web search and fetch to get the latest market data when answering questions.
Always cite your sources and mention when data was last updated.`;

async function askQuestion(rl: readline.Interface): Promise<string> {
  return new Promise((resolve) => {
    rl.question("\nYou: ", (answer) => resolve(answer.trim()));
  });
}

async function runAgent(prompt: string): Promise<void> {
  console.log("\nAgent: Thinking...\n");

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      allowedTools: ["WebSearch", "WebFetch"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          console.log("Agent:", block.text);
        }
      }
    } else if ("result" in message) {
      console.log("Agent:", message.result);
    }
  }
}

async function main(): Promise<void> {
  const question = process.argv.slice(2).join(" ");

  if (question) {
    await runAgent(question);
    return;
  }

  console.log("Stock Market Agent (type 'exit' to quit)");
  console.log("Ask me anything about stocks, markets, or companies.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const input = await askQuestion(rl);
    if (!input || input.toLowerCase() === "exit") {
      console.log("Goodbye!");
      rl.close();
      break;
    }
    await runAgent(input);
  }
}

main().catch(console.error);
