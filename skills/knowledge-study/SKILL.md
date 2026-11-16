---
name: knowledge-study
description: Manage FSRS spaced-repetition flashcards, index local study folders with RAG, and render interactive Canvas flashcard review sessions on demand.
---

# Knowledge & Flashcards Plugin

Use the `knowledge` MCP server tools instead of writing ad-hoc scripts:
- `flashcard_due_queue` / `flashcard_list` — fetch cards due for review or inspect decks.
- `flashcard_create` — save basic or cloze (`{{c1::answer}}`) cards to `~/.piwin/flashcards`.
- `flashcard_rate` — record FSRS rating (`again`, `hard`, `good`, `easy`).
- `rag_scan_folder` / `rag_index_folder` / `rag_retrieve` — index and search local study folders.

When the user asks to study or review cards interactively, render a self-contained `artifact-html` (`surface="canvas"`, `style="host"`) flashcard deck showing one card at a time with Flip + rating summary, and call `flashcard_rate` as the user reports ratings.
