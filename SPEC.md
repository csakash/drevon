# SPEC — Memory v2: index + lazy-load memory with compaction and migration

**Loop:** `memory-v2` · **Branch:** `feat/memory-v2` · **Repo:** `drevon` (SDK)
**Status:** ready to build

---

## 1. Problem

Drevon's memory system instructs every agent (via the compiled `CLAUDE.md` /
`AGENTS.md` / `copilot-instructions.md`) to **"Read all memory files at the start of
every session. Write to them after significant actions."** Combined with the store
shape — four monolithic, append-only, never-pruned files — this makes token cost scale
with project *age* instead of task *relevance*.

Measured in this workspace's own `.drevon/memory/`:

| File | Size | ~Tokens | Growth |
|------|------|---------|--------|
| `log.md` | 184 KB / 1,663 lines / 156 entries | ~46,000 | append-only, never pruned |
| `decisions.md` | 24 KB | ~6,000 | append-only |
| `patterns.md` | 16 KB | ~4,000 | grows |
| `context.md` | 13 KB | ~3,000 | grows |
| **Eager load per session** | **237 KB** | **~59,000** | unbounded ↑ |

Two hidden multipliers make the real cost worse than 59K:

1. **Re-read on write.** Appending to a 46K-token `log.md` requires reading it first;
   the protocol says write "after every significant action," so a single session
   re-reads the log many times → 250K+ tokens of memory I/O per session.
2. **Quality decay, not just cost.** Published research (Chroma "context rot";
   Anthropic "effective context engineering") shows model accuracy degrades
   monotonically with input length, with significant degradation by ~50K tokens —
   almost exactly Drevon's eager budget. The current design likely *lowers* answer
   quality, not just raises cost.

There is **no compaction/pruning/rotation logic anywhere** in `drevon/src` (verified by
grep). And existing users have live memory in the old layout, so any redesign must ship
a **safe, non-destructive migration path** or it will break their workspaces on upgrade.

### Industry alignment

Every mature memory system (Claude Code native, Codex memories, Letta/MemGPT, mem0,
Zep, gbrain, agentmemory) converges on: **bounded eager budget**, **index + lazy
load**, **cheap write path**, **background (never hot-path) compaction**, and
**non-destructive consolidation**. Drevon currently violates all five. Notably, two of
Drevon's three primary compile targets — Claude Code and Codex — *independently* adopted
the same "eager index file + on-demand detail files" pattern, so compiling to that shape
is also the most native fit.

## 2. Goals

- **G1.** Cut session-start eager memory load from ~59K tokens to a bounded budget
  (target ≤ ~2K tokens: a capped index only), with no loss of answer quality.
- **G2.** Make the write path cheap: appending a log entry / decision / learning must
  not require the agent to read a large file.
- **G3.** Bound growth over time via compaction — the store must not grow unboundedly.
- **G4.** Provide a **safe, non-destructive, idempotent migration** from the old
  four-file layout to v2, runnable on demand and offered automatically on `sync`/`upgrade`.
- **G5.** Preserve Drevon's identity: plain markdown, **no server, no database, no
  embeddings requirement**, works in non-git and hub/multi-project setups, compiles
  per-harness.
- **G6.** Behavior is measurable: `drevon status` reports the memory token budget
  before/after, so the token win is provable.

## 3. Non-goals

- No memory server, daemon, vector DB, or knowledge graph in this loop (explicitly
  rejected — that is the operational complexity Drevon's file-based simplicity beats;
  cf. agentmemory's 4 ports + 6 security advisories, gbrain's Postgres).
- No embeddings dependency. Search (Phase 2) is lexical (BM25) only.
- No changes to `drevon-app` (the Mac app) in this loop — it is a thin compiler that
  writes whatever the SDK's adapters emit. App wiring, if any, is a follow-up loop.
- No LLM API key requirement in the SDK. The "agentic" compaction tier runs inside the
  user's existing agent (via a shipped prompt/skill), not via an SDK-held key.
- Not touching skills/prompts/workspace subsystems except where they share plumbing.

## 4. Design

### 4.1 New store layout (`.drevon/memory/`)

