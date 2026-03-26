import { z } from "zod";
import type { AzexClient } from "../client.js";
import type { EmbeddingResponse, ToolDefinition } from "../types.js";

const schema = z.object({
  model: z
    .string()
    .describe(
      "The embedding model ID (e.g., 'openai/text-embedding-3-small', 'openai/text-embedding-3-large'). Use list_models to see available embedding models."
    ),
  input: z
    .union([z.string(), z.array(z.string())])
    .describe(
      "Text or array of texts to generate embeddings for. Single string for one embedding, array for batch processing."
    ),
});

export function createEmbeddingTools(client: AzexClient): ToolDefinition[] {
  return [
    {
      name: "create_embedding",
      description:
        "Generate vector embeddings for text using an embedding model. Use this to create semantic representations of text for similarity search, clustering, or retrieval-augmented generation (RAG). Input can be a single string or an array of strings for batch processing. Use list_models with capability='embedding' to find available embedding models.",
      toolset: "embeddings",
      inputSchema: schema,
      async handler(params) {
        const { model, input } = params;

        const data = await client.post<EmbeddingResponse>("/v1/embeddings", { model, input });

        const inputCount = Array.isArray(input) ? input.length : 1;
        const dims = data.data[0]?.embedding.length ?? 0;

        const summary =
          `Model: ${data.model}\n` +
          `Embeddings generated: ${data.data.length} (from ${inputCount} input(s))\n` +
          `Dimensions: ${dims}\n` +
          `Tokens used: ${data.usage.total_tokens}\n\n` +
          `Embeddings (first values shown):\n` +
          data.data
            .map((item, i) => {
              const preview = item.embedding
                .slice(0, 8)
                .map((v) => v.toFixed(6))
                .join(", ");
              return `[${i}]: [${preview}, ... (${item.embedding.length} dims)]`;
            })
            .join("\n");

        return {
          content: [{ type: "text" as const, text: summary }],
        };
      },
    },
  ];
}
