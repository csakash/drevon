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

The memory system gives agents **persistent cross-session memory** — the engine behind self-evolution.

**Hub mode** memory files: `user.md`, `projects.md`, `systems.md`, `log.md`
**Project mode** memory files: `context.md`, `decisions.md`, `patterns.md`, `log.md`

Agents are instructed to:
1. Read all memory files at session start
2. Write back after significant actions
3. Create reusable prompts for repeated workflows

This creates an **emergent self-improvement loop** across sessions.

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
