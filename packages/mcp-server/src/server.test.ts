import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createKnowledgeToolsContext, handleKnowledgeToolCall } from './index.js';

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe('piwin-knowledge MCP tool handlers', () => {
  it('creates, lists, queues, and rates FSRS flashcards', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pkp-cards-'));
    tempDirs.push(root);
    const ctx = createKnowledgeToolsContext(root);

    const created = (await handleKnowledgeToolCall(ctx, 'flashcard_create', {
      cards: [
        { model: 'basic', front: 'What is FSRS?', back: 'Free Spaced Repetition Scheduler', deck: 'algo' },
      ],
    })) as { created: Array<{ id: string }> };
    expect(created.created).toHaveLength(1);

    const due = (await handleKnowledgeToolCall(ctx, 'flashcard_due_queue', { deck: 'algo' })) as {
      totalDue: number;
      queue: Array<{ card: { cardId: string } }>;
    };
    expect(due.totalDue).toBe(1);
    const cardId = due.queue[0]!.card.cardId;

    const rated = (await handleKnowledgeToolCall(ctx, 'flashcard_rate', {
      cardId,
      rating: 'good',
    })) as { reps: number };
    expect(rated.reps).toBe(1);
  });

  it('indexes and retrieves chunks from a local folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pkp-rag-root-'));
    const docsDir = await mkdtemp(join(tmpdir(), 'pkp-rag-docs-'));
    tempDirs.push(root, docsDir);
    await mkdir(docsDir, { recursive: true });
    await writeFile(
      join(docsDir, 'notes.md'),
      '# Spaced Repetition\n\nActive recall with spaced intervals improves long term retention.\n',
      'utf8',
    );

    const ctx = createKnowledgeToolsContext(root);
    const indexRes = (await handleKnowledgeToolCall(ctx, 'rag_index_folder', {
      folderPath: docsDir,
    })) as { indexed: number; chunks: number };
    expect(indexRes.indexed).toBe(1);
    expect(indexRes.chunks).toBeGreaterThan(0);

    const retrieved = (await handleKnowledgeToolCall(ctx, 'rag_retrieve', {
      folderPath: docsDir,
      query: 'spaced retention',
    })) as { chunks: Array<{ content: string }> };
    expect(retrieved.chunks.length).toBeGreaterThan(0);
  });
});
