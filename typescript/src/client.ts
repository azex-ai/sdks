import { resolveConfig, type AzexConfig } from "./config.js";
import {
  APIConnectionError,
  APIError,
  APITimeoutError,
} from "./errors.js";
import { Stream, makeChunkParser } from "./streaming.js";
import { Page, type PageData } from "./pagination.js";

// Resources
import { ChatResource } from "./resources/chat.js";
import { MessagesResource } from "./resources/messages.js";
import { CompletionsResource } from "./resources/completions.js";
import { EmbeddingsResource } from "./resources/embeddings.js";
import { ModelsResource } from "./resources/models.js";
import { KeysResource } from "./resources/keys.js";
import { BillingResource } from "./resources/billing.js";
import { UsageResource } from "./resources/usage.js";
import { DepositResource } from "./resources/deposit.js";
import { CheckoutResource } from "./resources/checkout.js";

const RETRY_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export interface RequestOptions {
  method: string;
  path: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  stream?: boolean;
}

export interface RawResponse<T> {
  data: T;
  headers: Headers;
  requestCost: string | null;
  tokensUsed: string | null;
  modelUsed: string | null;
}

export class Azex {
  readonly chat: ChatResource;
  readonly messages: MessagesResource;
  readonly completions: CompletionsResource;
  readonly embeddings: EmbeddingsResource;
  readonly models: ModelsResource;
  readonly keys: KeysResource;
  readonly billing: BillingResource;
  readonly usage: UsageResource;
  readonly deposit: DepositResource;
  readonly checkout: CheckoutResource;

  private _config: AzexConfig;

  constructor(opts: {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
    maxRetries?: number;
  } = {}) {
    this._config = resolveConfig(opts);

    this.chat = new ChatResource(this);
    this.messages = new MessagesResource(this);
    this.completions = new CompletionsResource(this);
    this.embeddings = new EmbeddingsResource(this);
    this.models = new ModelsResource(this);
    this.keys = new KeysResource(this);
    this.billing = new BillingResource(this);
    this.usage = new UsageResource(this);
    this.deposit = new DepositResource(this);
    this.checkout = new CheckoutResource(this);
  }

  get baseUrl(): string {
    return this._config.baseUrl;
  }

  // ------------------------------------------------------------------
  // Core request method
  // ------------------------------------------------------------------

  async fetch<T>(opts: RequestOptions): Promise<T> {
    const { method, path, body, params, stream } = opts;
    const url = this._buildUrl(path, params);
    const headers = this._buildHeaders(stream);

    let attempts = 0;
    let lastError: Error | undefined;

    while (attempts <= this._config.maxRetries) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          this._config.timeout,
        );

        let response: Response;
        try {
          response = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        if (
          RETRY_STATUS_CODES.has(response.status) &&
          attempts < this._config.maxRetries &&
          !stream
        ) {
          const errBody = await safeJson(response);
          lastError = APIError.fromResponse(
            response.status,
            errBody,
            headersToRecord(response.headers),
          );
          attempts++;
          await jitterSleep(attempts - 1);
          continue;
        }

        if (!response.ok) {
          const errBody = await safeJson(response);
          throw APIError.fromResponse(
            response.status,
            errBody,
            headersToRecord(response.headers),
          );
        }

        if (stream) {
          return new Stream<T>(response, makeChunkParser<T>()) as unknown as T;
        }

        // 204 No Content or empty body — return undefined cast to T
        if (
          response.status === 204 ||
          response.headers.get("content-length") === "0"
        ) {
          return undefined as unknown as T;
        }

        return (await response.json()) as T;
      } catch (err) {
        if (err instanceof APIError) throw err;

        const e = err as Error;
        if (e.name === "AbortError") {
          lastError = new APITimeoutError();
          if (attempts < this._config.maxRetries) {
            attempts++;
            await jitterSleep(attempts - 1);
            continue;
          }
          throw lastError;
        }
        throw new APIConnectionError(e.message, { cause: e });
      }
    }

    if (lastError) throw lastError;
    throw new APIConnectionError("Max retries exceeded");
  }

  async fetchWithResponse<T>(opts: RequestOptions): Promise<RawResponse<T>> {
    const { method, path, body, params } = opts;
    const url = this._buildUrl(path, params);
    const headers = this._buildHeaders(false);

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errBody = await safeJson(response);
      throw APIError.fromResponse(
        response.status,
        errBody,
        headersToRecord(response.headers),
      );
    }

    const data = (await response.json()) as T;
    return {
      data,
      headers: response.headers,
      requestCost: response.headers.get("x-request-cost"),
      tokensUsed: response.headers.get("x-tokens-used"),
      modelUsed: response.headers.get("x-model-used"),
    };
  }

  async fetchPage<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<Page<T>> {
    const data = await this.fetch<PageData<T>>({ method: "GET", path, params });
    return new Page<T>(data, (page, size) =>
      this.fetchPage<T>(path, { ...params, page, size }),
    );
  }

  private _buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): string {
    const url = new URL(this._config.baseUrl + path);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private _buildHeaders(stream?: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this._config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "azex-typescript/0.1.0",
    };
    if (stream) {
      headers["Accept"] = "text/event-stream";
    }
    return headers;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

async function jitterSleep(attempt: number): Promise<void> {
  const base = Math.pow(2, attempt) * 1000;
  const jitter = Math.random() * base * 0.25;
  await new Promise((resolve) => setTimeout(resolve, base + jitter));
}
