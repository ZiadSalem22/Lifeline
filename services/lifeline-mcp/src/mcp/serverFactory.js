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
      instructions: 'Lifeline MCP provides thin task tools over the internal Lifeline backend adapter. Task business rules remain source-of-truth in the backend.',
    },
  );

  registerTaskTools(server, { principal, backendClient });
  return server;
}
