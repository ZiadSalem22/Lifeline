export class LifelineMcpError extends Error {
  constructor(message, { status = 500, code = 'lifeline_mcp_error', details = null, cause = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.cause = cause;
  }
}

export class AuthError extends LifelineMcpError {
  constructor(message, options = {}) {
    super(message, { status: 401, code: 'auth_error', ...options });
  }
}

export class ScopeError extends LifelineMcpError {
  constructor(message, options = {}) {
    super(message, { status: 403, code: 'scope_denied', ...options });
  }
}

export class ToolInputError extends LifelineMcpError {
  constructor(message, options = {}) {
    super(message, { status: 400, code: 'invalid_input', ...options });
  }
}

export class BackendAdapterError extends LifelineMcpError {
  constructor(message, options = {}) {
    super(message, { status: 502, code: 'backend_adapter_error', ...options });
  }
}
