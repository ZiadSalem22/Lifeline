const { ValidationError } = require('../../utils/errors');

function normalizeTagName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function buildResolvedTag(tag) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    userId: tag.userId || null,
    isDefault: !!tag.isDefault,
  };
}

function isCanonicalTagObject(tag) {
  return !!tag
    && typeof tag === 'object'
    && tag.id !== undefined
    && typeof tag.name === 'string'
    && tag.name.trim()
    && typeof tag.color === 'string'
    && tag.color.trim();
}

function describeTagReference(tagReference) {
  if (typeof tagReference === 'string') {
    return tagReference.trim();
  }

  if (tagReference && typeof tagReference === 'object') {
    if (typeof tagReference.name === 'string' && tagReference.name.trim()) {
      return tagReference.name.trim();
    }
    if (tagReference.id !== undefined && tagReference.id !== null) {
      return String(tagReference.id);
    }
  }

  return 'unknown';
}

function createTagIndexes(tags) {
  const tagsById = new Map();
  const tagsByName = new Map();

  for (const tag of tags) {
    if (!tag || tag.id === undefined || tag.id === null) {
      continue;
    }

    const resolvedTag = buildResolvedTag(tag);
    tagsById.set(String(resolvedTag.id), resolvedTag);

    const normalizedName = normalizeTagName(resolvedTag.name);
    if (normalizedName) {
      tagsByName.set(normalizedName, resolvedTag);
    }
  }

  return { tagsById, tagsByName };
}

async function resolveMcpTaskTags(inputTags, { userId, listTags } = {}) {
  if (inputTags === undefined) {
    return undefined;
  }

  if (!Array.isArray(inputTags)) {
    throw new ValidationError('tags must be an array.');
  }

  const resolvedTags = [];
  const seenIds = new Set();
  let tagIndexes = null;

  async function ensureTagIndexes() {
    if (tagIndexes) {
      return tagIndexes;
    }

    if (!listTags || typeof listTags.execute !== 'function') {
      throw new ValidationError('Tag lookup is unavailable for this request.');
    }

    const availableTags = await listTags.execute(userId);
    tagIndexes = createTagIndexes(Array.isArray(availableTags) ? availableTags : []);
    return tagIndexes;
  }

  for (const tagReference of inputTags) {
    let resolvedTag = null;

    if (isCanonicalTagObject(tagReference)) {
      resolvedTag = buildResolvedTag(tagReference);
    } else if (typeof tagReference === 'string') {
      const { tagsByName } = await ensureTagIndexes();
      resolvedTag = tagsByName.get(normalizeTagName(tagReference)) || null;
    } else if (tagReference && typeof tagReference === 'object') {
      if (tagReference.id !== undefined && tagReference.id !== null) {
        const { tagsById } = await ensureTagIndexes();
        resolvedTag = tagsById.get(String(tagReference.id)) || null;
      } else if (typeof tagReference.name === 'string' && tagReference.name.trim()) {
        const { tagsByName } = await ensureTagIndexes();
        resolvedTag = tagsByName.get(normalizeTagName(tagReference.name)) || null;
      } else {
        throw new ValidationError('Each tag must include an id or name.');
      }
    } else {
      throw new ValidationError('Each tag must be a string or object.');
    }

    if (!resolvedTag) {
      throw new ValidationError(`Tag "${describeTagReference(tagReference)}" was not found for the current user.`);
    }

    const resolvedId = String(resolvedTag.id);
    if (!seenIds.has(resolvedId)) {
      seenIds.add(resolvedId);
      resolvedTags.push(resolvedTag);
    }
  }

  return resolvedTags;
}

module.exports = {
  resolveMcpTaskTags,
};