import "dotenv/config";
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "node:readline";
import { Coordinator } from "./coordinator.js";
import { teammates } from "./teammates.js";

const MODEL = "anthropic/claude-haiku-4.5";

const coordinator = new Coordinator(MODEL);

function buildOrchestratorPrompt(): string {
  const teammateList = coordinator.getTeammateDescriptions();

  return `You are a stock market orchestrator. You analyze the user's question and decide which teammates to involve.

Available teammates:
${teammateList}

You will receive teammate results and must synthesize them into a clear, unified answer for the user.

Respond with a JSON plan when you receive a question:
{
  "assignments": [
    { "teammate": "teammate-name", "task": "specific task description" }
  ]
}

If the question is a simple greeting or doesn't need research, respond with:
{ "assignments": [] , "directResponse": "your response here" }

IMPORTANT: Only respond with the JSON plan, nothing else.`;
}

async function planTasks(
  userQuestion: string,
  orchestratorPrompt: string
): Promise<{ assignments: { teammate: string; task: string }[]; directResponse?: string }> {
  let planText = "";

  for await (const message of query({
    prompt: userQuestion,
    options: {
      model: MODEL,
      systemPrompt: orchestratorPrompt,
      allowedTools: [],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          planText += block.text;
        }
      }
    } else if ("result" in message && message.subtype === "success") {
      planText = message.result || planText;
    }
  }

  try {
    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = planText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback: treat as direct response
  }

  return { assignments: [], directResponse: planText };
}

async function synthesize(
  userQuestion: string,
  results: { teammate: string; result: string; error?: string }[]
): Promise<string> {
  const context = results
    .map((r) => {
      if (r.error) return `**${r.teammate}** (error): ${r.error}`;
      return `**${r.teammate}**:\n${r.result}`;
    })
    .join("\n\n---\n\n");

  let synthesis = "";

  for await (const message of query({
    prompt: `User asked: "${userQuestion}"\n\nHere are the research results from my teammates:\n\n${context}\n\nSynthesize these into a clear, unified answer. Cite sources where available.`,
    options: {
      model: MODEL,
      systemPrompt:
        "You synthesize research from multiple analysts into clear, actionable stock market insights. Be concise but thorough. Use structured formatting.",
      allowedTools: [],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          synthesis += block.text;
        }
      }
    } else if ("result" in message && message.subtype === "success") {
      synthesis = message.result || synthesis;
    }
  }

  return synthesis;
}

async function handleQuestion(userQuestion: string): Promise<void> {
  // Step 1: Plan
  console.log("\n[Orchestrator] Planning...");
  const orchestratorPrompt = buildOrchestratorPrompt();
  const plan = await planTasks(userQuestion, orchestratorPrompt);

  if (plan.directResponse) {
    console.log(`\nAgent: ${plan.directResponse}`);
    return;
  }

  if (plan.assignments.length === 0) {
    console.log("\nAgent: I'm not sure how to help with that. Try asking about stocks, markets, or companies.");
    return;
  }

  // Step 2: Dispatch to teammates in parallel
  console.log(
    `[Orchestrator] Dispatching to: ${plan.assignments.map((a) => a.teammate).join(", ")}`
  );
  const results = await coordinator.assignParallel(plan.assignments);

  for (const r of results) {
    if (r.error) {
      console.log(`  [${r.teammate}] Error: ${r.error}`);
    } else {
      console.log(`  [${r.teammate}] Done (${r.result.length} chars)`);
    }
  }

  // Step 3: Synthesize
  console.log("[Orchestrator] Synthesizing...");
  const answer = await synthesize(userQuestion, results);
  console.log(`\nAgent: ${answer}`);
}

async function askQuestion(rl: readline.Interface): Promise<string> {
  return new Promise((resolve) => {
    rl.question("\nYou: ", (answer) => resolve(answer.trim()));
  });
}

async function main(): Promise<void> {
  console.log("Stock Market Agent (Teammate Architecture)");
  console.log("Initializing teammates...\n");

  await coordinator.initTeammates(teammates);

  console.log("\nAll teammates ready. Ask me anything about stocks, markets, or companies.");
  console.log("Type 'exit' to quit.\n");

  const question = process.argv.slice(2).join(" ");

  if (question) {
    await handleQuestion(question);
    await coordinator.shutdown();
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const input = await askQuestion(rl);
    if (!input || input.toLowerCase() === "exit") {
      console.log("\nShutting down teammates...");
      await coordinator.shutdown();
      console.log("Goodbye!");
      rl.close();
      break;
    }
    await handleQuestion(input);
  }
}

main().catch(console.error);
