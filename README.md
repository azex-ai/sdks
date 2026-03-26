# Azex SDKs

Official client libraries for the [Azex](https://azex.ai) API — a crypto-native LLM gateway with pay-as-you-go pricing via stablecoin deposits.

## Packages

| Package | Language | Install | Description |
|---------|----------|---------|-------------|
| [`typescript/`](./typescript) | TypeScript/Node.js | `npm install azex` | Full SDK with streaming, pagination, typed responses |
| [`python/`](./python) | Python 3.9+ | `pip install azex` | Sync + async clients, httpx, pydantic v2 |
| [`mcp/`](./mcp) | TypeScript | `npx @azex/mcp-server` | MCP server for AI agents (Claude Desktop, Claude Code) |
| [`cli/`](./cli) | Go | `brew install azex-ai/tap/azex` | Terminal client with streaming chat, logs tail, raw API |

## Quick Start

### TypeScript

```typescript
import Azex from 'azex';

const azex = new Azex({ apiKey: 'sk_live_...' });

// OpenAI-compatible
const completion = await azex.chat.completions.create({
  model: 'openai/gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});

// Anthropic-compatible
const message = await azex.messages.create({
  model: 'anthropic/claude-sonnet-4-6',
  messages: [{ role: 'user', content: 'Hello' }],
  max_tokens: 1024,
});

// Streaming
const stream = await azex.chat.completions.create({
  model: 'deepseek/deepseek-chat',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
```

### Python

```python
from azex import Azex

client = Azex(api_key="sk_live_...")

# OpenAI-compatible
response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)

# Streaming
with client.chat.completions.stream(
    model="deepseek/deepseek-chat",
    messages=[{"role": "user", "content": "Hello"}],
) as stream:
    for chunk in stream:
        print(chunk.choices[0].delta.content, end="")
```

### MCP Server

```bash
# Claude Code
claude mcp add azex -- npx @azex/mcp-server

# Claude Desktop (~/.claude/config.json)
{
  "mcpServers": {
    "azex": {
      "command": "npx",
      "args": ["@azex/mcp-server"],
      "env": { "AZEX_API_KEY": "sk_live_..." }
    }
  }
}
```

### CLI

```bash
azex auth login
azex chat -m anthropic/claude-sonnet-4-6 "What is Rust?"
azex balance
azex models list
azex logs tail
```

## API Compatibility

Azex is a drop-in replacement for OpenAI and Anthropic APIs. Existing code works with a base URL change:

```python
# OpenAI SDK
from openai import OpenAI
client = OpenAI(api_key="sk_live_...", base_url="https://api.azex.ai/v1")

# Anthropic SDK
from anthropic import Anthropic
client = Anthropic(api_key="sk_live_...", base_url="https://api.azex.ai/v1")
```

## Features

- **200+ models** from OpenAI, Anthropic, Google, DeepSeek, Meta, Mistral, and more
- **OpenAI + Anthropic API compatibility** — use existing SDKs or ours
- **Crypto payments** — deposit USDC/USDT on Ethereum, Base, Arbitrum, Unichain
- **No KYC, no subscriptions** — pay-as-you-go with stablecoins
- **Per-request billing** — 4-decimal precision, no minimum spend

## Links

- [Website](https://azex.ai)
- [API Docs](https://azex.ai/docs)
- [Dashboard](https://azex.ai/dashboard)

## License

MIT
