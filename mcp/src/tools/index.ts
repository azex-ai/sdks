import type { AzexClient } from "../client.js";
import type { ToolDefinition } from "../types.js";
import { createAccountTools } from "./account.js";
import { createBillingTools } from "./billing.js";
import { createChatTools } from "./chat.js";
import { createDepositTools } from "./deposit.js";
import { createEmbeddingTools } from "./embeddings.js";
import { createKeyTools } from "./keys.js";
import { createMessageTools } from "./messages.js";
import { createModelTools } from "./models.js";
import { createUsageTools } from "./usage.js";

export const ALL_TOOLSETS = [
  "account",
  "chat",
  "messages",
  "embeddings",
  "models",
  "billing",
  "usage",
  "keys",
  "deposit",
] as const;

export type Toolset = (typeof ALL_TOOLSETS)[number];

export function createTools(client: AzexClient, enabledToolsets: string[]): ToolDefinition[] {
  const toolsets = new Set(enabledToolsets);
  const all = enabledToolsets.includes("all");

  const allTools: ToolDefinition[] = [
    ...createAccountTools(client),
    ...createBillingTools(client),
    ...createChatTools(client),
    ...createMessageTools(client),
    ...createEmbeddingTools(client),
    ...createModelTools(client),
    ...createUsageTools(client),
    ...createKeyTools(client),
    ...createDepositTools(client),
  ];

  if (all) return allTools;

  return allTools.filter((tool) => toolsets.has(tool.toolset));
}
