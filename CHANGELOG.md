# Changelog

All notable changes to the Drevon SDK are documented here.

## [0.2.0] — 2026-07-18

### Memory system v2 — index + lazy-load

Replaces the "read all memory files at the start of every session" model (which grew
unbounded and cost ~59K tokens per session on a real workspace) with an **index plus
lazily-loaded detail**. On that workspace the per-session eager load dropped from
**~59,000 tokens to ~260** (measured), with **no loss in answer quality** — agents still
retrieve and cite the exact right source, just on demand instead of up front.

**Added**
- New store layout under `.drevon/memory/`: `INDEX.md` (the only file read eagerly,
  budget-capped), `topics/` (read on demand, one file per decision under
  `topics/decisions/`), `log/<YYYY-MM>.md` (monthly episodic segments), and `archive/`.
- `drevon memory` command group:
  - `log`, `decide`, `learn`, `note` — append/patch-only writers that keep `INDEX.md` in
    sync without re-reading large files.
  - `status` — eager load vs budget and per-tier token usage.
  - `search` — BM25 lexical search over topics, log, and summaries (no embeddings, offline).
  - `compact` — roll log months past the retention window into `log/summaries.md` and
    archive their bodies (non-destructive); re-enforces the index budget.
  - `migrate` — port a legacy v1 store to v2 (non-destructive, idempotent, `--dry-run`).
- Retention scoring (`retention.ts`) — Ebbinghaus-style salience/recency scoring;
  architecture and decisions are never auto-evicted.
- `memory-compact` starter prompt (the agentic "dream cycle" consolidation pass).
- `drevon doctor` warnings for an over-budget index, a legacy layout, and an `AGENTS.md`
  exceeding Codex's 32 KiB truncation cap.
- `npm run bench` — a token-budget + retrieval benchmark.

**Changed**
- Config `version` bumped to `2`; `MemoryConfig` gains `layout`, `indexFile`,
  `eagerBudgetTokens`, and `retentionMonths`. `drevon init` scaffolds the v2 layout.
- The compiled memory protocol (in `CLAUDE.md` / `AGENTS.md` / `copilot-instructions.md`)
  now instructs agents to read `INDEX.md` only and load topics on demand.
- `drevon sync` and `drevon upgrade` auto-migrate a detected v1 store (pass `--no-migrate`
  to skip); the legacy duplicate `memory-protocol` config instruction is dropped.
- Documentation updated across the concept, reference, CLI, and guide pages.

**Migration**
- Existing workspaces: run `drevon memory migrate` (or just `drevon sync`). Originals are
  backed up under `.drevon/memory/archive/pre-v2-<date>/`; the operation is idempotent.
