#!/usr/bin/env node
import process from 'node:process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = rest[index + 1];
    if (typeof value === 'undefined' || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    options[key] = value;
    index += 1;
  }

  return { command, options };
}

function printUsage() {
  console.error('Usage: node scripts/mcp-client-cli.js <list-tools|call-tool|smoke-rw|smoke-ro> --server-url <url> (--api-key <key> | --access-token <token>) [--tool <name>] [--args-json <json>] [--assert-query-absent <text>] [--title-prefix <text>]');
}

function normalizeServerUrl(value) {
  const url = new URL(String(value || '').trim());
  if (!url.pathname || url.pathname === '/') {
    url.pathname = '/mcp';
  }
  return url;
}

function parseArgsJson(value) {
  if (!value) return {};
  return JSON.parse(value);
}

function summarizeTool(tool) {
  return {
    name: tool.name,
    description: tool.description,
    annotations: tool.annotations || null,
  };
}

function assertRequiredOptions(options, requiredKeys) {
  requiredKeys.forEach((key) => {
    if (!String(options[key] || '').trim()) {
      throw new Error(`--${key} is required.`);
    }
  });
}

async function connectClient({ serverUrl, bearerToken }) {
  const client = new Client({
    name: 'lifeline-mcp-cli-client',
    version: '0.1.0',
  }, {
    capabilities: {},
  });

  const transport = new StreamableHTTPClientTransport(serverUrl, {
    requestInit: {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  });

  await client.connect(transport);

  return {
    client,
    transport,
  };
}

async function withClient(options, action) {
  const { client, transport } = await connectClient(options);

  try {
    return await action(client);
  } finally {
    await transport.close();
  }
}

function readStructuredContent(result, toolName) {
  if (result?.isError) {
    const errorMessage = result?.structuredContent?.error?.message || `${toolName} returned an error`;
    const error = new Error(errorMessage);
    error.result = result;
    throw error;
  }

  return result?.structuredContent ?? null;
}

async function listToolsCommand(options) {
  const tools = await withClient(options, async (client) => client.listTools());
  return {
    serverUrl: String(options.serverUrl),
    toolCount: tools.tools.length,
    tools: tools.tools.map(summarizeTool),
  };
}

async function callToolCommand(options) {
  const result = await withClient(options, async (client) => client.callTool({
    name: options.tool,
    arguments: options.args,
  }));

  return {
    serverUrl: String(options.serverUrl),
    tool: options.tool,
    result,
  };
}

async function smokeReadWriteCommand(options) {
  const today = new Date().toISOString().slice(0, 10);
  const title = `${options.titlePrefix || 'MCP smoke'} ${new Date().toISOString()}`;
  const summary = {
    serverUrl: String(options.serverUrl),
    validatedTools: [],
  };

  return withClient(options, async (client) => {
    let createdTaskNumber = null;

    try {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((tool) => tool.name);
      ['search_tasks', 'list_today', 'create_task', 'complete_task', 'delete_task'].forEach((requiredTool) => {
        if (!toolNames.includes(requiredTool)) {
          throw new Error(`Required tool ${requiredTool} was not advertised by the MCP server.`);
        }
      });
      summary.validatedTools = ['search_tasks', 'list_today', 'create_task', 'complete_task', 'delete_task'];

      if (options.assertQueryAbsent) {
        const absentSearch = await client.callTool({
          name: 'search_tasks',
          arguments: { query: options.assertQueryAbsent },
        });
        const absentPayload = readStructuredContent(absentSearch, 'search_tasks');
        const absentTotal = Number(absentPayload?.total || 0);
        if (absentTotal !== 0) {
          throw new Error(`Expected query "${options.assertQueryAbsent}" to be absent, but ${absentTotal} task(s) were visible.`);
        }
        summary.absentQueryCheck = {
          query: options.assertQueryAbsent,
          total: absentTotal,
        };
      }

      const createResult = await client.callTool({
        name: 'create_task',
        arguments: {
          title,
          dueDate: today,
          priority: 'medium',
        },
      });
      const createPayload = readStructuredContent(createResult, 'create_task');
      createdTaskNumber = createPayload?.task?.taskNumber || null;
      if (!createdTaskNumber) {
        throw new Error('create_task did not return a taskNumber.');
      }
      summary.createTask = {
        taskNumber: createdTaskNumber,
        title: createPayload.task.title,
      };

      const listTodayResult = await client.callTool({ name: 'list_today', arguments: {} });
      const listTodayPayload = readStructuredContent(listTodayResult, 'list_today');
      const todayTasks = Array.isArray(listTodayPayload?.tasks) ? listTodayPayload.tasks : [];
      if (!todayTasks.some((task) => task.taskNumber === createdTaskNumber)) {
        throw new Error(`list_today did not include created task #${createdTaskNumber}.`);
      }
      summary.listToday = {
        total: todayTasks.length,
        createdTaskVisible: true,
      };

      const searchResult = await client.callTool({
        name: 'search_tasks',
        arguments: { query: title },
      });
      const searchPayload = readStructuredContent(searchResult, 'search_tasks');
      const searchTasks = Array.isArray(searchPayload?.tasks) ? searchPayload.tasks : [];
      if (!searchTasks.some((task) => task.taskNumber === createdTaskNumber)) {
        throw new Error(`search_tasks did not return created task #${createdTaskNumber}.`);
      }
      summary.searchTasks = {
        total: Number(searchPayload?.total || searchTasks.length),
        createdTaskVisible: true,
      };

      const completeResult = await client.callTool({
        name: 'complete_task',
        arguments: { taskNumber: createdTaskNumber },
      });
      const completePayload = readStructuredContent(completeResult, 'complete_task');
      if (!completePayload?.completed || !completePayload?.task?.isCompleted) {
        throw new Error(`complete_task did not mark task #${createdTaskNumber} as completed.`);
      }
      summary.completeTask = {
        taskNumber: createdTaskNumber,
        completed: true,
      };

      const deleteResult = await client.callTool({
        name: 'delete_task',
        arguments: { taskNumber: createdTaskNumber },
      });
      const deletePayload = readStructuredContent(deleteResult, 'delete_task');
      if (!deletePayload?.deleted) {
        throw new Error(`delete_task did not confirm deletion for task #${createdTaskNumber}.`);
      }
      summary.deleteTask = {
        taskNumber: createdTaskNumber,
        deleted: true,
        deleteMode: deletePayload.deleteMode || null,
      };
      createdTaskNumber = null;

      return summary;
    } catch (error) {
      if (createdTaskNumber) {
        try {
          await client.callTool({
            name: 'delete_task',
            arguments: { taskNumber: createdTaskNumber },
          });
        } catch (_cleanupError) {
          summary.cleanup = {
            attemptedDeleteTaskNumber: createdTaskNumber,
            deleted: false,
          };
        }
      }

      throw error;
    }
  });
}

async function smokeReadOnlyCommand(options) {
  return withClient(options, async (client) => {
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    ['search_tasks', 'create_task'].forEach((requiredTool) => {
      if (!toolNames.includes(requiredTool)) {
        throw new Error(`Required tool ${requiredTool} was not advertised by the MCP server.`);
      }
    });

    const readResult = await client.callTool({
      name: 'search_tasks',
      arguments: { query: 'read-only-smoke-probe' },
    });
    readStructuredContent(readResult, 'search_tasks');

    const deniedResult = await client.callTool({
      name: 'create_task',
      arguments: { title: 'Read-only scope denial probe' },
    });

    if (!deniedResult?.isError || deniedResult?.structuredContent?.error?.code !== 'scope_denied') {
      throw new Error('Expected create_task to fail with scope_denied for a read-only key.');
    }

    return {
      serverUrl: String(options.serverUrl),
      validatedTools: ['search_tasks', 'create_task'],
      readQuerySucceeded: true,
      deniedWriteCode: deniedResult.structuredContent.error.code,
    };
  });
}

async function main(argv = process.argv.slice(2)) {
  try {
    const { command, options } = parseArguments(argv);
    if (!command) {
      throw new Error('A command is required.');
    }

    assertRequiredOptions(options, ['server-url']);
    const bearerToken = String(options['access-token'] || options['api-key'] || '').trim();
    if (!bearerToken) {
      throw new Error('Either --api-key or --access-token is required.');
    }

    const normalizedOptions = {
      command,
      serverUrl: normalizeServerUrl(options['server-url']),
      bearerToken,
      tool: options.tool ? String(options.tool).trim() : null,
      args: parseArgsJson(options['args-json']),
      assertQueryAbsent: options['assert-query-absent'] ? String(options['assert-query-absent']) : null,
      titlePrefix: options['title-prefix'] ? String(options['title-prefix']) : null,
    };

    let payload;

    if (command === 'list-tools') {
      payload = await listToolsCommand(normalizedOptions);
    } else if (command === 'call-tool') {
      if (!normalizedOptions.tool) {
        throw new Error('--tool is required for call-tool.');
      }
      payload = await callToolCommand(normalizedOptions);
    } else if (command === 'smoke-rw') {
      payload = await smokeReadWriteCommand(normalizedOptions);
    } else if (command === 'smoke-ro') {
      payload = await smokeReadOnlyCommand(normalizedOptions);
    } else {
      throw new Error(`Unsupported command: ${command}`);
    }

    console.log(JSON.stringify(payload, null, 2));
  } catch (error) {
    printUsage();
    console.error(error.message);
    if (error?.result) {
      console.error(JSON.stringify(error.result, null, 2));
    }
    process.exit(1);
  }
}

main();
