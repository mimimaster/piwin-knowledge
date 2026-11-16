# piwin-knowledge

Standalone **Knowledge & Flashcards** extension for [piwin](https://github.com/mimimaster/piwin):

- **FSRS Spaced-Repetition Flashcards** (`flashcard_list`, `flashcard_create`, `flashcard_due_queue`, `flashcard_rate`) backed by JSON/Markdown files in `~/.piwin/flashcards`.
- **Local Folder RAG** (`rag_scan_folder`, `rag_index_folder`, `rag_retrieve`) backed by Node built-in `node:sqlite` + FTS5 in `~/.piwin/doc-rag`.
- **Interactive `/knowledge` command** and Canvas flashcard deck guidance.
- Also ships `dist/mcp-server.mjs` for standalone MCP clients.

## Install from piwin Marketplace

Search **Knowledge & Flashcards** in piwin's Extension Marketplace (`https://extension.piwinwin.com/`), click **Install**, and enable it.

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```
