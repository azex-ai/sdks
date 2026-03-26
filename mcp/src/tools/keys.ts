import { z } from "zod";
import type { AzexClient } from "../client.js";
import type { ApiKey, CreateApiKeyResponse, ToolDefinition } from "../types.js";

const createApiKeySchema = z.object({
  name: z
    .string()
    .describe("A descriptive name for the key, e.g. 'Production Bot' or 'Dev Testing'."),
  rpm_limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Max requests per minute for this key. Leave unset for no limit."),
  tpm_limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Max tokens per minute for this key. Leave unset for no limit."),
  model_whitelist: z
    .array(z.string())
    .optional()
    .describe(
      "List of model IDs this key is allowed to use. Leave empty to allow all models."
    ),
});

const listApiKeysSchema = z.object({});

const revokeApiKeySchema = z.object({
  uid: z
    .string()
    .describe("The UID of the API key to revoke. Get this from list_api_keys."),
});

export function createKeyTools(client: AzexClient): ToolDefinition[] {
  return [
    {
      name: "create_api_key",
      description:
        "Create a new API key for programmatic access to Azex. Optionally set rate limits (requests per minute, tokens per minute) and a model whitelist to restrict which models the key can access. The full key is only shown once — save it immediately. Human approval is recommended before creating keys for automated systems.",
      toolset: "keys",
      inputSchema: createApiKeySchema,
      async handler(params) {
        const { name, rpm_limit, tpm_limit, model_whitelist } = params;
        const data = await client.post<CreateApiKeyResponse>("/api/v1/keys", {
          name,
          rpm_limit,
          tpm_limit,
          model_whitelist,
        });

        const result =
          `API key created successfully.\n\n` +
          `Name: ${data.name}\n` +
          `UID: ${data.uid}\n` +
          `Key prefix: ${data.key_prefix}\n` +
          `Created: ${data.created_at}\n\n` +
          `API Key (save this — it won't be shown again):\n${data.api_key}`;

        return {
          content: [{ type: "text" as const, text: result }],
        };
      },
    },
    {
      name: "list_api_keys",
      description:
        "List all API keys on your account. Shows key names, prefixes, rate limits, and status. Full key values are never returned — only the prefix for identification. Use revoke_api_key to disable a key.",
      toolset: "keys",
      inputSchema: listApiKeysSchema,
      async handler(_params) {
        const data = await client.get<ApiKey[]>("/api/v1/keys");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      },
    },
    {
      name: "revoke_api_key",
      description:
        "Permanently revoke an API key. The key will stop working immediately. This action cannot be undone. Use list_api_keys to find the UID of the key you want to revoke.",
      toolset: "keys",
      inputSchema: revokeApiKeySchema,
      async handler(params) {
        const { uid } = params;
        await client.delete<unknown>(`/api/v1/keys/${uid}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `API key ${uid} has been revoked and is no longer valid.`,
            },
          ],
        };
      },
    },
  ];
}
