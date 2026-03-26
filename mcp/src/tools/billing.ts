import { z } from "zod";
import type { AzexClient } from "../client.js";
import type { BalanceResponse, TransactionsResponse, ToolDefinition } from "../types.js";

const getBalanceSchema = z.object({});

const listTransactionsSchema = z.object({
  page: z.number().int().positive().optional().describe("Page number (1-based). Defaults to 1."),
  size: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe("Number of results per page. Defaults to 20, max 100."),
});

export function createBillingTools(client: AzexClient): ToolDefinition[] {
  return [
    {
      name: "get_balance",
      description:
        "Get detailed balance breakdown: available, locked, and pending amounts in USD. Available balance is what you can spend. Locked balance is reserved for in-flight API requests. Use get_account for a combined view with rate limits.",
      toolset: "billing",
      inputSchema: getBalanceSchema,
      async handler(_params) {
        const data = await client.get<BalanceResponse>("/api/v1/billing/balance");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      },
    },
    {
      name: "list_transactions",
      description:
        "List your billing transaction history — deposits, LLM usage charges, and refunds. Use this to audit spending, verify a deposit was credited, or review recent charges. Supports pagination.",
      toolset: "billing",
      inputSchema: listTransactionsSchema,
      async handler(params) {
        const { page, size } = params;
        const data = await client.get<TransactionsResponse>("/api/v1/billing/transactions", {
          page: page as number | undefined,
          size: size as number | undefined,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      },
    },
  ];
}
