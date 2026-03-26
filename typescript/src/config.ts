export interface AzexConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

export function resolveConfig(opts: {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}): AzexConfig {
  const apiKey =
    opts.apiKey ??
    (typeof process !== "undefined" ? process.env["AZEX_API_KEY"] : undefined);
  if (!apiKey) {
    throw new Error(
      "apiKey is required. Pass it explicitly or set the AZEX_API_KEY environment variable.",
    );
  }
  const baseUrl = (
    opts.baseUrl ??
    (typeof process !== "undefined"
      ? process.env["AZEX_BASE_URL"]
      : undefined) ??
    "https://api.azex.ai"
  ).replace(/\/$/, "");

  return {
    apiKey,
    baseUrl,
    timeout: opts.timeout ?? 60_000,
    maxRetries: opts.maxRetries ?? 2,
  };
}
