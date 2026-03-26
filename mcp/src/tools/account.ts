import { z } from "zod";
import type { AzexClient } from "../client.js";
import type { AccountResponse, ToolDefinition } from "../types.js";

const schema = z.object({});

export function createAccountTools(client: AzexClient): ToolDefinition[] {
  return [
    {
      name: "get_account",
      description:
        "Check your current balance and rate limits. Call this before making expensive API calls to verify you have sufficient credits. Returns available balance (in USD), locked balance (reserved for in-flight requests), and current rate limits (requests per minute, tokens per minute).",
      toolset: "account",
      inputSchema: schema,
      async handler(_params) {
        const data = await client.get<AccountResponse>("/v1/account");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      },
    },
  ];
}
