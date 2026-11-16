import { pathToFileURL } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  createKnowledgeToolsContext,
  handleKnowledgeToolCall,
  KNOWLEDGE_TOOL_DEFINITIONS,
  type KnowledgeToolsContext,
} from './tools.js';

export {
  createKnowledgeToolsContext,
  handleKnowledgeToolCall,
  KNOWLEDGE_TOOL_DEFINITIONS,
  type KnowledgeToolsContext,
};

export function createKnowledgeMcpServer(ctx = createKnowledgeToolsContext()): Server {
  const server = new Server(
    { name: 'piwin-knowledge-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: KNOWLEDGE_TOOL_DEFINITIONS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    try {
      const result = await handleKnowledgeToolCall(ctx, request.params.name, args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  });

  return server;
}

const isEntrypoint =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  const server = createKnowledgeMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
