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

## IPO Investment Analysis — Team Lead Architecture

The primary use case is an automated IPO analysis pipeline that researches currently open IPOs in India and produces comprehensive investment reports.

### Architecture: Team Lead + Specialist Agents

The system uses the Claude Agent SDK's native `agents` + `Task` tool pattern. An AI **team lead** coordinates 8 specialist agents — no hardcoded orchestration in TypeScript.

```
User: "Analyze currently open IPOs"
         │
         ▼
┌─────────────────┐
│   Team Lead     │  Coordinates via Task tool
│   (AI agent)    │  Decides workflow dynamically
└──┬──────────────┘
   │
   ├──► ipo-scanner          → finds open IPOs (Phase 1)
   │
   ├──► macro-analyst        → economic context (Phase 2, parallel)
   │
   ├──► For each IPO:        (Phase 2, parallel)
   │    ├── growth-analyst
   │    ├── valuation-analyst
   │    ├── risk-analyst
   │    ├── news-analyst
   │    └── sentiment-analyst
   │
   └──► report-assembler     → final report (Phase 3)
```

### Team (9 agents total)

| # | Agent | Role | Tools |
|---|---|---|---|
| 0 | **team-lead** | Coordinates all agents, decides workflow, handles failures | Task |
| 1 | **ipo-scanner** | Finds open IPOs from Groww.in, returns JSON | WebSearch, WebFetch |
| 2 | **macro-analyst** | India's economy, GDP, inflation, RBI policy, sector trends | WebSearch, WebFetch |
| 3 | **growth-analyst** | Per-IPO: TAM, moats, business model, investment thesis | WebSearch, WebFetch |
| 4 | **valuation-analyst** | Per-IPO: P/E, peer comparison, financial snapshot | WebSearch, WebFetch |
| 5 | **risk-analyst** | Per-IPO: risks with severity ratings, red flags | WebSearch, WebFetch |
| 6 | **news-analyst** | Per-IPO: IPO details, financials, management, material events | WebSearch, WebFetch |
| 7 | **sentiment-analyst** | Per-IPO: GMP, subscription data, brokerage ratings | WebSearch, WebFetch |
| 8 | **report-assembler** | Synthesizes all research into structured report | None |

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
  prompts.ts        — All 9 system prompts (team lead + 8 specialists)
  teammates.ts      — Agent definitions (AgentDefinition from SDK)
  index.ts          — Entry point: launches team lead, saves report
ipo-analysis/       — Generated reports saved here
```

### Usage

```bash
npm start -- "IPO Investment Analysis - February 2026.md"
```

### Design Decisions

- **Team Lead pattern** — An AI agent coordinates the workflow via the SDK's `Task` tool, rather than hardcoded TypeScript orchestration. This allows dynamic decisions (retry on failure, skip if no data, adjust strategy).
- **SDK-native agents** — Uses `AgentDefinition` from the Claude Agent SDK, wired into `query()` via the `agents` option. The team lead sees all agents and dispatches via `Task`.
- **Parallel dispatch** — The team lead can dispatch multiple agents in parallel using the Task tool's built-in parallelism.
- **Minimal TypeScript** — The code only handles startup, argument parsing, and file output. All orchestration logic lives in the team lead's prompt.
- **Accuracy protocols** — Every research agent has an explicit accuracy protocol requiring source verification, no memory-based stats, and conflict reporting.