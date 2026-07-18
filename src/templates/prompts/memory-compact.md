---
title: Memory Compaction (Dream Cycle)
description: Consolidate and tidy the workspace memory store non-destructively
author: drevon
tags: [memory, compaction, maintenance]
---

# Memory Compaction — the "dream cycle"

Run this periodically (a natural time is at the end of a working session) to keep the
memory store small, accurate, and fast. This is the agentic tier of compaction: it uses
your judgment where the mechanical `drevon memory compact` cannot. **Never delete
information — supersede, merge, or archive it.**

## 0. Mechanical pass first
Run `drevon memory compact`. It rolls old log months into `log/summaries.md` (bodies to
`archive/`) and re-enforces the index budget. Then continue below.

## 1. Deduplicate learnings
- Read `topics/patterns.md` (and other topic files). Merge entries that say the same thing.
- Keep the clearest phrasing; delete exact duplicates (the originals remain in git history).

## 2. Resolve contradictions (non-destructively)
- If two notes conflict, keep the newer/correct one and mark the older as superseded
  rather than silently deleting it — e.g. append `(superseded YYYY-MM-DD: see …)`.
- For decisions, prefer adding a new decision file that references and overrides the old one.

## 3. Tighten topic files
- Trim stale or speculative content. A topic file should read like a living reference,
  not a diary. Move anything purely historical into the log.

## 4. Refresh the index
- Check `INDEX.md`: is the **Project** one-liner still accurate? Is **Active Work** current?
- Ensure every topic file has a one-line pointer, and that pointers describe what's inside.
- Keep the index well under its token budget (`drevon memory status` shows the number).

## 5. Verify
- Run `drevon memory status` — the eager load should be small and the layout `v2`.
- Run `drevon doctor` — resolve any memory warnings it surfaces.

Goal: a newcomer session reading only `INDEX.md` should understand the project's state,
and be able to find any detail with one `drevon memory search` or one topic-file read.
