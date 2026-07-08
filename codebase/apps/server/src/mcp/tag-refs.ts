import type { Tag } from '@lifeline/shared';
import { McpToolInputError } from './errors.js';

/**
 * Strict tag-reference resolution, ported from the old backend
 * `internal/mcp/taskTags.js` (fix 3c58273d). MCP writes accept tag names,
 * `{id}` / `{name}` objects, or canonical `{id,name,color}` objects; anything
 * that doesn't resolve against the CURRENT USER's visible tags is a 400
 * `invalid_input` (unlike the lenient REST path, which silently drops unknown
 * references). Results are canonical tag objects, deduped by id.
 */

/** Object-literal type (not an interface) so it stays assignable to the shared TagReference shape. */
export type ResolvedMcpTag = {
  id: string | number;
  name: string;
  color: string;
  userId: string | null;
  isDefault: boolean;
};

export type McpTagReference =
  | string
  | { id?: string | number | undefined; name?: string | undefined; color?: string | undefined };

export interface TagLookup {
  execute(userId: string): Promise<Tag[]>;
}

function normalizeTagName(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function buildResolvedTag(tag: {
  id: string | number;
  name: string;
  color: string;
  userId?: string | null | undefined;
  isDefault?: boolean | undefined;
}): ResolvedMcpTag {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    userId: tag.userId ?? null,
    isDefault: Boolean(tag.isDefault),
  };
}

function isCanonicalTagObject(
  tag: McpTagReference,
): tag is { id: string | number; name: string; color: string } {
  return (
    typeof tag === 'object' &&
    tag !== null &&
    tag.id !== undefined &&
    typeof tag.name === 'string' &&
    tag.name.trim() !== '' &&
    typeof tag.color === 'string' &&
    tag.color.trim() !== ''
  );
}

function describeTagReference(tagReference: McpTagReference): string {
  if (typeof tagReference === 'string') return tagReference.trim();
  if (tagReference && typeof tagReference === 'object') {
    if (typeof tagReference.name === 'string' && tagReference.name.trim() !== '') {
      return tagReference.name.trim();
    }
    if (tagReference.id !== undefined && tagReference.id !== null) {
      return String(tagReference.id);
    }
  }
  return 'unknown';
}

interface TagIndexes {
  tagsById: Map<string, ResolvedMcpTag>;
  tagsByName: Map<string, ResolvedMcpTag>;
}

function createTagIndexes(tags: readonly Tag[]): TagIndexes {
  const tagsById = new Map<string, ResolvedMcpTag>();
  const tagsByName = new Map<string, ResolvedMcpTag>();

  for (const tag of tags) {
    const resolvedTag = buildResolvedTag(tag);
    tagsById.set(String(resolvedTag.id), resolvedTag);
    const normalizedName = normalizeTagName(resolvedTag.name);
    if (normalizedName !== '') tagsByName.set(normalizedName, resolvedTag);
  }

  return { tagsById, tagsByName };
}

/**
 * Resolve MCP tag references to canonical tags. `undefined` passes through
 * (field absent). Throws {@link McpToolInputError} on unresolvable entries:
 * `Tag "X" was not found for the current user.`
 */
export async function resolveMcpTaskTags(
  inputTags: readonly McpTagReference[] | undefined,
  { userId, listTags }: { userId: string; listTags: TagLookup },
): Promise<ResolvedMcpTag[] | undefined> {
  if (inputTags === undefined) return undefined;

  const resolvedTags: ResolvedMcpTag[] = [];
  const seenIds = new Set<string>();
  let tagIndexes: TagIndexes | null = null;

  const ensureTagIndexes = async (): Promise<TagIndexes> => {
    if (tagIndexes) return tagIndexes;
    const availableTags = await listTags.execute(userId);
    tagIndexes = createTagIndexes(availableTags);
    return tagIndexes;
  };

  for (const tagReference of inputTags) {
    let resolvedTag: ResolvedMcpTag | null;

    if (isCanonicalTagObject(tagReference)) {
      resolvedTag = buildResolvedTag(tagReference);
    } else if (typeof tagReference === 'string') {
      const { tagsByName } = await ensureTagIndexes();
      resolvedTag = tagsByName.get(normalizeTagName(tagReference)) ?? null;
    } else if (tagReference && typeof tagReference === 'object') {
      if (tagReference.id !== undefined && tagReference.id !== null) {
        const { tagsById } = await ensureTagIndexes();
        resolvedTag = tagsById.get(String(tagReference.id)) ?? null;
      } else if (typeof tagReference.name === 'string' && tagReference.name.trim() !== '') {
        const { tagsByName } = await ensureTagIndexes();
        resolvedTag = tagsByName.get(normalizeTagName(tagReference.name)) ?? null;
      } else {
        throw new McpToolInputError('Each tag must include an id or name.');
      }
    } else {
      throw new McpToolInputError('Each tag must be a string or object.');
    }

    if (!resolvedTag) {
      throw new McpToolInputError(
        `Tag "${describeTagReference(tagReference)}" was not found for the current user.`,
      );
    }

    const resolvedId = String(resolvedTag.id);
    if (!seenIds.has(resolvedId)) {
      seenIds.add(resolvedId);
      resolvedTags.push(resolvedTag);
    }
  }

  return resolvedTags;
}
