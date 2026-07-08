import { Router } from 'express';
import { z } from 'zod';
import {
  createTagSchema,
  problemSchema,
  tagSchema,
  updateTagSchema,
  type CreateTagInput,
  type UpdateTagInput,
} from '@lifeline/shared';
import { UnauthorizedError } from '../../domain/errors.js';
import type { CreateTag } from '../../application/tags/create-tag.js';
import type { DeleteTag } from '../../application/tags/delete-tag.js';
import type { ListTags } from '../../application/tags/list-tags.js';
import type { UpdateTag } from '../../application/tags/update-tag.js';
import { getValidated, validate } from '../middleware/validate.js';
import type { OpenApiRegistry } from '../openapi/registry.js';

export interface TagsRouterDeps {
  listTags: ListTags;
  createTag: CreateTag;
  updateTag: UpdateTag;
  deleteTag: DeleteTag;
  registry: OpenApiRegistry;
}

const idParamsSchema = z.object({ id: z.string().min(1) });
type IdParams = z.infer<typeof idParamsSchema>;

/** Tags feature router (mounted at /api/v1/tags). */
export function buildTagsRouter(deps: TagsRouterDeps): Router {
  const router = Router();
  registerOpenApi(deps.registry);

  router.get('/', async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    res.json(await deps.listTags.execute(user.id));
  });

  router.post('/', validate(createTagSchema), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const input = getValidated<CreateTagInput>(req);
    res.status(201).json(await deps.createTag.execute(user.id, user.role, input));
  });

  router.patch(
    '/:id',
    validate(idParamsSchema, 'params'),
    validate(updateTagSchema),
    async (req, res) => {
      const user = requireCurrentUser(req.currentUser);
      const { id } = getValidated<IdParams>(req, 'params');
      const input = getValidated<UpdateTagInput>(req);
      res.json(await deps.updateTag.execute(user.id, id, input));
    },
  );

  router.delete('/:id', validate(idParamsSchema, 'params'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { id } = getValidated<IdParams>(req, 'params');
    await deps.deleteTag.execute(user.id, id);
    res.status(204).send();
  });

  return router;
}

function requireCurrentUser<T extends { id: string }>(user: T | null | undefined): T {
  if (!user?.id) throw new UnauthorizedError();
  return user;
}

function registerOpenApi(registry: OpenApiRegistry): void {
  const tag = 'tags';
  const problem = (description: string) => ({ description, schema: problemSchema });

  registry.register({
    method: 'get',
    path: '/api/v1/tags',
    summary: 'List visible tags (global defaults first, then own custom by name)',
    tag,
    responses: {
      '200': { description: 'Tags', schema: z.array(tagSchema) },
      '401': problem('Not authenticated'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/tags',
    summary: 'Create a custom tag (free tier caps at 50)',
    tag,
    request: { body: createTagSchema },
    responses: {
      '201': { description: 'Created tag', schema: tagSchema },
      '400': problem('Validation failed'),
      '403': problem('Free tier max tags reached'),
      '409': problem('Duplicate tag name'),
    },
  });
  registry.register({
    method: 'patch',
    path: '/api/v1/tags/:id',
    summary: 'Rename/recolor an owned custom tag',
    tag,
    request: { params: idParamsSchema, body: updateTagSchema },
    responses: {
      '200': { description: 'Updated tag', schema: tagSchema },
      '400': problem('Validation failed'),
      '403': problem('Default tag or not owner'),
      '404': problem('Not found'),
      '409': problem('Duplicate tag name'),
    },
  });
  registry.register({
    method: 'delete',
    path: '/api/v1/tags/:id',
    summary: 'Delete an owned custom tag',
    tag,
    request: { params: idParamsSchema },
    responses: {
      '204': { description: 'Deleted' },
      '403': problem('Default tag or not owner'),
      '404': problem('Not found'),
    },
  });
}
