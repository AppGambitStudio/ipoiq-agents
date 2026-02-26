# IPO Analysis Agent

An AI-powered IPO investment analysis system built with [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) and [OpenRouter](https://openrouter.ai/). It automatically researches currently open IPOs in India and generates comprehensive investment analysis reports.

**Note**: Running this with multiple IPOs will generate a lot of API calls and will incur API call costs. It is recommended to run this with a single IPO at a time.

## How It Works

### The Team Lead Pattern

This project demonstrates the **Team Lead + Specialist Agents** pattern using the Claude Agent SDK. Instead of hardcoding the orchestration in TypeScript, an AI agent (the team lead) coordinates the entire workflow dynamically.

```
                    ┌─────────────────┐
  User prompt ───►  │   Team Lead     │  AI agent that coordinates everything
                    │   (Claude)      │  Has access to Task tool only
                    └────────┬────────┘
                             │ dispatches via Task tool
             ┌───────────────┼───────────────────┐
             │               │                   │
             ▼               ▼                   ▼
        ┌─────────┐   ┌───────────┐   ┌──────────────────┐
        │   IPO   │   │   Macro   │   │   Per-IPO Team   │
        │ Scanner │   │  Analyst  │   │ (5 agents each)  │
        └─────────┘   └───────────┘   └──────────────────┘
                                        ├── growth-analyst
                                        ├── valuation-analyst
                                        ├── risk-analyst
                                        ├── news-analyst
                                        └── sentiment-analyst
             │               │                   │
             └───────────────┼───────────────────┘
                             ▼
                    ┌─────────────────┐
                    │    Report       │  Synthesizes all research
                    │   Assembler    │  into final markdown report
                    └─────────────────┘
                             │
                             ▼
                    Final Investment Report
```

### How the Coordination Works

1. **`index.ts`** calls `query()` with the team lead's system prompt and registers all 8 specialist agents via the SDK's `agents` option.

2. **The Team Lead** (an AI agent) receives the task and has access to the `Task` tool. It can spawn any registered agent by name. The team lead's system prompt contains the workflow instructions — which agents to call, in what order, and what context to provide each one.

3. **The SDK handles agent spawning.** When the team lead calls the `Task` tool with `{ agent: "growth-analyst", prompt: "Analyze..." }`, the SDK spawns a new Claude subprocess with that agent's system prompt and tool restrictions. The agent runs autonomously, then returns its result to the team lead.

4. **Parallel execution** is native. The team lead can dispatch multiple Task tool calls in a single turn, and the SDK runs them concurrently. This means all 5 per-IPO analysts run in parallel for each company.

5. **The team lead sees all results** and can make dynamic decisions — retry a failed agent, skip analysis if no IPOs are open, or adjust strategy based on intermediate results. This is the key advantage over hardcoded orchestration.

### The Agent Team

| Agent | Role | Tools | When |
|---|---|---|---|
| **team-lead** | Coordinates all agents, decides workflow | Task | Always runs |
| **ipo-scanner** | Finds open IPOs from Groww.in, returns JSON | WebSearch, WebFetch | Phase 1 |
| **macro-analyst** | India's economy, GDP, inflation, market outlook | WebSearch, WebFetch | Phase 2 |
| **growth-analyst** | Per-IPO: TAM, moats, business model, thesis | WebSearch, WebFetch | Phase 2 |
| **valuation-analyst** | Per-IPO: P/E, peer comparison, financial snapshot | WebSearch, WebFetch | Phase 2 |
| **risk-analyst** | Per-IPO: risk assessment with severity ratings | WebSearch, WebFetch | Phase 2 |
| **news-analyst** | Per-IPO: IPO details, financials, management | WebSearch, WebFetch | Phase 2 |
| **sentiment-analyst** | Per-IPO: GMP, subscriptions, brokerage ratings | WebSearch, WebFetch | Phase 2 |
| **report-assembler** | Synthesizes all research into final report | None | Phase 3 |

### What the SDK Does Under the Hood

The Claude Agent SDK works differently from typical SDKs:

1. It ships the **full Claude Code CLI** bundled inside the npm package (`cli.js`)
2. Each `query()` call spawns the CLI as a **Node.js child process**
3. The CLI subprocess handles the agent loop, tool execution, and API calls
4. Communication happens over **stdin/stdout** (JSON messages)

This means each agent is an independent subprocess with its own context. The team lead and each specialist agent are separate Claude instances coordinated through the Task tool.

## Sample Output

Each report includes:

- India's macroeconomic context and market outlook
- **Per-company analysis:**
  - Growth Prospects (5-15 Years)
  - Investment Philosophy Fit
  - Valuation Analysis with peer comparison
  - Risk Assessment with severity ratings
  - Recent News & IPO Details
  - Market Sentiment & GMP Analysis
  - Bottom Line recommendation
- Investment Summary with SUBSCRIBE / CAUTION / AVOID ratings

See [`docs/`](./docs/) for a reference report generated by the original N8N system. This system emulates the same functionality but with Claude Agent SDK.

## Prerequisites

- **Node.js** 18+
- **OpenRouter API key** ([get one here](https://openrouter.ai/keys))

## Setup

```bash
git clone https://github.com/AppGambitStudio/ipoiq-agents.git
cd ipoiq-agents
npm install
```

Create a `.env` file:

```bash
ANTHROPIC_BASE_URL=https://openrouter.ai/api
ANTHROPIC_AUTH_TOKEN=your_openrouter_api_key
ANTHROPIC_API_KEY=
```

## Usage

```bash
npm start -- "25-02-2026.md"
```

The report is saved to `ipo-analysis/25-02-2026.md`.

## Configuration

Edit `src/index.ts` to change:

| Setting | Default | Description |
|---|---|---|
| `MODEL` | `anthropic/claude-haiku-4.5` | Claude model via OpenRouter |
| `OUTPUT_DIR` | `./ipo-analysis` | Report output directory |

> **Note:** The Claude Agent SDK only works with Anthropic models (Haiku, Sonnet, Opus). Non-Claude models will fail because the SDK uses Claude-specific tool calling format.

## Project Structure

```
src/
  index.ts          Entry point — launches team lead, saves report to file
  teammates.ts      Agent definitions using SDK's AgentDefinition type
  prompts.ts        System prompts for team lead + 8 specialist agents
docs/
  spec.md           Architecture deep-dive, SDK internals, Mastra comparison
ipo-analysis/       Generated reports (gitignored)
```

### Key Files Explained

**`src/index.ts`** — Minimal entry point. Calls `query()` once with the team lead prompt and all agents registered. Streams progress to console and saves the final report to a file. ~80 lines.

**`src/teammates.ts`** — Defines all 8 specialist agents using the SDK's `AgentDefinition` type. Each agent has a `description` (tells the team lead when to use it), a `prompt` (system prompt), and `tools` (what the agent can do). ~60 lines.

**`src/prompts.ts`** — The core of the system. Contains the team lead's coordination instructions and each specialist's detailed research prompt with accuracy protocols, required data points, and output format specifications. ~400 lines.

## Cost

With `anthropic/claude-haiku-4.5` via OpenRouter, a typical run analyzing 2-3 IPOs costs **$2-5**.

## Limitations

- **Claude models only** — the Agent SDK's tool calling format is Claude-specific
- **Cannot run inside Claude Code CLI** — the SDK spawns a CLI subprocess which detects nesting
- **OpenRouter as proxy** — environment variables route API calls through OpenRouter instead of Anthropic directly

## Further Reading

- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
- [OpenRouter + Agent SDK Guide](https://openrouter.ai/docs/guides/community/anthropic-agent-sdk)
- [`docs/spec.md`](./docs/spec.md) — detailed architecture notes, SDK internals, and comparison with Mastra

## License

MIT
