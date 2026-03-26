import { z } from "zod";
import type { AzexClient } from "../client.js";
import type { MessageResponse, ToolDefinition } from "../types.js";

const schema = z.object({
  model: z
    .string()
    .describe(
      "The model ID to use (e.g., 'anthropic/claude-3-5-sonnet'). Use list_models to see available models."
    ),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]).describe("The role of the message author."),
        content: z.string().describe("The content of the message."),
      })
    )
    .describe("Array of messages in the conversation."),
  max_tokens: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum number of tokens to generate. Required by the Anthropic API."),
  system: z
    .string()
    .optional()
    .describe("Optional system prompt to set the assistant's behavior and context."),
});

export function createMessageTools(client: AzexClient): ToolDefinition[] {
  return [
    {
      name: "create_message",
      description:
        "Send a message using the Anthropic-compatible Messages API format. Use this when you specifically want the Anthropic message format with system prompts and structured content blocks. For most cases, create_chat_completion with OpenAI format works for all providers. Use list_models to find available Claude models.",
      toolset: "messages",
      inputSchema: schema,
      async handler(params) {
        const { model, messages, max_tokens, system } = params;

        const data = await client.post<MessageResponse>("/v1/messages", {
          model,
          messages,
          max_tokens: max_tokens ?? 1024,
          system,
        });

        const textContent = data.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n");

        const summary =
          `Model: ${data.model}\n` +
          `Stop reason: ${data.stop_reason}\n` +
          `Tokens: ${data.usage.input_tokens} input + ${data.usage.output_tokens} output\n\n` +
          `--- Response ---\n${textContent}`;

        return {
          content: [{ type: "text" as const, text: summary }],
        };
      },
    },
  ];
}
