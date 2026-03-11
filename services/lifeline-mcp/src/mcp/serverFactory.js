import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTaskTools } from './taskTools.js';

export function createLifelineMcpServer({ principal, backendClient, config }) {
  const server = new McpServer(
    {
      name: config.serviceName,
      version: config.serviceVersion,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: [
        'Lifeline MCP provides task management tools over the Lifeline backend.',
        '',
        'Quick reference:',
        '- search_tasks / list_today / list_upcoming → discovery and navigation (compact previews)',
        '- get_task → canonical full-detail inspection for a single task by taskNumber',
        '- get_statistics → quick overview of task counts and state',
        '- export_tasks → full JSON snapshot of all tasks for backup or bulk review',
        '- list_tags / create_tag / update_tag / delete_tag → tag management',
        '- create_task / update_task → create and modify tasks',
        '- complete_task / uncomplete_task → toggle completion',
        '- batch_complete / batch_uncomplete / batch_archive → operate on multiple tasks at once',
        '- delete_task → archive-remove (not permanent delete)',
        '',
        'When listing tasks, preview text shows task number, title, status, due date, priority, duration, tags, and recurrence.',
        'For full detail on any task, call get_task with its taskNumber.',
        'Task business rules (validation, scoping, recurrence) are enforced by the backend.',
      ].join('\n'),
    },
  );

  registerTaskTools(server, { principal, backendClient });
  return server;
}
