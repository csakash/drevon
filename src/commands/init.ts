import * as clack from '@clack/prompts';
import pc from 'picocolors';
import type { CLIOptions, InitOptions, AgentId } from '../types.js';
import { configExists } from '../core/config.js';
import { detectMode } from '../core/mode-detect.js';
import { scaffold } from '../core/scaffolder.js';
import { getProjectName } from '../utils/git.js';
import { colors } from '../utils/logger.js';
import {
  promptMode,
  promptName,
  promptIdentity,
  promptAgents,
  promptMemory,
  promptStarterPrompts,
  getPresetIdentity,
} from '../utils/prompts.js';

const BANNER = `
${colors.pink('      _')}
${colors.pink('     | |')}
${colors.rgb(253, 120, 118)('   __| |  ____  _____  _   _   ___   ____')}
${colors.orange('  / _  | / ___)| ___ || | | | / _ \\ |  _ \\')}
${colors.rgb(254, 184, 104)(' ( (_| || |    | ____| \\ V / | |_| || | | |')}
${colors.yellow('  \\____||_|    |_____)  \\_/   \\___/ |_| |_|')}

  ${pc.dim('GitHub')}  ${colors.peach('https://github.com/csakash/drevon')}
  ${pc.dim('Web')}     ${colors.peach('https://drevon.trysudosu.com')}
  ${pc.dim('Builder')} ${colors.peach('akash@trysudosu.com')} ${pc.dim('|')} ${colors.peach('@akashmunshi07')}
`;

export async function initCommand(options: CLIOptions): Promise<void> {
  console.log(BANNER);
  const cwd = process.cwd();

  // Check if already initialized
  if (configExists(cwd)) {
    if (!options.yes) {
      const overwrite = await clack.confirm({
        message: 'drevon.config.json already exists. Overwrite?',
        initialValue: false,
      });
      if (clack.isCancel(overwrite) || !overwrite) {
        clack.cancel('Aborted.');
        process.exit(0);
      }
    }
  }

  if (!options.yes) {
    clack.intro('drevon — AI Native Workspace');
  }

  // Determine mode
  let mode = options.hub ? 'hub' as const : options.project ? 'project' as const : undefined;
  if (!mode) {
    if (options.yes) {
      const { suggested } = detectMode(cwd);
      mode = suggested;
    } else {
      const { suggested, reason } = detectMode(cwd);
      mode = await promptMode(suggested, reason);
    }
  }

  // Get name
  const detectedName = getProjectName(cwd);
  const name = options.yes ? detectedName : await promptName(detectedName);

  // Get identity
  let identity;
  if (options.template) {
    identity = getPresetIdentity(options.template as any);
  } else if (options.yes) {
    identity = getPresetIdentity(mode === 'hub' ? 'founder' : 'developer');
  } else {
    const preset = await promptIdentity();
    identity = getPresetIdentity(preset);
  }

  // Get agents
  let agents: AgentId[];
  if (options.agents) {
    agents = options.agents.split(',').map((a) => a.trim()) as AgentId[];
  } else if (options.yes) {
    clack.log.error('Use --agents to specify which agents to enable with --yes. Example: drevon init --yes --agents copilot,claude');
    process.exit(1);
  } else {
    agents = await promptAgents();
  }

  // Memory
  const enableMemory = options.memory !== false && (options.yes || await promptMemory());

  // Prompts
  let includeStarterPrompts = false;
  if (options.yes) {
    includeStarterPrompts = true;
  } else {
    includeStarterPrompts = await promptStarterPrompts();
  }

  const initOpts: InitOptions = {
    mode,
    name,
    identity,
    agents,
    enableMemory,
    enableSkills: options.skills !== false,
    enablePrompts: true,
    includeStarterPrompts,
  };

  await scaffold(cwd, initOpts);

  if (!options.yes) {
    clack.outro('Done! Your AI workspace is ready.');
  }
}
