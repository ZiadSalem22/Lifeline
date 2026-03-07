import { BackendAdapterError, LifelineMcpError } from '../errors.js';

function createTextBlock(text) {
  return {
    type: 'text',
    text,
  };
}

function stringifyPayload(payload) {
  return JSON.stringify(payload, null, 2);
}

export function createToolSuccessResult(payload, summary = null) {
  return {
    content: [createTextBlock(summary || stringifyPayload(payload))],
    structuredContent: payload,
  };
}

function normalizeToolError(error) {
  if (error instanceof LifelineMcpError || error instanceof BackendAdapterError) {
    return {
      code: error.code,
      status: error.status,
      message: error.message,
      details: error.details || null,
    };
  }

  return {
    code: 'tool_execution_failed',
    status: 500,
    message: error?.message || 'Tool execution failed.',
    details: null,
  };
}

export function createToolErrorResult(error) {
  const normalizedError = normalizeToolError(error);

  return {
    isError: true,
    content: [createTextBlock(`${normalizedError.message} (${normalizedError.code})`)],
    structuredContent: {
      error: normalizedError,
    },
  };
}
