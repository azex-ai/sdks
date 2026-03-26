import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AzexApiError, AzexClient } from "./client.js";
import { createTools } from "./tools/index.js";
import type { AzexConfig } from "./types.js";

export class AzexMCPServer {
  private server: McpServer;
  private client: AzexClient;
  private toolNames: string[];

  constructor(config: AzexConfig) {
    this.client = new AzexClient(config.apiKey, config.baseUrl);

    this.server = new McpServer({
      name: "azex",
      version: "0.1.0",
    });

    const tools = createTools(this.client, config.toolsets);
    this.toolNames = tools.map((t) => t.name);
    this.registerTools(tools);
  }

  private registerTools(tools: Array<{ name: string; description: string; inputSchema: import("zod").ZodTypeAny; handler: (params: unknown) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> }>): void {
    for (const tool of tools) {
      this.server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (params: any) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await tool.handler(params);
            return {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content: result.content.map((c: any) => ({ type: "text" as const, text: c.text })),
              isError: result.isError,
            };
          } catch (err) {
            const message = formatError(err);
            return {
              content: [{ type: "text" as const, text: message }],
              isError: true,
            };
          }
        }
      );
    }
  }

  getMcpServer(): McpServer {
    return this.server;
  }

  getEnabledTools(): string[] {
    return this.toolNames;
  }
}

function formatError(err: unknown): string {
  if (err instanceof AzexApiError) {
    if (err.status === 401) {
      return `Authentication failed: Invalid API key. Check your AZEX_API_KEY environment variable.`;
    }
    if (err.status === 402) {
      return `Insufficient balance: ${err.message}. Add credits at https://azex.ai/dashboard/deposit`;
    }
    if (err.status === 403) {
      return `Permission denied: ${err.message}. Your API key may not have access to this resource.`;
    }
    if (err.status === 404) {
      return `Not found: ${err.message}`;
    }
    if (err.status === 429) {
      return `Rate limit exceeded: ${err.message}. Please wait before retrying.`;
    }
    if (err.status >= 500) {
      return `Azex server error (${err.status}): ${err.message}. Try again in a moment.`;
    }
    return `API error (${err.status}): ${err.message}`;
  }

  if (err instanceof Error) {
    return `Error: ${err.message}`;
  }

  return `Unexpected error: ${String(err)}`;
}
