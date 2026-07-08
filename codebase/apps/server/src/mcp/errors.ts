import { AppError, DomainValidationError } from '../domain/errors.js';

/**
 * MCP-layer error types, ported from the old `services/lifeline-mcp/src/errors.js`.
 * Tool handlers convert these (and domain {@link AppError}s) into MCP error
 * RESULTS (`isError: true`), never JSON-RPC protocol errors; the HTTP layer
 * converts auth/rate-limit failures into JSON-RPC error envelopes.
 */

export interface McpErrorOptions {
  status?: number | undefined;
  code?: string | undefined;
  details?: unknown;
  headers?: Record<string, string> | undefined;
}

export class McpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly headers: Record<string, string> | null;

  constructor(message: string, options: McpErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.status = options.status ?? 500;
    this.code = options.code ?? 'lifeline_mcp_error';
    this.details = options.details ?? null;
    this.headers = options.headers ?? null;
  }
}

/** 401 `auth_error` by default (old AuthError). */
export class McpAuthError extends McpError {
  constructor(message: string, options: McpErrorOptions = {}) {
    super(message, { status: 401, code: 'auth_error', ...options });
  }
}

/** 403 `scope_denied` (old ScopeError). */
export class McpScopeError extends McpError {
  constructor(message: string, options: McpErrorOptions = {}) {
    super(message, { status: 403, code: 'scope_denied', ...options });
  }
}

/** 400 `invalid_input` (old ToolInputError). */
export class McpToolInputError extends McpError {
  constructor(message: string, options: McpErrorOptions = {}) {
    super(message, { status: 400, code: 'invalid_input', ...options });
  }
}

export interface NormalizedToolError {
  code: string;
  status: number;
  message: string;
  details: unknown;
}

/** Old app.js HTTP status → JSON-RPC error code mapping. */
export function toJsonRpcErrorCode(status: number): number {
  if (status === 400) return -32602;
  if (status === 401) return -32001;
  if (status === 403) return -32003;
  if (status === 404) return -32004;
  return -32603;
}

/**
 * Map a thrown error onto the old MCP tool-error shape. MCP-layer errors keep
 * their code verbatim; typed domain errors map by status (400 invalid_input,
 * 401 unauthorized, 403 forbidden, 404 not_found, 409 conflict, 500 internal);
 * anything else is the old `tool_execution_failed` 500.
 */
export function normalizeToolError(error: unknown): NormalizedToolError {
  if (error instanceof McpError) {
    return {
      code: error.code,
      status: error.status,
      message: error.message,
      details: error.details ?? null,
    };
  }

  if (error instanceof AppError) {
    const codeByStatus: Record<number, string> = {
      400: 'invalid_input',
      401: 'unauthorized',
      403: 'forbidden',
      404: 'not_found',
      409: 'conflict',
      500: 'internal',
    };
    return {
      code: codeByStatus[error.status] ?? 'internal',
      status: error.status,
      message: error.message,
      details: error instanceof DomainValidationError ? (error.fieldErrors ?? null) : null,
    };
  }

  return {
    code: 'tool_execution_failed',
    status: 500,
    message: error instanceof Error ? error.message : 'Tool execution failed.',
    details: null,
  };
}
