// Authentication: read AZEX_API_KEY from env or --api-key CLI arg

export function resolveApiKey(argv: string[]): string {
  // Check --api-key flag first
  const flagIndex = argv.indexOf("--api-key");
  if (flagIndex !== -1 && argv[flagIndex + 1]) {
    return argv[flagIndex + 1];
  }

  // Check --api-key=value format
  const apiKeyArg = argv.find((arg) => arg.startsWith("--api-key="));
  if (apiKeyArg) {
    return apiKeyArg.slice("--api-key=".length);
  }

  // Fall back to env var
  const envKey = process.env.AZEX_API_KEY;
  if (envKey) {
    return envKey;
  }

  throw new Error(
    "AZEX_API_KEY is required. Set it via the AZEX_API_KEY environment variable or --api-key flag.\n" +
      "Get your API key at https://azex.ai/dashboard"
  );
}

export function resolveBaseUrl(argv: string[]): string {
  // Check --base-url flag
  const flagIndex = argv.indexOf("--base-url");
  if (flagIndex !== -1 && argv[flagIndex + 1]) {
    return argv[flagIndex + 1].replace(/\/$/, "");
  }

  const baseUrlArg = argv.find((arg) => arg.startsWith("--base-url="));
  if (baseUrlArg) {
    return baseUrlArg.slice("--base-url=".length).replace(/\/$/, "");
  }

  return process.env.AZEX_BASE_URL?.replace(/\/$/, "") ?? "https://api.azex.ai";
}

export function resolveToolsets(argv: string[]): string[] {
  const flagIndex = argv.indexOf("--toolsets");
  let toolsetsValue: string | undefined;

  if (flagIndex !== -1 && argv[flagIndex + 1]) {
    toolsetsValue = argv[flagIndex + 1];
  } else {
    const toolsetsArg = argv.find((arg) => arg.startsWith("--toolsets="));
    if (toolsetsArg) {
      toolsetsValue = toolsetsArg.slice("--toolsets=".length);
    }
  }

  if (!toolsetsValue || toolsetsValue === "all") {
    return ["account", "chat", "messages", "embeddings", "models", "billing", "usage", "keys", "deposit"];
  }

  return toolsetsValue.split(",").map((s) => s.trim()).filter(Boolean);
}
