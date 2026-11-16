import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { registerKnowledgeExtension } from './index.js';
import { createKnowledgeToolsContext } from './dist/knowledge-runtime.mjs';

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe('piwin-knowledge Pi extension entrypoint', () => {
  it('registers all 7 tools and executes flashcards + folder RAG round-trip', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pkp-ext-root-'));
    const docsDir = await mkdtemp(join(tmpdir(), 'pkp-ext-docs-'));
    tempDirs.push(root, docsDir);
    await mkdir(docsDir, { recursive: true });
    await writeFile(
      join(docsDir, 'notes.md'),
      '# Spaced Repetition\n\nFSRS schedules reviews using stability and difficulty estimates.\n',
      'utf8',
    );

    const tools = new Map<string, ToolDefinition>();
    const commands = new Map<string, { handler: (args: string, ctx: unknown) => Promise<void> }>();
    const fakePi = {
      registerTool(def: ToolDefinition) {
        tools.set(def.name, def);
      },
      registerCommand(name: string, cmd: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        commands.set(name, cmd);
      },
    } as unknown as ExtensionAPI;

    registerKnowledgeExtension(fakePi, () => createKnowledgeToolsContext(root));

    expect([...tools.keys()]).toEqual([
      'flashcard_list',
      'flashcard_create',
      'flashcard_due_queue',
      'flashcard_rate',
      'rag_scan_folder',
      'rag_index_folder',
      'rag_retrieve',
    ]);
    expect(commands.has('knowledge')).toBe(true);

    const createRes = await tools.get('flashcard_create')!.execute(
      'c1',
      { cards: [{ model: 'basic', front: 'FSRS?', back: 'Free Spaced Repetition Scheduler', deck: 'algo' }] },
      undefined,
      undefined,
      {} as never,
    );
    expect((createRes.details as { created: unknown[] }).created).toHaveLength(1);

    const dueRes = await tools.get('flashcard_due_queue')!.execute(
      'c2',
      { deck: 'algo' },
      undefined,
      undefined,
      {} as never,
    );
    const due = dueRes.details as { totalDue: number; queue: Array<{ card: { id: string } }> };
    expect(due.totalDue).toBe(1);

    const indexRes = await tools.get('rag_index_folder')!.execute(
      'c3',
      { folderPath: docsDir },
      undefined,
      undefined,
      {} as never,
    );
    expect((indexRes.details as { indexed: number }).indexed).toBe(1);

    const searchRes = await tools.get('rag_retrieve')!.execute(
      'c4',
      { folderPath: docsDir, query: 'stability difficulty' },
      undefined,
      undefined,
      {} as never,
    );
    expect((searchRes.details as { chunks: unknown[] }).chunks.length).toBeGreaterThan(0);

    let notified = '';
    await commands.get('knowledge')!.handler('status', {
      hasUI: true,
      ui: {
        notify: (msg: string) => {
          notified = msg;
        },
      },
    });
    expect(notified).toContain('共 1 张卡片');
    expect(notified).toContain('今日待复习 1 张');
  });
});
