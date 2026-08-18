# gemini-cli-integration — drevon CLI: Gemini adapter (companion)

Loop: `gemini-cli-integration` · branch `feat/gemini-cli-integration` · repo: drevon
Companion to the primary spec in the drevon-app worktree (`drevon-app/SPEC.md`). PRs target `dev`, cross-linked. Spec agreed 2026-08-18.

## Context

drevon-app is adding Gemini CLI as a fourth agent provider. The `drevon` CLI owns the per-agent config/skills sync layer (`drevon sync` regenerates each agent's memory file with the installed-skills table). Without a Gemini adapter here, skill toggles in the app never reach `GEMINI.md`, so a Gemini agent would not learn which skills it has.

## Current State (verified 2026-08-18)

- `src/types.ts:5` — `AgentId` union has copilot, claude, cursor, codex, windsurf, cline, aider, continue. No gemini.
- `src/adapters/registry.ts` — `ADAPTER_MAP` + `getAgentDisplayName` over that union.
- Existing adapters each declare an output path: claude → `CLAUDE.md`, codex → `AGENTS.md`, copilot → `.github/copilot-instructions.md` (`src/adapters/{claude,codex,copilot}.ts:11`), all extending `BaseAdapter` whose `writeSkillsTable` (`src/adapters/base.ts:71-105`) renders the installed-skills table from `skills-lock.json`.
- `src/schema/drevon-config.schema.json` `agents` enum drives `drevon add-agent`/`remove-agent` validation.
- `src/commands/skill.ts:76-84` maps agent ids to the `skills` CLI's `-a` targets (claude-code / codex / github-copilot).

## Change

1. `src/types.ts`: `AgentId` += `'gemini'`.
2. New `src/adapters/gemini.ts`: extend `BaseAdapter`; output path `GEMINI.md` at project root (Gemini CLI's native context file); same seed/merge behavior as the claude adapter.
3. `src/adapters/registry.ts`: `ADAPTER_MAP.gemini = GeminiAdapter`; `getAgentDisplayName('gemini') = 'Gemini CLI'`.
4. `src/schema/drevon-config.schema.json`: add `gemini` to the `agents` enum.
5. `src/commands/skill.ts` agent map: add gemini → the skills CLI's gemini target if `npx skills add -a gemini` is supported (verify at build time); otherwise omit the mapping so it falls back to universal (`.agents/skills/`, which Gemini CLI reads natively as a workspace-skills alias).
6. `drevon init`/`add-agent` help text lists gemini.

## Acceptance Criteria

1. `npm run build` clean; existing adapter tests green.
2. `drevon add-agent gemini` succeeds; `drevon sync` writes/updates `GEMINI.md` with the installed-skills table without touching other agents' files.
3. `drevon remove-agent gemini` cleans config without deleting user content in `GEMINI.md` beyond the managed table (match existing adapters' managed-block behavior).
4. New adapter unit test mirroring an existing adapter's test (output path, table render, idempotent re-sync).
5. Schema validation accepts `gemini` in `drevon.config.json` agents.

## Out of Scope

Everything in the drevon-app spec; Gemini extensions/custom-commands generation; MCP config.
