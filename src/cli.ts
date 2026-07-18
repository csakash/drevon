import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { syncCommand } from './commands/sync.js';
import { addAgentCommand } from './commands/add-agent.js';
import { removeAgentCommand } from './commands/remove-agent.js';
import { statusCommand } from './commands/status.js';
import { doctorCommand } from './commands/doctor.js';
import { skillCommand } from './commands/skill.js';
import { promptCommand } from './commands/prompt.js';
import { upgradeCommand } from './commands/upgrade.js';
import {
  memoryLog,
  memoryDecide,
  memoryLearn,
  memoryNote,
  memoryStatus,
  memoryMigrate,
} from './commands/memory.js';

const program = new Command();

program
  .name('drevon')
  .description('Turn any directory into a self-evolving AI workspace')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize drevon in current directory')
  .option('--hub', 'Force hub mode')
  .option('--project', 'Force project mode')
  .option('-y, --yes', 'Skip prompts, use defaults')
  .option('--agents <agents>', 'Comma-separated agent list')
  .option('--no-memory', 'Skip memory system')
  .option('--no-skills', 'Skip skills infrastructure')
  .option('--template <template>', 'Identity template (founder, developer, team, researcher)')
  .action(initCommand);

program
  .command('sync')
  .description('Regenerate all agent configs from drevon.config.json')
  .option('--no-migrate', 'Skip auto-migrating a legacy memory store to v2')
  .action((opts: { migrate?: boolean }) => syncCommand(opts));

program
  .command('add-agent <name>')
  .description('Add configuration for a new agent')
  .action(addAgentCommand);

program
  .command('remove-agent <name>')
  .description("Remove an agent's configuration files")
  .action(removeAgentCommand);

program
  .command('status')
  .description('Show workspace status')
  .action(statusCommand);

program
  .command('doctor')
  .description('Diagnose issues with the workspace')
  .action(doctorCommand);

const skill = program
  .command('skill')
  .description('Manage skills');

skill
  .command('add <source...>')
  .description('Install a skill from skills.sh')
  .option('--skill <name>', 'Skill name within the repository')
  .option('--verbose', 'Show full skills CLI output')
  .action((source: string[], opts: { skill?: string; verbose?: boolean }) => {
    if (opts.skill) source.push('--skill', opts.skill);
    skillCommand('add', undefined, source, { verbose: opts.verbose });
  });

skill
  .command('remove <name>')
  .description('Remove an installed skill')
  .action((name: string) => skillCommand('remove', name));

skill
  .command('list')
  .description('List installed skills')
  .action(() => skillCommand('list'));

skill
  .command('sync')
  .description('Re-inject skills into agent configs')
  .action(() => skillCommand('sync'));

const prompt = program
  .command('prompt')
  .description('Manage prompts');

prompt
  .command('list')
  .description('List all prompts')
  .action(() => promptCommand('list'));

prompt
  .command('create <name>')
  .description('Create a new prompt')
  .action((name: string) => promptCommand('create', name));

program
  .command('upgrade')
  .description('Upgrade config to latest version')
  .action(upgradeCommand);

const memory = program
  .command('memory')
  .description('Manage the workspace memory store');

memory
  .command('log <text>')
  .description('Append a dated entry to the action log')
  .action((text: string) => memoryLog(text));

memory
  .command('decide <title>')
  .description('Record a technical decision (one file per decision)')
  .option('--why <rationale>', 'Rationale for the decision')
  .action((title: string, opts: { why?: string }) => memoryDecide(title, opts));

memory
  .command('learn <text>')
  .description('Save a pattern/convention to a topic file')
  .option('--topic <name>', 'Topic file to append to (e.g. patterns, architecture)')
  .action((text: string, opts: { topic?: string }) => memoryLearn(text, opts));

memory
  .command('note <text>')
  .description('Update the current active-work focus in the index')
  .action((text: string) => memoryNote(text));

memory
  .command('status')
  .description('Show memory layout, eager budget, and per-tier token usage')
  .action(() => memoryStatus());

memory
  .command('migrate')
  .description('Port a legacy (v1) memory store to the v2 index + lazy layout')
  .option('--dry-run', 'Show the planned changes without writing')
  .action((opts: { dryRun?: boolean }) => memoryMigrate(opts));

program.parse();
