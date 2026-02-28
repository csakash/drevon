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
  .action(syncCommand);

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
  .action((source: string[], opts: { skill?: string }) => {
    if (opts.skill) source.push('--skill', opts.skill);
    skillCommand('add', undefined, source);
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

program.parse();
