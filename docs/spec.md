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