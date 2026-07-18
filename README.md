# drevon

> Turn any directory into a self-evolving AI workspace — memory, skills, and instructions for every coding agent.

[![npm](https://img.shields.io/npm/v/drevon)](https://www.npmjs.com/package/drevon)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quick Start

```bash
# Hub mode — multi-project workspace
mkdir my-workspace && cd my-workspace
npx drevon init

# Project mode — embed in existing codebase
cd my-existing-project
npx drevon init
```

One command. Every agent configured.

## What It Does

`drevon init` transforms any directory into an **AI-native workspace** by generating:

| What | Why |
|------|-----|
| Agent-specific instruction files | Every agent gets custom instructions automatically |
| Memory system (`.drevon/memory/`) | Persistent cross-session context — the agent remembers and evolves |
| Prompts (`.drevon/prompts/`) | Reusable workflows the agent can invoke or create |
| Skills (`.drevon/skills/`) | Pluggable capabilities from [skills.sh](https://skills.sh) |
| Config (`drevon.config.json`) | Single source of truth for all agents |

## Supported Agents

| Agent | Config File | Status |
|-------|-----------|--------|
| **GitHub Copilot** | `.github/copilot-instructions.md` | ✅ |
| **Claude Code** | `CLAUDE.md` | ✅ |
| **Cursor** | `.cursor/rules/*.mdc` | ✅ |
| **OpenAI Codex CLI** | `AGENTS.md` | ✅ |
| **Windsurf** | `.windsurfrules` | ✅ |
| **Cline** | `.clinerules` | ✅ |
| **Aider** | `.aider/instructions.md` | ✅ |
| **Continue.dev** | `.continue/rules/drevon.md` | ✅ |

## Two Modes

### Hub Mode (`--hub`)
For founders, researchers, and generalists working on many projects from one workspace.

```
my-workspace/
├── drevon.config.json
├── .drevon/
│   ├── memory/         ← cross-project memory
│   ├── skills/         ← shared skills
│   └── prompts/        ← reusable workflows
├── workspace/          ← project folders
├── .github/copilot-instructions.md
├── CLAUDE.md
└── AGENTS.md
```

### Project Mode (`--project`)
For developers and teams embedding AI capabilities into a codebase.

```
my-app/
├── src/                ← existing code (untouched)
├── drevon.config.json
├── .drevon/
│   ├── memory/         ← project-scoped memory
│   ├── skills/
│   └── prompts/
├── .github/copilot-instructions.md
├── CLAUDE.md
└── AGENTS.md
```

## Memory System

The memory system gives agents **persistent cross-session memory** — and in v2 it stays cheap
as it grows. Instead of reading every memory file at session start, the agent reads a small,
budget-capped **index** and loads detail files only when relevant.

```
.drevon/memory/
├── INDEX.md            ← the ONLY file read at session start (budget-capped, ~260 tokens)
├── topics/             ← read on demand: architecture.md, patterns.md, decisions/
├── log/<YYYY-MM>.md    ← episodic history, never read eagerly
└── archive/            ← compacted / migrated originals (non-destructive)
```

Agents read `INDEX.md`, load a topic only when needed, and **write via the CLI** so entries
stay cheap and the index stays in sync:

```
drevon memory log "…"      Append a dated log entry
drevon memory decide "…"   Record a decision (one file each)
drevon memory learn "…"    Save a pattern/convention to a topic
drevon memory note "…"     Set the current focus in the index
drevon memory search "…"   BM25 recall over all history (offline)
drevon memory compact      Roll old months into summaries (bounded growth)
drevon memory status       Eager load vs budget, per-tier tokens
drevon memory migrate      Port a legacy v1 store → v2 (non-destructive)
```

On a real workspace this cut the per-session eager load from **~59,000 tokens to ~260** (99.5%)
with **no loss in answer quality**. Upgrading? Run `drevon memory migrate` (it also runs
automatically on `drevon sync`).

## CLI Reference

```
drevon init              Initialize workspace (interactive)
drevon init --hub        Force hub mode
drevon init --project    Force project mode
drevon init -y           Skip prompts, use defaults

drevon sync              Regenerate all agent configs
drevon status            Show workspace status
drevon doctor            Diagnose issues

drevon add-agent <name>     Add an agent
drevon remove-agent <name>  Remove an agent

drevon skill add <owner/repo>  Install a skill
drevon skill remove <name>     Remove a skill
drevon skill list              List installed skills
drevon skill sync              Re-sync skills into agent configs

drevon prompt list          List available prompts
drevon prompt create <name> Create a new prompt

drevon memory log <text>       Append a dated log entry
drevon memory decide <title>   Record a decision (--why <rationale>)
drevon memory learn <text>     Save a pattern (--topic <name>)
drevon memory note <text>      Set the current focus
drevon memory status           Show eager load, budget, per-tier tokens
drevon memory search <query>   BM25 search over memory (--limit <n>)
drevon memory compact          Roll old log months into summaries
drevon memory migrate          Port a legacy v1 store to v2 (--dry-run)

drevon upgrade              Upgrade config version
```

## Configuration

All settings live in `drevon.config.json` — the single source of truth. Edit it, then run `drevon sync` to regenerate agent configs.

```jsonc
{
  "$schema": "https://drevon.dev/schema/v1.json",
  "version": 1,
  "mode": "hub",
  "name": "my-workspace",
  "identity": {
    "role": "founder-agent",
    "description": "High-autonomy AI assistant",
    "posture": "Take initiative. Move fast.",
    "capabilities": ["product", "engineering"]
  },
  "agents": {
    "copilot": { "enabled": true },
    "claude": { "enabled": true },
    "cursor": { "enabled": true }
  }
}
```

## Identity Presets

| Preset | Role | Best For |
|--------|------|----------|
| `founder` | High-autonomy agent | Startup founders, generalists |
| `developer` | Senior developer | Individual developers |
| `team` | Team lead | Engineering teams |
| `researcher` | Research assistant | Research, analysis |

## Skills Integration

Drevon integrates with the [skills.sh](https://skills.sh) ecosystem:

```bash
drevon skill add browser-use/browser-use
drevon skill add nicobailon/pdf
drevon skill sync
```

Skills are automatically injected into all agent instruction files.

## Requirements

- Node.js ≥ 18.0.0

## License

MIT
