import type { CurrentUser } from '../application/ports.js';

/**
 * Express request augmentation. `requestId` is set by the request-id
 * middleware, `currentUser` by the auth middleware, and `validated` by the
 * validate() helper (Express 5's `req.query` is a getter, so parsed inputs
 * are stored here instead of being written back).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      currentUser?: CurrentUser | null;
      validated?: Partial<Record<'body' | 'query' | 'params', unknown>>;
    }
  }
}

export {};
