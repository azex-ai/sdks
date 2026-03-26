import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveApiKey, resolveBaseUrl, resolveToolsets } from "./auth.js";
import { AzexMCPServer } from "./server.js";

export { AzexMCPServer } from "./server.js";
export { AzexClient, AzexApiError } from "./client.js";
export type { AzexConfig, ToolDefinition, ToolResult } from "./types.js";

// Run as CLI entry point
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  let apiKey: string;
  try {
    apiKey = resolveApiKey(argv);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const baseUrl = resolveBaseUrl(argv);
  const toolsets = resolveToolsets(argv);

  const azexServer = new AzexMCPServer({ apiKey, baseUrl, toolsets });
  const transport = new StdioServerTransport();

  const enabledTools = azexServer.getEnabledTools();
  process.stderr.write(
    `Azex MCP Server started\n` +
      `Base URL: ${baseUrl}\n` +
      `Toolsets: ${toolsets.join(", ")}\n` +
      `Tools enabled (${enabledTools.length}): ${enabledTools.join(", ")}\n`
  );

  await azexServer.getMcpServer().connect(transport);
}
