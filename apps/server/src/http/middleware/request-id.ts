import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const HEADER = 'X-Request-Id';
const MAX_INCOMING_LENGTH = 128;

/**
 * Bind a request id to `req.requestId` and echo it as `X-Request-Id`.
 * Honors a sane incoming header (proxy-assigned ids), else mints a UUID.
 */
export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header(HEADER)?.trim();
    const id =
      incoming !== undefined && incoming !== '' && incoming.length <= MAX_INCOMING_LENGTH
        ? incoming
        : randomUUID();
    req.requestId = id;
    res.setHeader(HEADER, id);
    next();
  };
}
