## Claude Agent SDK

I have been building AI Agents using Mastra TypeScript SDK. I am now looking to build a simple agent using Claude Agent SDK via OpenRouter API.

We can start with a simple basic usecase to see how we can build a simple agent.

## Use Case

- I want to build a simple agent that can answer questions about the stock market.

## Technical Details

- Claude Agent SDK TypeScript
- OpenRouter API
- Node.js
- TypeScript

## Documentation

- Claude Agent SDK: https://platform.claude.com/docs/en/agent-sdk/overview
- OpenRouter API: https://openrouter.ai/docs/guides/community/anthropic-agent-sdk

## Claude Agent SDK — How it works

The SDK **does NOT make API calls directly**. It:

1. Ships a bundled `cli.js` (the full Claude Code CLI) inside the npm package
2. Spawns it as a **Node.js child process** (`node cli.js`)
3. Communicates with it over stdin/stdout (JSON messages)
4. The CLI subprocess handles the agent loop, tool execution, API calls, etc.

### Docker implications

It will work in Docker, but it's heavier than a typical SDK. The CLI is bundled in `node_modules`, so no separate install is needed. But you're running **two Node.js processes** — your app + the spawned CLI.

### OpenRouter limitations

OpenRouter can proxy requests to Anthropic models, but the Agent SDK only works with **Claude models**. Non-Anthropic models (e.g. `moonshotai/kimi-k2.5`) fail because they don't support the Claude-specific tool calling format the SDK expects.

## Claude Agent SDK vs Mastra

| | Claude Agent SDK | Mastra |
|---|---|---|
| **Architecture** | Spawns CLI as subprocess | Pure SDK, direct API calls |
| **Processes** | 2 (your app + CLI child) | 1 (your app) |
| **Docker footprint** | Heavier (full CLI bundled) | Lighter |
| **Model support** | Claude only | Any LLM provider |
| **Tools** | Built-in (Bash, Read, Edit, WebSearch...) | You build/integrate your own |
| **Agent loop** | Handled by CLI (opaque) | You control it |
| **Customization** | Limited to SDK options | Full control |
| **Best for** | Code-centric agents, CI/CD | Custom agents, multi-model |

**TL;DR**: Claude Agent SDK gives you Claude Code's power as a black box subprocess. Mastra gives you full control but you wire everything yourself. For production Docker workloads where you want transparency and lighter containers, Mastra-style SDKs are more conventional. The Agent SDK is more of a "deploy Claude Code as a service" approach.

## IPO Investment Analysis — Teammate Architecture

The primary use case is an automated IPO analysis pipeline that researches currently open IPOs in India and produces a structured investment report.

### Pipeline Flow

```
Phase 1: ipo-scanner finds open IPOs → returns JSON
Phase 2: In parallel:
         ├── macro-analyst (1 call)
         ├── IPO-1: growth + valuation + risk + news + sentiment (5 calls)
         ├── IPO-2: growth + valuation + risk + news + sentiment (5 calls)
         └── IPO-N: ...
Phase 3: report-assembler synthesizes everything → markdown report
```

For N open IPOs: **3 + 5N agent calls** total (1 scan + 1 macro + 5×N per-IPO + 1 assembler).

### Teammates (8 agents)

| # | Teammate | Focus | Per-IPO? | Tools |
|---|---|---|---|---|
| 1 | **ipo-scanner** | Find currently open IPOs, extract names, price bands, dates, lot sizes, exchange | No, runs first | WebSearch, WebFetch |
| 2 | **macro-analyst** | India's economy, GDP, inflation, RBI policy, sector trends, 5-10yr outlook | No, runs once | WebSearch, WebFetch |
| 3 | **growth-analyst** | TAM, market positioning, revenue trajectory, competitive moats, business model | Yes | WebSearch, WebFetch |
| 4 | **valuation-analyst** | P/E ratios, peer comparison, fair value rationale, premium/discount justification | Yes | WebSearch, WebFetch |
| 5 | **risk-analyst** | Client concentration, asset quality, regulatory, competitive, execution risks | Yes | WebSearch, WebFetch |
| 6 | **news-analyst** | IPO details (issue size, anchor investors, OFS), recent financials, management, use of proceeds | Yes | WebSearch, WebFetch |
| 7 | **sentiment-analyst** | GMP tracking, brokerage ratings, Reddit/social sentiment, listing expectations | Yes | WebSearch, WebFetch |
| 8 | **report-assembler** | Synthesizes all research into final structured report with recommendations | No, runs last | None (pure synthesis) |

### Per-Company Report Sections

Each IPO in the final report includes:
- 📈 **Growth Prospects (5-15 Years)** — from growth-analyst
- 💡 **Why This Fits Long-Term Investment Philosophy** — from growth-analyst
- 📊 **Valuation Analysis** — from valuation-analyst
- ⚠️ **Things to Keep in Mind** — from risk-analyst
- 📰 **Recent News & Updates** — from news-analyst
- 📊 **Market Sentiment & GMP Analysis** — from sentiment-analyst
- 💭 **Bottom Line** — synthesized recommendation (SUBSCRIBE / SUBSCRIBE WITH CAUTION / AVOID)

### Project Structure

```
src/
  types.ts          — Data contracts (ScannedIPO, AgentResult, IPOResearchBundle)
  prompts.ts        — All 8 system prompts (detailed, section-specific)
  teammates.ts      — 8 teammate configs wiring prompts to tools
  coordinator.ts    — Orchestration: scanIPOs → analyzeIPO → assembleReport
  index.ts          — Pipeline driver: Phase 1 → 2 → 3, saves report to file
ipo-analysis/       — Generated reports saved here
```

### Usage

```bash
npm start -- "IPO Investment Analysis - February 2026.md"
```

### Design Decisions

- **`query()` over `unstable_v2_createSession()`** — All tasks are one-shot (not multi-turn), so `query()` is simpler and gives direct `systemPrompt` support without session lifecycle overhead.
- **Parallel execution** — Macro analysis runs in parallel with all per-IPO research. Within each IPO, all 5 analysts run concurrently via `Promise.all`.
- **Error resilience** — Each agent call catches errors independently. If one analyst fails, the rest continue and the report-assembler works with available data.
- **JSON output for scanner** — ipo-scanner returns structured JSON so the coordinator can parse IPO names and dispatch per-IPO tasks programmatically.