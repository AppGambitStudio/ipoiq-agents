import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Coordinator } from "./coordinator.js";
import { teammates } from "./teammates.js";

// Raise listener limit — each query() spawns a subprocess that adds exit listeners
process.setMaxListeners(50);

const MODEL = "anthropic/claude-haiku-4.5";
const MAX_CONCURRENCY = 5;
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

  const coordinator = new Coordinator(MODEL, teammates, MAX_CONCURRENCY);

  // Phase 1: Scan for open IPOs
  console.log("[Phase 1] Scanning for currently open IPOs in India...\n");
  const scanResult = await coordinator.scanIPOs();

  if (scanResult.ipos.length === 0) {
    console.log("No open IPOs found. Exiting.");
    return;
  }

  console.log(`Found ${scanResult.total_open_ipos} open IPO(s):\n`);
  for (const ipo of scanResult.ipos) {
    console.log(`  • ${ipo.name} (${ipo.company_full_name})`);
    console.log(`    ${ipo.price_band} | Lot: ${ipo.lot_size} | ${ipo.open_date} to ${ipo.close_date} | ${ipo.ipo_type || "N/A"}`);
  }

  // Phase 2: Research (macro + per-IPO analysis with concurrency limit)
  const totalAgents = 1 + scanResult.ipos.length * 5;
  console.log(`\n[Phase 2] Running research: ${totalAgents} agents (max ${MAX_CONCURRENCY} concurrent)...\n`);

  const { macro: macroResult, ipoResults } = await coordinator.runAllResearch(scanResult.ipos);

  // Summary of research phase
  console.log("\n[Phase 2] Research complete:");
  console.log(`  Macro: ${macroResult.error ? "FAILED" : `${macroResult.result.length} chars`}`);
  for (const bundle of ipoResults) {
    const sections = [bundle.growth, bundle.valuation, bundle.risk, bundle.news, bundle.sentiment];
    const failed = sections.filter((s) => s.error).length;
    const totalChars = sections.reduce((sum, s) => sum + s.result.length, 0);
    console.log(`  ${bundle.ipo.name}: ${totalChars} chars total, ${failed} failures`);
  }

  // Phase 3: Assemble final report
  console.log("\n[Phase 3] Assembling final investment report...\n");
  const report = await coordinator.assembleReport(macroResult, ipoResults);

  // Output report
  console.log("═".repeat(80));
  console.log(report);
  console.log("═".repeat(80));

  // Save to file
  await writeFile(outputPath, report, "utf-8");
  console.log(`\nReport saved to: ${outputPath}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Total time: ${elapsed}s`);
}

main().catch(console.error);
