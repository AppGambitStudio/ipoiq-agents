import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import {
  IPO_SCANNER_PROMPT,
  MACRO_ANALYST_PROMPT,
  GROWTH_ANALYST_PROMPT,
  VALUATION_ANALYST_PROMPT,
  RISK_ANALYST_PROMPT,
  NEWS_ANALYST_PROMPT,
  SENTIMENT_ANALYST_PROMPT,
  REPORT_ASSEMBLER_PROMPT,
} from "./prompts.js";

export const agents: Record<string, AgentDefinition> = {
  "ipo-scanner": {
    description: "Finds currently open mainboard IPOs in India from Groww.in. Returns structured JSON with IPO details.",
    prompt: IPO_SCANNER_PROMPT,
    tools: ["WebSearch", "WebFetch"],
  },
  "macro-analyst": {
    description: "Analyzes India's current macroeconomic conditions, market outlook, and 5-10 year growth prospects. Use for economic context.",
    prompt: MACRO_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
  },
  "growth-analyst": {
    description: "Analyzes growth prospects, business model, competitive moats, and investment thesis for a specific IPO company. Requires company name and IPO details in the task.",
    prompt: GROWTH_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
  },
  "valuation-analyst": {
    description: "Evaluates IPO valuation with P/E calculation, peer comparison table, and financial snapshot. Requires company name and price band in the task.",
    prompt: VALUATION_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
  },
  "risk-analyst": {
    description: "Assesses business, financial, competitive, and regulatory risks for a specific IPO company. Returns severity-rated risk list. Requires company name in the task.",
    prompt: RISK_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
  },
  "news-analyst": {
    description: "Researches IPO structure, anchor investors, recent financials, management details, and material news for a specific IPO. Requires company name in the task.",
    prompt: NEWS_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
  },
  "sentiment-analyst": {
    description: "Tracks GMP, subscription status, brokerage ratings, and retail sentiment for a specific IPO. Requires company name in the task.",
    prompt: SENTIMENT_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
  },
  "report-assembler": {
    description: "Synthesizes all research (macro + per-IPO analysis) into a single structured investment report. Pass ALL research results in the task prompt.",
    prompt: REPORT_ASSEMBLER_PROMPT,
    tools: [],
  },
};
