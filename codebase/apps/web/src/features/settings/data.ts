import { api } from '../../shared/api/client';

/** Server endpoints used by the Settings modal (02-api-contract-v1.md). */

export function downloadExportBlob(format: 'json' | 'csv'): Promise<Blob> {
  return api.getBlob(`/export?format=${format}`);
}

export function importData(
  data: string,
  mode: 'merge' | 'replace',
): Promise<{ importedCount: number }> {
  return api.post<{ importedCount: number }>('/import', { data, mode });
}

export function resetAccount(): Promise<unknown> {
  return api.post<unknown>('/account/reset');
}