```
.drevon/memory/
├── INDEX.md              # Tier 0 — the ONLY eagerly-read file. Hard cap ~150 lines / 8 KB.
│                         #   sections: project one-liner · active-work state ·
│                         #   pointers (one line each) to every topic file ·
│                         #   last-5 log headlines
├── topics/               # Tier 1 — read on demand (index points to them)
│   ├── architecture.md   #   project mode: from context.md
│   ├── patterns.md       #   living conventions reference
│   └── decisions/        #   one decision per file: YYYY-MM-DD-<slug>.md
├── log/                  # Tier 2 — episodic; NEVER eagerly read
│   ├── 2026-07.md        #   current month segment (append target)
│   ├── 2026-06.md        #   older segments
│   └── summaries.md      #   compacted digest of months older than the retention window
└── archive/              # non-destructive: pre-migration originals + evicted content
```

Hub mode maps its files analogously: `user.md` → `topics/user.md`, `projects.md` →
`topics/projects.md`, `systems.md` → `topics/systems.md`, plus `log/` and `INDEX.md`.

**INDEX.md** is generated/maintained by the SDK, not hand-written by the agent. It is the
single source of the eager budget. It always stays under the cap; when a section would
overflow (e.g. too many topic pointers, too many log headlines), the oldest/least-salient
entries roll off (log headlines) or collapse to a group pointer (topics).

### 4.2 New protocol (compiled into agent config)

`base.ts#getMemoryProtocol()` and `templates/partials/memory-protocol.hbs` are rewritten
from "read all files" to:

1. **Read `INDEX.md` at session start. Nothing else.**
2. Load a topic file **only when relevant** — the index's one-line pointers tell you which.
3. **Never open `log/` files to write.** Append via
   `drevon memory log "<entry>"` (and `decide` / `learn`). The SDK writes the segment and
   updates INDEX headlines.
4. For recall beyond the index, use `drevon memory search "<query>"` (Phase 2).

### 4.3 Write path (Phase 1 CLI)

New `drevon memory` command group (registered in `cli.ts`, implemented in
`src/commands/memory.ts` + `src/core/memory.ts`):

| Command | Effect |
|---|---|
| `drevon memory log "<text>"` | Append `### YYYY-MM-DD — <text>` to the current month's `log/<YYYY-MM>.md`; refresh INDEX "recent" headlines. Zero large-file reads. |
| `drevon memory decide "<title>" [--why ...]` | Create `topics/decisions/YYYY-MM-DD-<slug>.md`; add a pointer line to INDEX. |
| `drevon memory learn "<text>" [--topic patterns]` | Append to the named topic file; ensure INDEX pointer exists. |
| `drevon memory note "<text>"` | Update the active-work state block in INDEX (bounded, in place). |
| `drevon memory status` | Print store size, token estimate, per-tier breakdown, eager budget vs cap. |
| `drevon memory migrate` | Port old layout → v2 (§4.5). |
| `drevon memory compact` | Compaction (§4.4, Phase 2). |
| `drevon memory search "<q>"` | Lexical search (Phase 2). |

All writers are **append/patch only**, touch at most the current month's log segment or a
single small topic file, and re-derive the INDEX's bounded sections without reading Tier 2.

### 4.4 Compaction (Phase 2) — three escalating tiers, never on the hot path

- **Mechanical (no LLM, safe to run anytime, `drevon memory compact`):** rotate log into
  monthly segments; enforce the INDEX cap; apply retention scoring; move stale/low-value
  content to `archive/`; roll log months older than the retention window into
  `log/summaries.md` (headlines preserved, bodies archived). Non-destructive: raw content
  is moved to `archive/`, never deleted.
- **Retention scoring** (`src/core/retention.ts`): Ebbinghaus-style, adapted from
  agentmemory —
  `score = min(1, salience · e^(−λ·Δdays) + σ·Σ 1/daysSinceAccess)`, defaults `λ=0.01`,
  `σ=0.3`. Salience is type-weighted (architecture 0.9, decision 0.85, pattern 0.8,
  bug 0.7, workflow 0.6, log 0.5). Tiers: hot ≥0.7 / warm ≥0.4 / cold ≥0.15 / evictable
  <0.15. Only evictable content is archived, and only from Tier 2 / stale topics — decisions
  and architecture are never auto-evicted, only summarized.
