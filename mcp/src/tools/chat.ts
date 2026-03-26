import { z } from "zod";
import type { AzexClient } from "../client.js";
import { AzexApiError } from "../client.js";
import type { ChatCompletionResponse, ToolDefinition } from "../types.js";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]).describe("The role of the message author."),
  content: z.string().describe("The content of the message."),
});

const schema = z.object({
  model: z
    .string()
    .describe(
      "The model ID to use (e.g., 'openai/gpt-4o', 'anthropic/claude-3-5-sonnet'). Use list_models to see all available models."
    ),
  messages: z.array(messageSchema).describe("Array of messages in the conversation."),
  max_tokens: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum number of tokens to generate. Defaults to model maximum if not set."),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .describe("Sampling temperature between 0 and 2. Higher = more random. Defaults to 1."),
  stream: z
    .boolean()
    .optional()
    .describe(
      "If true, stream the response progressively. Useful for long responses. Defaults to false."
    ),
});

export function createChatTools(client: AzexClient): ToolDefinition[] {
  return [
    {
      name: "create_chat_completion",
      description:
        "Send a chat completion request using the OpenAI-compatible API. Use this to call any LLM available on Azex. Supports both single-turn and multi-turn conversations. Set stream=true to get progressive output for long responses. Check list_models to find available models and their pricing. Always check your balance with get_account before large requests.",
      toolset: "chat",
      inputSchema: schema,
      async handler(params) {
        const { model, messages, max_tokens, temperature, stream } = params;

        if (stream) {
          return handleStreamingChat(client, { model, messages, max_tokens, temperature });
        }

        const data = await client.post<ChatCompletionResponse>("/v1/chat/completions", {
          model,
          messages,
          max_tokens,
          temperature,
        });

        const choice = data.choices[0];
        const content = choice?.message?.content ?? "";
        const usage = data.usage;

        const summary =
          `Model: ${data.model}\n` +
          `Finish reason: ${choice?.finish_reason ?? "unknown"}\n` +
          `Tokens: ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion = ${usage.total_tokens} total\n\n` +
          `--- Response ---\n${content}`;

        return {
          content: [{ type: "text" as const, text: summary }],
        };
      },
    },
  ];
}

async function handleStreamingChat(
  client: AzexClient,
  request: {
    model: string;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    max_tokens?: number;
    temperature?: number;
  }
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const chunks: string[] = [];
  let promptTokens = 0;
  let completionTokens = 0;
  let model = request.model;
  let finishReason = "unknown";

  try {
    for await (const raw of client.postStream("/v1/chat/completions", { ...request, stream: true })) {
      try {
        const chunk = JSON.parse(raw) as {
          model?: string;
          choices?: Array<{
            delta?: { content?: string };
            finish_reason?: string | null;
          }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
          };
        };

        if (chunk.model) model = chunk.model;

        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) chunks.push(delta);

        const fr = chunk.choices?.[0]?.finish_reason;
        if (fr) finishReason = fr;

        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens ?? 0;
          completionTokens = chunk.usage.completion_tokens ?? 0;
        }
      } catch {
        // Skip malformed chunks
      }
    }

    const responseText = chunks.join("");
    const totalTokens = promptTokens + completionTokens;

    const summary =
      `Model: ${model}\n` +
      `Finish reason: ${finishReason}\n` +
      (totalTokens > 0
        ? `Tokens: ${promptTokens} prompt + ${completionTokens} completion = ${totalTokens} total\n`
        : "") +
      `\n--- Response ---\n${responseText}`;

    return { content: [{ type: "text" as const, text: summary }] };
  } catch (err) {
    const msg = err instanceof AzexApiError ? formatApiError(err) : String(err);
    return { content: [{ type: "text" as const, text: `Streaming error: ${msg}` }], isError: true };
  }
}

function formatApiError(err: AzexApiError): string {
  if (err.status === 402) {
    return `Insufficient balance: ${err.message}. Add credits at https://azex.ai/dashboard/deposit`;
  }
  if (err.status === 429) {
    return `Rate limit exceeded: ${err.message}. Please wait before retrying.`;
  }
  return err.message;
}
