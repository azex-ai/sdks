import { z } from "zod";
import type { AzexClient } from "../client.js";
import type { UsageLogsResponse, UsageStats, ToolDefinition } from "../types.js";

const getUsageStatsSchema = z.object({
  from: z
    .string()
    .describe("Start date in ISO 8601 format (YYYY-MM-DD). Example: '2024-01-01'"),
  to: z
    .string()
    .describe("End date in ISO 8601 format (YYYY-MM-DD). Example: '2024-01-31'"),
});

const listUsageLogsSchema = z.object({
  from: z
    .string()
    .optional()
    .describe("Filter logs from this date (ISO 8601: YYYY-MM-DD). Optional."),
  to: z
    .string()
    .optional()
    .describe("Filter logs up to this date (ISO 8601: YYYY-MM-DD). Optional."),
  page: z.number().int().positive().optional().describe("Page number (1-based). Defaults to 1."),
  size: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe("Number of results per page. Defaults to 20, max 100."),
});

export function createUsageTools(client: AzexClient): ToolDefinition[] {
  return [
    {
      name: "get_usage_stats",
      description:
        "Get aggregated usage statistics for a date range: total requests, tokens consumed, and cost breakdown by model. Use this to understand your spending patterns, find the most-used models, or estimate costs. Dates are in ISO 8601 format (YYYY-MM-DD).",
      toolset: "usage",
      inputSchema: getUsageStatsSchema,
      async handler(params) {
        const { from, to } = params;
        const data = await client.get<UsageStats>("/api/v1/usage", {
          from: from as string,
          to: to as string,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      },
    },
    {
      name: "list_usage_logs",
      description:
        "List individual API request logs with token counts and costs. Use this to audit specific requests, debug unexpected charges, or see which models were used and when. Supports filtering by date range and pagination for large result sets.",
      toolset: "usage",
      inputSchema: listUsageLogsSchema,
      async handler(params) {
        const { from, to, page, size } = params;
        const data = await client.get<UsageLogsResponse>("/api/v1/usage/logs", {
          from: from as string | undefined,
          to: to as string | undefined,
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
