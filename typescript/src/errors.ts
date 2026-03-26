export class AzexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AzexError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class APIConnectionError extends AzexError {
  readonly cause?: Error;

  constructor(message = "Connection error", opts?: { cause?: Error }) {
    super(message);
    this.name = "APIConnectionError";
    this.cause = opts?.cause;
  }
}

export class APITimeoutError extends APIConnectionError {
  constructor(opts?: { cause?: Error }) {
    super("Request timed out", opts);
    this.name = "APITimeoutError";
  }
}

export class APIError extends AzexError {
  readonly statusCode: number;
  readonly body: unknown;
  readonly headers: Record<string, string>;

  constructor(
    message: string,
    opts: {
      statusCode: number;
      body?: unknown;
      headers?: Record<string, string>;
    },
  ) {
    super(message);
    this.name = "APIError";
    this.statusCode = opts.statusCode;
    this.body = opts.body;
    this.headers = opts.headers ?? {};
  }

  static fromResponse(
    statusCode: number,
    body: unknown,
    headers: Record<string, string>,
  ): APIError {
    const message = extractMessage(body, statusCode);
    const Cls = statusToClass(statusCode);
    return new Cls(message, { statusCode, body, headers });
  }
}

export class AuthenticationError extends APIError {
  constructor(
    message: string,
    opts: { statusCode: number; body?: unknown; headers?: Record<string, string> },
  ) {
    super(message, opts);
    this.name = "AuthenticationError";
  }
}

export class PermissionDeniedError extends APIError {
  constructor(
    message: string,
    opts: { statusCode: number; body?: unknown; headers?: Record<string, string> },
  ) {
    super(message, opts);
    this.name = "PermissionDeniedError";
  }
}

export class NotFoundError extends APIError {
  constructor(
    message: string,
    opts: { statusCode: number; body?: unknown; headers?: Record<string, string> },
  ) {
    super(message, opts);
    this.name = "NotFoundError";
  }
}

export class InsufficientBalanceError extends APIError {
  constructor(
    message: string,
    opts: { statusCode: number; body?: unknown; headers?: Record<string, string> },
  ) {
    super(message, opts);
    this.name = "InsufficientBalanceError";
  }
}

export class RateLimitError extends APIError {
  constructor(
    message: string,
    opts: { statusCode: number; body?: unknown; headers?: Record<string, string> },
  ) {
    super(message, opts);
    this.name = "RateLimitError";
  }
}

export class InternalServerError extends APIError {
  constructor(
    message: string,
    opts: { statusCode: number; body?: unknown; headers?: Record<string, string> },
  ) {
    super(message, opts);
    this.name = "InternalServerError";
  }
}

function statusToClass(
  statusCode: number,
): new (
  message: string,
  opts: { statusCode: number; body?: unknown; headers?: Record<string, string> },
) => APIError {
  switch (statusCode) {
    case 401:
      return AuthenticationError;
    case 403:
      return PermissionDeniedError;
    case 404:
      return NotFoundError;
    case 402:
      return InsufficientBalanceError;
    case 429:
      return RateLimitError;
    default:
      return statusCode >= 500 ? InternalServerError : APIError;
  }
}

function extractMessage(body: unknown, statusCode: number): string {
  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    for (const key of ["error", "message", "detail"]) {
      const val = b[key];
      if (typeof val === "string") return val;
      if (typeof val === "object" && val !== null) {
        const nested = val as Record<string, unknown>;
        const msg = nested["message"] ?? nested["detail"];
        if (typeof msg === "string") return msg;
      }
    }
  }
  return `HTTP ${statusCode}`;
}
