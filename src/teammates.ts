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

export type TeammateConfig = {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  maxTurns?: number;
};

export const teammates: TeammateConfig[] = [
  {
    name: "ipo-scanner",
    description: "Finds currently open IPOs in India with structured details",
    systemPrompt: IPO_SCANNER_PROMPT,
    tools: ["WebSearch", "WebFetch"],
    maxTurns: 10,
  },
  {
    name: "macro-analyst",
    description: "Analyzes India's macroeconomic conditions and market outlook",
    systemPrompt: MACRO_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
    maxTurns: 10,
  },
  {
    name: "growth-analyst",
    description: "Analyzes growth prospects, business model, and competitive moats for an IPO company",
    systemPrompt: GROWTH_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
    maxTurns: 10,
  },
  {
    name: "valuation-analyst",
    description: "Evaluates IPO valuation, peer comparison, and pricing fairness",
    systemPrompt: VALUATION_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
    maxTurns: 10,
  },
  {
    name: "risk-analyst",
    description: "Assesses business, financial, competitive, and regulatory risks for an IPO company",
    systemPrompt: RISK_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
    maxTurns: 10,
  },
  {
    name: "news-analyst",
    description: "Researches IPO details, recent news, management, and financial performance",
    systemPrompt: NEWS_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
    maxTurns: 10,
  },
  {
    name: "sentiment-analyst",
    description: "Analyzes GMP, subscription data, brokerage ratings, and social sentiment",
    systemPrompt: SENTIMENT_ANALYST_PROMPT,
    tools: ["WebSearch", "WebFetch"],
    maxTurns: 10,
  },
  {
    name: "report-assembler",
    description: "Synthesizes all research into a structured investment analysis report",
    systemPrompt: REPORT_ASSEMBLER_PROMPT,
    tools: [],
    maxTurns: 3,
  },
];
