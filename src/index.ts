import "dotenv/config";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { agents } from "./teammates.js";
import { TEAM_LEAD_PROMPT } from "./prompts.js";

// Each query() spawns a subprocess that adds exit listeners
process.setMaxListeners(50);

const MODEL = "anthropic/claude-haiku-4.5";
const OUTPUT_DIR = "./ipo-analysis";

async function main(): Promise<void> {
  const startTime = Date.now();

  const fileName = process.argv[2];
  if (!fileName) {
    console.error("Usage: npm start -- <filename>");
    console.error('Example: npm start -- "IPO Investment Analysis - February 2026.md"');
    process.exit(1);
  }

  const outputPath = `${OUTPUT_DIR}/${fileName}`;
  await mkdir(dirname(outputPath), { recursive: true });

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   IPO Investment Analysis Agent System   ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`Output: ${outputPath}\n`);
  console.log("Team Lead is coordinating the analysis...\n");

  let report = "";

  for await (const message of query({
    prompt:
      "Analyze all currently open mainboard IPOs in India. Follow your workflow: scan for open IPOs, dispatch research agents, assemble the final investment report.",
    options: {
      model: MODEL,
      systemPrompt: TEAM_LEAD_PROMPT,
      allowedTools: ["Task"],
      agents,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    },
  })) {
    // Log progress
    if (message.type === "system" && message.subtype === "task_started") {
      console.log(`  [started] ${message.description}`);
    } else if (message.type === "system" && message.subtype === "task_notification") {
      const status = message.status === "completed" ? "done" : message.status;
      console.log(`  [${status}] ${message.summary?.slice(0, 100) || "task finished"}`);
    }

    // Capture final result
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          report += block.text;
        }
      }
    } else if ("result" in message && message.subtype === "success") {
      report = message.result || report;
    }
  }

  if (!report.trim()) {
    console.error("\nNo report generated. Check agent logs above.");
    process.exit(1);
  }

  // Output
  console.log("\n" + "═".repeat(80));
  console.log(report);
  console.log("═".repeat(80));

  await writeFile(outputPath, report, "utf-8");
  console.log(`\nReport saved to: ${outputPath}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Total time: ${elapsed}s`);
}

main().catch(console.error);