- **Agentic "dream cycle" (uses the user's agent, not an SDK key):** a Drevon-shipped
  prompt/skill (`templates/prompts/memory-compact.md`) the agent can run at session end or
  on demand: merge duplicate learnings, resolve contradictions (non-destructive — supersede,
  don't delete), tighten topic files, and regenerate `log/summaries.md`. This is where LLM
  judgment applies; the SDK never calls an LLM itself.
- **Doctor integration:** `drevon doctor` warns when the store exceeds budget
  (e.g. "log is 46K tokens — run `drevon memory compact`") and when the INDEX approaches
  its cap.

### 4.5 Migration / porting path (Goal G4 — first-class)

Existing users have live memory in the old four-file layout at
`.drevon/memory/{context,decisions,patterns,log}.md` (project) or
`{user,projects,systems,log}.md` (hub), and `drevon.config.json` with `memory.files`
pointing at them and `version: 1`.

`drevon memory migrate` (and the same routine invoked by `sync`/`upgrade` when it detects
the old layout):

1. **Detect.** Old layout present if `memory.files` references top-level `*.md` and no
   `INDEX.md` exists. If already v2 (INDEX.md present), no-op.
2. **Back up.** Copy the entire current `.drevon/memory/` to
   `archive/pre-v2-<YYYY-MM-DD>/` before touching anything. Nothing is deleted.
3. **Transform (non-destructive):**
   - `context.md` → `topics/architecture.md` (hub: `user/projects/systems.md` →
     `topics/*.md`).
   - `patterns.md` → `topics/patterns.md`.
   - `decisions.md` → split on `### Decision:` / `###` headings into
     `topics/decisions/<date>-<slug>.md` (one file each; unparseable remainder kept whole
     as `topics/decisions/legacy.md`).
   - `log.md` → split by `### YYYY-MM-DD` headings into monthly `log/<YYYY-MM>.md`
     segments; months older than the retention window get headlines in
     `log/summaries.md` with bodies in `archive/`.
   - Generate `INDEX.md` from the above (project one-liner from config `name`, topic
     pointers, last-5 log headlines).
   - Preserve any `customFiles` as topics with pointers.
4. **Rewrite config.** Update `memory` block to the v2 shape; bump `drevon.config.json`
   `version` 1 → 2. Re-run compile so agent configs carry the new protocol.
5. **Idempotent & safe.** Re-running detects v2 and no-ops. Migration never deletes source
   content (only moves originals into `archive/`). A `--dry-run` prints the planned moves
   without writing. On any error, the archived backup is the recovery point; migrate reports
   the backup path.
6. **Auto-offer.** `sync` and `upgrade` detect the old layout and, in interactive runs,
   prompt "Old memory layout detected — migrate to v2? (recommended)"; in `--yes`/headless
   runs they migrate automatically and log it. A `--no-migrate` escape hatch is provided.

### 4.6 Config & types

- Extend `MemoryConfig` (`src/types.ts`): add `layout: 'v1' | 'v2'`, `indexFile: string`,
  `eagerBudgetTokens?: number` (default ~2000, the INDEX cap), and retention knobs
  (`retentionMonths?: number`, default 3). Keep `files`/`customFiles` for back-compat and
  for the migrator to read.
- Bump config `version` to 2; `upgrade` handles v1→v2 including the memory migration.
- Scaffolder/`initMemory` writes the v2 layout for new `drevon init`.

### 4.7 Per-harness compilation (respect native caps)

- **Claude Code:** emit the v2 protocol. (Optional, if cheap: a hooks stanza — SessionStart
  surfaces INDEX, PreCompact spills active-work state to memory, Stop nudges compaction.
  Hooks are a stretch item, not required for Phase 1/2 acceptance.)
- **Codex (`AGENTS.md`):** keep the emitted instruction chain well under Codex's **32 KiB
  hard cap** (content past it is silently truncated); `doctor` warns if exceeded.
- **Copilot:** no lazy layer exists — compile the INDEX-style guidance into
  `copilot-instructions.md`; topic scoping via `applyTo` globs is a stretch item.

### 4.8 Scale-adaptive (stretch within Phase 2)

Below a small total-store threshold (e.g. < 15 KB), eager-load-everything is genuinely
better (full-context beats retrieval at small scale — ConvoMem, LoCoMo baselines). The
compiler MAY emit the simpler "read all" protocol under the threshold and switch to
index+lazy above it, decided at `sync` time from on-disk size. Ship the mechanism if it's
low-risk; otherwise default to always-v2 (safe, and the win is largest where it matters).

## 5. Acceptance criteria

### Phase 1 — stop the bleeding
- [ ] `drevon init` scaffolds the v2 layout (INDEX.md + topics/ + log/ + archive/) in both
      hub and project modes.
- [ ] Compiled `CLAUDE.md`/`AGENTS.md`/`copilot-instructions.md` contain the v2 protocol
      ("read INDEX only; load topics on demand; append via CLI") and **no longer** say
      "read all memory files at the start of every session."
- [ ] `drevon memory log|decide|learn|note` work, are append/patch-only, and update INDEX
      without reading Tier 2 log segments.
- [ ] `drevon memory status` reports store size + token estimate + eager budget vs cap.
- [ ] `drevon memory migrate` converts this workspace's real `.drevon/memory/` to v2:
      non-destructive (originals under `archive/`), idempotent (second run no-ops),
      `--dry-run` supported, config bumped to v2.
- [ ] `sync`/`upgrade` detect the old layout and migrate (auto in headless, prompt in
      interactive), with `--no-migrate` escape hatch.
- [ ] Measured eager budget on the migrated store is ≤ ~2K tokens (INDEX only), down from
      ~59K. Reported by `drevon memory status`.
- [ ] `npm run build` clean; unit tests for writers, INDEX cap enforcement, and the
      migrator (incl. idempotency + non-destruction) pass.

### Phase 2 — compaction + retention + recall
- [ ] `drevon memory compact` performs mechanical compaction: log rotation, INDEX cap
      enforcement, retention-based archival, `log/summaries.md` generation —
      non-destructively.
- [ ] `src/core/retention.ts` implements the scoring formula with unit tests; decisions and
      architecture are never auto-evicted.
- [ ] `drevon doctor` warns when the store exceeds budget or INDEX nears its cap, and when
      the Codex chain exceeds 32 KiB.
- [ ] `drevon memory search "<q>"` returns ranked hits via lexical (BM25) search over
      topics + log, no embeddings, no network.
- [ ] A shipped `memory-compact` prompt/skill exists for the agentic dream-cycle tier.
- [ ] A small benchmark harness reports before/after token budget and a basic retrieval
      sanity check, so "least tokens, no quality loss" is demonstrable.
- [ ] `npm run build` clean; tests pass.

## 6. Risks & mitigations

- **Migration corrupts/loses a user's memory.** → Full backup to `archive/pre-v2-*` before
  any write; non-destructive moves only; `--dry-run`; idempotent detection; report the
  backup path. Tested against this workspace's real 184 KB `log.md`.
- **Heuristic splitting of `decisions.md`/`log.md` mis-parses odd formats.** → Unparseable
  remainder is preserved whole (`decisions/legacy.md`, log kept as a single dated segment);
  never dropped.
- **Agents keep reading old files out of habit / stale configs elsewhere.** → `sync`
  rewrites all agent configs; migrator leaves a short `topics/README` breadcrumb; old files
  are moved (not left in place) so a literal "read all *.md" would find nothing large.
- **Codex 32 KiB truncation silently drops instructions.** → `doctor` check + keep emitted
  chain small.
- **Scope creep into a server/DB.** → Explicit non-goal; Phase 2 search is lexical-only.

## 7. Out of scope / follow-ups

- `drevon-app` (Mac app) wiring and any hooks packaging → separate loop.
- Vector/semantic search, knowledge graph, cross-agent shared memory server.
- Published LongMemEval-style benchmark numbers (Phase 2 ships only a sanity harness).
- Copilot `applyTo` path-scoped topic compilation and Claude Code hooks stanza (stretch).

## 8. Decisions made during spec (autonomous; no interview)

This spec was written without the interactive `/spec` interview (non-interactive session).
Key decisions taken on the user's behalf, with rationale:

- **Files, not a server/DB** — preserves Drevon's "drop into any folder, even non-git"
  special power; every researched system that added infra traded that away.
- **Index + lazy load** — the pattern Claude Code and Codex both independently adopted;
  compiling to it is also the most native fit for two of three targets.
- **CLI write path** — the single highest-leverage fix (kills the re-read-to-append
  multiplier); makes writes ~free.
- **Non-destructive migration with full backup** — existing users' memory is irreplaceable;
  safety dominates elegance.
- **Lexical search, no embeddings (Phase 2)** — keeps the zero-dependency, offline,
  non-git-friendly promise.
