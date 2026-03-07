import { ToolInputError } from '../errors.js';

export async function resolveTaskIdForMutation({ backendClient, principal, taskNumber = null, id = null }) {
  if (!backendClient) {
    throw new ToolInputError('Backend client is required for task resolution.');
  }

  if (!taskNumber && !id) {
    throw new ToolInputError('Provide taskNumber or id.');
  }

  if (id && !taskNumber) {
    return String(id);
  }

  const taskResponse = await backendClient.getTaskByNumber(principal, taskNumber);
  const resolvedTask = taskResponse?.task;
  if (!resolvedTask?.id) {
    throw new ToolInputError('Task resolution failed for the provided taskNumber.');
  }

  if (id && String(id) !== String(resolvedTask.id)) {
    throw new ToolInputError('Provided id and taskNumber do not resolve to the same task.');
  }

  return String(resolvedTask.id);
}
