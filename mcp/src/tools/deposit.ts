import { z } from "zod";
import type { AzexClient } from "../client.js";
import type { DepositInfo, ToolDefinition } from "../types.js";

const getDepositInfoSchema = z.object({});
const refreshDepositSchema = z.object({});

export function createDepositTools(client: AzexClient): ToolDefinition[] {
  return [
    {
      name: "get_deposit_info",
      description:
        "Get your deposit address and supported chains/tokens for funding your Azex account. Your deposit address is deterministic (CREATE2) and permanent — the same address works across all supported chains (Ethereum, Base, Arbitrum, Unichain). Supported tokens: USDC and USDT. Also shows recent deposit history.",
      toolset: "deposit",
      inputSchema: getDepositInfoSchema,
      async handler(_params) {
        const data = await client.get<DepositInfo>("/api/v1/deposit");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      },
    },
    {
      name: "refresh_deposit",
      description:
        "Trigger a manual scan of your deposit address to detect any pending on-chain deposits. Use this if you've sent funds but they haven't appeared in your balance yet. Rate limited to once every 30 seconds. After calling this, wait a moment then check your balance with get_account.",
      toolset: "deposit",
      inputSchema: refreshDepositSchema,
      async handler(_params) {
        await client.post<unknown>("/api/v1/deposit/refresh");
        return {
          content: [
            {
              type: "text" as const,
              text: "Deposit scan triggered. Your address is being checked for new on-chain transactions. Check your balance in a few seconds with get_account.",
            },
          ],
        };
      },
    },
  ];
}
