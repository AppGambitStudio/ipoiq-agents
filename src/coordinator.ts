import { query } from "@anthropic-ai/claude-agent-sdk";
import type { TeammateConfig } from "./teammates.js";
import type { AgentResult, IPOResearchBundle, IPOScanResult, ScannedIPO } from "./types.js";

/** Run async tasks with a concurrency limit */
async function pooled<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export class Coordinator {
  private teammates = new Map<string, TeammateConfig>();
  private model: string;
  private maxConcurrency: number;

  constructor(model: string, configs: TeammateConfig[], maxConcurrency = 5) {
    this.model = model;
    this.maxConcurrency = maxConcurrency;
    for (const config of configs) {
      this.teammates.set(config.name, config);
    }
  }

  /** Run a single agent task via query() and collect the result */
  async runAgent(teammateName: string, task: string, ipoName = ""): Promise<AgentResult> {
    const config = this.teammates.get(teammateName);
    if (!config) {
      return { agent: teammateName, ipo_name: ipoName, result: "", error: `Unknown teammate: ${teammateName}` };
    }

    const startTime = Date.now();
    let resultText = "";

    try {
      for await (const message of query({
        prompt: task,
        options: {
          model: this.model,
          systemPrompt: config.systemPrompt,
          tools: config.tools.length > 0 ? config.tools : [],
          allowedTools: config.tools,
          maxTurns: config.maxTurns,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
        },
      })) {
        if (message.type === "assistant") {
          for (const block of message.message.content) {
            if (block.type === "text") {
              resultText += block.text;
            }
          }
        } else if ("result" in message && message.subtype === "success") {
          resultText = message.result || resultText;
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        agent: teammateName,
        ipo_name: ipoName,
        result: "",
        error: errMsg,
        duration_ms: Date.now() - startTime,
      };
    }

    return {
      agent: teammateName,
      ipo_name: ipoName,
      result: resultText,
      duration_ms: Date.now() - startTime,
    };
  }

  /** Phase 1: Scan for open IPOs and parse structured JSON */
  async scanIPOs(): Promise<IPOScanResult> {
    const result = await this.runAgent(
      "ipo-scanner",
      "Fetch https://groww.in/ipo?filter=mainboard and find all currently open mainboard IPOs in India. Extract details for IPOs that are currently accepting subscriptions. Return the results as JSON."
    );

    if (result.error) {
      throw new Error(`IPO scanner failed: ${result.error}`);
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = result.result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`IPO scanner returned non-JSON response:\n${result.result.slice(0, 500)}`);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as IPOScanResult;
      return parsed;
    } catch {
      throw new Error(`Failed to parse IPO scanner JSON:\n${jsonMatch[0].slice(0, 500)}`);
    }
  }


  /** Phase 2b: Run all research (macro + all per-IPO analysts) with concurrency limit */
  async runAllResearch(ipos: ScannedIPO[]): Promise<{ macro: AgentResult; ipoResults: IPOResearchBundle[] }> {
    // Build all tasks: 1 macro + 5 per IPO
    const macroResult: { value?: AgentResult } = {};
    const ipoResultsMap = new Map<string, Partial<IPOResearchBundle>>();

    for (const ipo of ipos) {
      ipoResultsMap.set(ipo.name, { ipo });
    }

    const tasks: (() => Promise<void>)[] = [];

    // Macro task
    tasks.push(async () => {
      console.log("  [macro-analyst] Starting...");
      const result = await this.runAgent(
        "macro-analyst",
        "Provide a comprehensive analysis of India's current macroeconomic situation, market prospects, and 5-10 year growth outlook. Focus on factors relevant to IPO investors with a long-term horizon.",
        "macro"
      );
      console.log(`  [macro-analyst] Done (${result.result.length} chars, ${result.duration_ms}ms)`);
      macroResult.value = result;
    });

    // Per-IPO tasks
    for (const ipo of ipos) {
      const ipoContext = `Company: ${ipo.name} (${ipo.company_full_name})
Price Band: ${ipo.price_band}
Lot Size: ${ipo.lot_size} shares
Dates: ${ipo.open_date} to ${ipo.close_date}
Exchange: ${ipo.exchange}
Issue Size: ${ipo.issue_size || "N/A"}
IPO Type: ${ipo.ipo_type || "N/A"}`;

      const bundle = ipoResultsMap.get(ipo.name)!;

      const analysts: { key: keyof IPOResearchBundle; agent: string; taskPrefix: string }[] = [
        { key: "growth", agent: "growth-analyst", taskPrefix: "Analyze growth prospects for this IPO:" },
        { key: "valuation", agent: "valuation-analyst", taskPrefix: "Analyze valuation for this IPO:" },
        { key: "risk", agent: "risk-analyst", taskPrefix: "Assess risks for this IPO:" },
        { key: "news", agent: "news-analyst", taskPrefix: "Research IPO details and recent news for:" },
        { key: "sentiment", agent: "sentiment-analyst", taskPrefix: "Analyze market sentiment and GMP for:" },
      ];

      for (const { key, agent, taskPrefix } of analysts) {
        tasks.push(async () => {
          console.log(`  [${ipo.name}/${agent}] Starting...`);
          const result = await this.runAgent(agent, `${taskPrefix}\n\n${ipoContext}`, ipo.name);
          console.log(`  [${ipo.name}/${agent}] Done (${result.result.length} chars, ${result.duration_ms}ms)`);
          (bundle as Record<string, unknown>)[key] = result;
        });
      }
    }

    // Run all tasks with concurrency limit
    await pooled(tasks, this.maxConcurrency);

    const ipoResults = ipos.map((ipo) => ipoResultsMap.get(ipo.name) as IPOResearchBundle);

    return { macro: macroResult.value!, ipoResults };
  }

  /** Phase 3: Assemble final report from all research */
  async assembleReport(
    macroAnalysis: AgentResult,
    ipoResearch: IPOResearchBundle[]
  ): Promise<string> {
    // Build context for the report assembler
    let context = `# MACRO ECONOMIC ANALYSIS\n\n${macroAnalysis.result}\n\n`;

    for (const bundle of ipoResearch) {
      context += `${"=".repeat(80)}\n`;
      context += `# IPO: ${bundle.ipo.name} (${bundle.ipo.company_full_name})\n`;
      context += `Price Band: ${bundle.ipo.price_band} | Lot Size: ${bundle.ipo.lot_size} | Dates: ${bundle.ipo.open_date} to ${bundle.ipo.close_date}\n`;
      context += `Exchange: ${bundle.ipo.exchange} | Issue Size: ${bundle.ipo.issue_size || "N/A"} | Type: ${bundle.ipo.ipo_type || "N/A"}\n\n`;

      if (bundle.growth.error) {
        context += `## GROWTH ANALYSIS\nError: ${bundle.growth.error}\n\n`;
      } else {
        context += `## GROWTH ANALYSIS\n${bundle.growth.result}\n\n`;
      }

      if (bundle.valuation.error) {
        context += `## VALUATION ANALYSIS\nError: ${bundle.valuation.error}\n\n`;
      } else {
        context += `## VALUATION ANALYSIS\n${bundle.valuation.result}\n\n`;
      }

      if (bundle.risk.error) {
        context += `## RISK ASSESSMENT\nError: ${bundle.risk.error}\n\n`;
      } else {
        context += `## RISK ASSESSMENT\n${bundle.risk.result}\n\n`;
      }

      if (bundle.news.error) {
        context += `## NEWS & UPDATES\nError: ${bundle.news.error}\n\n`;
      } else {
        context += `## NEWS & UPDATES\n${bundle.news.result}\n\n`;
      }

      if (bundle.sentiment.error) {
        context += `## MARKET SENTIMENT & GMP\nError: ${bundle.sentiment.error}\n\n`;
      } else {
        context += `## MARKET SENTIMENT & GMP\n${bundle.sentiment.result}\n\n`;
      }
    }

    const result = await this.runAgent(
      "report-assembler",
      `Synthesize the following research into a complete IPO Investment Analysis report:\n\n${context}`,
      "report"
    );

    if (result.error) {
      return `Report assembly failed: ${result.error}\n\nRaw research data:\n${context}`;
    }

    return result.result;
  }
}
