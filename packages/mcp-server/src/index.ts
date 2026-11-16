import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  buildReviewQueue,
  createCardStore,
  type CardStore,
} from '@piwin-knowledge/flashcards';
import {
  createFolderRag,
  scanFolderFiles,
  type FolderRag,
} from '@piwin-knowledge/doc-rag';
import type { FlashcardCreateInput, ReviewRating } from '@piwin-knowledge/core';

export type KnowledgeToolsContext = {
  piwinRoot: string;
  cards: CardStore;
  rag: FolderRag;
};

export function createKnowledgeToolsContext(
  piwinRoot = process.env.PIWIN_KNOWLEDGE_ROOT || join(homedir(), '.piwin'),
): KnowledgeToolsContext {
  return {
    piwinRoot,
    cards: createCardStore({ piwinRoot }),
    rag: createFolderRag({ piwinRoot }),
  };
}

export const KNOWLEDGE_TOOL_DEFINITIONS = [
  {
    name: 'flashcard_list',
    description: 'List stored flashcards with optional deck or tag filter.',
    inputSchema: {
      type: 'object',
      properties: {
        deck: { type: 'string' },
        tag: { type: 'string' },
      },
    },
  },
  {
    name: 'flashcard_create',
    description: 'Create one or more FSRS flashcards (basic or cloze).',
    inputSchema: {
      type: 'object',
      properties: {
        cards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              model: { type: 'string', enum: ['basic', 'cloze'] },
              front: { type: 'string' },
              back: { type: 'string' },
              text: { type: 'string' },
              deck: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      required: ['cards'],
    },
  },
  {
    name: 'flashcard_due_queue',
    description: 'Build the FSRS due + new review queue for today.',
    inputSchema: {
      type: 'object',
      properties: {
        deck: { type: 'string' },
        newPerDay: { type: 'number' },
        maxReviewsPerDay: { type: 'number' },
      },
    },
  },
  {
    name: 'flashcard_rate',
    description: 'Submit an FSRS review rating (again | hard | good | easy) for a review cardId.',
    inputSchema: {
      type: 'object',
      properties: {
        cardId: { type: 'string' },
        rating: { type: 'string', enum: ['again', 'hard', 'good', 'easy'] },
      },
      required: ['cardId', 'rating'],
    },
  },
  {
    name: 'rag_scan_folder',
    description: 'Scan a local folder for supported documents.',
    inputSchema: {
      type: 'object',
      properties: {
        folderPath: { type: 'string' },
      },
      required: ['folderPath'],
    },
  },
  {
    name: 'rag_index_folder',
    description: 'Index a local folder into SQLite FTS5 chunk store.',
    inputSchema: {
      type: 'object',
      properties: {
        folderPath: { type: 'string' },
        includeFiles: { type: 'array', items: { type: 'string' } },
      },
      required: ['folderPath'],
    },
  },
  {
    name: 'rag_retrieve',
    description: 'Retrieve top-k chunks from an indexed local folder.',
    inputSchema: {
      type: 'object',
      properties: {
        folderPath: { type: 'string' },
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['folderPath', 'query'],
    },
  },
] as const;

export async function handleKnowledgeToolCall(
  ctx: KnowledgeToolsContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'flashcard_list': {
      const filter: { deck?: string; tag?: string } = {};
      if (typeof args.deck === 'string') filter.deck = args.deck;
      if (typeof args.tag === 'string') filter.tag = args.tag;
      return { cards: await ctx.cards.listReviewCards(filter) };
    }
    case 'flashcard_create': {
      const rawCards = Array.isArray(args.cards) ? (args.cards as FlashcardCreateInput[]) : [];
      return ctx.cards.batchCreate({ cards: rawCards });
    }
    case 'flashcard_due_queue': {
      const cards = await ctx.cards.listReviewCards(
        typeof args.deck === 'string' ? { deck: args.deck } : undefined,
      );
      const states = await ctx.cards.loadReviewStates();
      const queue = buildReviewQueue({
        cards,
        states,
        ...(typeof args.deck === 'string' ? { deck: args.deck } : {}),
        ...(typeof args.newPerDay === 'number' ? { newPerDay: args.newPerDay } : {}),
        ...(typeof args.maxReviewsPerDay === 'number'
          ? { maxReviewsPerDay: args.maxReviewsPerDay }
          : {}),
      });
      return { totalDue: queue.length, queue };
    }
    case 'flashcard_rate': {
      const cardId = String(args.cardId ?? '');
      const rating = String(args.rating ?? '') as ReviewRating;
      if (!cardId || !['again', 'hard', 'good', 'easy'].includes(rating)) {
        throw new Error('cardId and valid rating (again|hard|good|easy) are required');
      }
      return ctx.cards.rate(cardId, rating);
    }
    case 'rag_scan_folder': {
      return scanFolderFiles(String(args.folderPath ?? ''));
    }
    case 'rag_index_folder': {
      const folderPath = String(args.folderPath ?? '');
      const includeFiles = Array.isArray(args.includeFiles)
        ? args.includeFiles.filter((x): x is string => typeof x === 'string')
        : undefined;
      return ctx.rag.indexFolder(folderPath, includeFiles ? { includeFiles } : undefined);
    }
    case 'rag_retrieve': {
      const folderPath = String(args.folderPath ?? '');
      const query = String(args.query ?? '');
      const limit = typeof args.limit === 'number' ? args.limit : undefined;
      return { chunks: await ctx.rag.retrieve(folderPath, query, limit !== undefined ? { limit } : undefined) };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function createKnowledgeMcpServer(ctx = createKnowledgeToolsContext()): Server {
  const server = new Server(
    { name: 'piwin-knowledge-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...KNOWLEDGE_TOOL_DEFINITIONS],
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createKnowledgeMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
