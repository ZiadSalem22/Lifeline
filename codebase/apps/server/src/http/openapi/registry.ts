import { z } from 'zod';

/**
 * Tiny zod-backed route registry. Feature routers register their endpoints;
 * `buildDocument()` emits an OpenAPI 3.1 document (zod v4 `z.toJSONSchema`
 * produces JSON Schema 2020-12, which OpenAPI 3.1 accepts natively).
 * Schemas are inlined — no components dedupe by design (small surface).
 */

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RouteResponse {
  description: string;
  schema?: z.ZodType | undefined;
}

export interface RouteEntry {
  method: HttpMethod;
  /** Express-style path (`/api/v1/todos/:id`); converted to `{id}` style. */
  path: string;
  summary: string;
  tag: string;
  request?:
    | {
        params?: z.ZodType | undefined;
        query?: z.ZodType | undefined;
        body?: z.ZodType | undefined;
      }
    | undefined;
  responses: Record<string, RouteResponse>;
}

function toJsonSchema(schema: z.ZodType, io: 'input' | 'output'): Record<string, unknown> {
  try {
    return z.toJSONSchema(schema, { io, unrepresentable: 'any' });
  } catch {
    return {};
  }
}

function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

interface ParameterObject {
  name: string;
  in: 'query' | 'path';
  required: boolean;
  schema: Record<string, unknown>;
}

function parametersFrom(schema: z.ZodType, location: 'query' | 'path'): ParameterObject[] {
  if (!(schema instanceof z.ZodObject)) return [];
  const shape = schema.shape as Record<string, z.ZodType>;
  return Object.entries(shape).map(([name, field]) => ({
    name,
    in: location,
    // Path params are always required; query params are required only when
    // they reject undefined (no .optional()/.default()).
    required: location === 'path' ? true : !field.safeParse(undefined).success,
    schema: toJsonSchema(field, 'input'),
  }));
}

export class OpenApiRegistry {
  private readonly entries: RouteEntry[] = [];

  register(entry: RouteEntry): void {
    this.entries.push(entry);
  }

  list(): readonly RouteEntry[] {
    return this.entries;
  }

  buildDocument(info: {
    title: string;
    version: string;
    description?: string;
  }): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const entry of this.entries) {
      const path = toOpenApiPath(entry.path);
      const parameters: ParameterObject[] = [
        ...(entry.request?.params ? parametersFrom(entry.request.params, 'path') : []),
        ...(entry.request?.query ? parametersFrom(entry.request.query, 'query') : []),
      ];

      const responses: Record<string, unknown> = {};
      for (const [status, response] of Object.entries(entry.responses)) {
        responses[status] = {
          description: response.description,
          ...(response.schema
            ? {
                content: {
                  'application/json': { schema: toJsonSchema(response.schema, 'output') },
                },
              }
            : {}),
        };
      }

      const operation: Record<string, unknown> = {
        summary: entry.summary,
        tags: [entry.tag],
        ...(parameters.length > 0 ? { parameters } : {}),
        ...(entry.request?.body
          ? {
              requestBody: {
                required: true,
                content: {
                  'application/json': { schema: toJsonSchema(entry.request.body, 'input') },
                },
              },
            }
          : {}),
        responses,
      };

      paths[path] = { ...paths[path], [entry.method]: operation };
    }

    return {
      openapi: '3.1.0',
      info,
      paths,
    };
  }
}
