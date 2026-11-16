/**
 * piwin-knowledge — Standalone Pi extension for FSRS spaced-repetition flashcards
 * and local folder SQLite FTS5 RAG retrieval.
 *
 * Runtime dependencies are pre-bundled into ./dist/knowledge-runtime.mjs so
 * piwin can stage this extension directly from a pinned Git commit without
 * running npm install.
 */
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { TSchema } from 'typebox';
import {
  createKnowledgeToolsContext,
  handleKnowledgeToolCall,
  KNOWLEDGE_TOOL_DEFINITIONS,
  type KnowledgeToolsContext,
} from './dist/knowledge-runtime.mjs';

export function registerKnowledgeExtension(
  pi: ExtensionAPI,
  ctxFactory: () => KnowledgeToolsContext = () => createKnowledgeToolsContext(),
): void {
  let knowledgeCtx: KnowledgeToolsContext | undefined;
  const getCtx = (): KnowledgeToolsContext => {
    knowledgeCtx ??= ctxFactory();
    return knowledgeCtx;
  };

  for (const def of KNOWLEDGE_TOOL_DEFINITIONS) {
    pi.registerTool({
      name: def.name,
      label: def.label,
      description: def.description,
      promptSnippet: def.promptSnippet,
      ...('promptGuidelines' in def ? { promptGuidelines: [...def.promptGuidelines] } : {}),
      parameters: def.inputSchema as unknown as TSchema,
      async execute(_toolCallId, params) {
        const result = await handleKnowledgeToolCall(
          getCtx(),
          def.name,
          (params ?? {}) as Record<string, unknown>,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          details: result,
        };
      },
    });
  }

  pi.registerCommand('knowledge', {
    description: 'Inspect FSRS flashcards & due count, or show usage tips',
    handler: async (args, cmdCtx: ExtensionContext) => {
      const sub = args.trim().toLowerCase();
      const ctx = getCtx();
      if (sub === 'due' || sub === '' || sub === 'status') {
        const queue = (await handleKnowledgeToolCall(ctx, 'flashcard_due_queue', {})) as {
          totalDue: number;
        };
        const all = (await handleKnowledgeToolCall(ctx, 'flashcard_list', {})) as {
          cards: unknown[];
        };
        const message = `Knowledge & Flashcards · 共 ${all.cards.length} 张卡片，今日待复习 ${queue.totalDue} 张。可直接说「帮我复习到期闪卡」或「索引 ./docs 并提炼闪卡」。`;
        if (cmdCtx.hasUI) {
          cmdCtx.ui.notify(message, 'info');
        } else {
          pi.sendMessage(
            { customType: 'piwin-knowledge-status', content: message, display: true },
            { triggerTurn: false },
          );
        }
        return;
      }
      const help =
        '用法: /knowledge [status|due] · 可用工具: flashcard_create / flashcard_list / flashcard_due_queue / flashcard_rate / rag_scan_folder / rag_index_folder / rag_retrieve';
      if (cmdCtx.hasUI) cmdCtx.ui.notify(help, 'info');
    },
  });
}

export default function piwinKnowledgeExtension(pi: ExtensionAPI): void {
  registerKnowledgeExtension(pi);
}
