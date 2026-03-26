import { z } from "zod";
import type { AzexClient } from "../client.js";
import type { ModelsResponse, ToolDefinition } from "../types.js";

const schema = z.object({
  capability: z
    .string()
    .optional()
    .describe(
      "Filter by capability. Examples: 'chat', 'embedding', 'vision', 'code'. Leave empty to list all models."
    ),
});

export function createModelTools(client: AzexClient): ToolDefinition[] {
  return [
    {
      name: "list_models",
      description:
        "List all available AI models with pricing information. Use this to find the cheapest model for your task, check if a specific model is available, or compare capabilities. Pricing is shown per million tokens (prompt and completion separately). Filter by capability to find models that support specific features.",
      toolset: "models",
      inputSchema: schema,
      async handler(params) {
        const { capability } = params;
        const data = await client.get<ModelsResponse>(
          "/v1/models",
          capability ? { capability: capability as string } : undefined
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      },
    },
  ];
}
