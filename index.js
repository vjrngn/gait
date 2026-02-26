#!/usr/bin/env node
/**
 * Gait – Git Commit with AI (ESM)
 * -----------------------------------
 * Generates a git commit message from the staged diff using Ollama,
 * cleans up any "thinking" artefacts, lets you edit it, and commits the changes.
 */

import { execSync, spawnSync } from 'child_process';
import axios from 'axios';
import ora from 'ora';
import inquirer from 'inquirer';
import chalk from 'chalk';
import minimist from 'minimist';
import fs from 'fs';

const DEFAULT_MODEL = 'gpt-oss:20b';
const CONFIG_DIR = process.env.HOME + '/.gait';
const CONFIG_FILE = CONFIG_DIR + '/gait.json';

/** Helper – load config from file */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    // Ignore errors, use defaults
  }
  return { model: DEFAULT_MODEL };
}

/** Helper – save config to file */
function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error(chalk.yellow('⚠ Failed to save config'), e.message);
  }
}

/** Helper – shell command with error handling */
function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (e) {
    console.error(chalk.red(`✖ ${e.message}`));
    process.exit(1);
  }
}

/* Validate environment */
sh('git --version');
sh('git rev-parse --is-inside-work-tree');

/* Check for staged changes */
const staged = spawnSync('git', ['diff', '--cached', '--quiet']);
if (staged.status !== 0) {
  /* changes exist – proceed */
} else {
  // Show help when no staged changes
  console.log(chalk.yellow('No staged changes. Nothing to commit.\n'));
  console.log(`
${chalk.cyan('gait')} - AI-powered Git commit messages

${chalk.yellow('Usage:')}
  gait                    Run with staged changes
  gait -m <model>         Specify Ollama model
  gait -M <model>        Set default model
  gait -n                 Dry-run (preview only)
  gait -s                 Show staged files
  gait -l                 List available models
  gait -d                 Debug mode
  gait -h, --help         Show this help

${chalk.yellow('Config:')}
  Model stored in: ~/.gait/gait.json
  `);
  process.exit(0);
}

/* Parse CLI flags - must come early */
const argv = minimist(process.argv.slice(2), {
  string: ['m', 'model', 'list-models', 'l', 'set-model'],
  boolean: ['dry-run', 'n', 'debug', 'd', 'staged', 's', 'help', 'h'],
  alias: { 
    m: 'model',
    'dry-run': 'n',
    'debug': 'd',
    'staged': 's',
    'list-models': 'l',
    'set-model': 'M',
    'help': 'h'
  }
});

/* Show help */
if (argv.help || argv.h) {
  console.log(`
${chalk.cyan('gait')} - AI-powered Git commit messages

${chalk.yellow('Usage:')}
  gait                    Run with staged changes
  gait -m <model>         Specify Ollama model
  gait -M <model>        Set default model
  gait -n                 Dry-run (preview only)
  gait -s                 Show staged files
  gait -l                 List available models
  gait -d                 Debug mode
  gait -h, --help         Show this help

${chalk.yellow('Config:')}
  Model stored in: ~/.gait/gait.json
  
${chalk.yellow('Examples:')}
  gait                           # Normal usage
  gait -m llama3                 # Use specific model
  gait -M llama3                 # Set default model
  gait -n                        # Preview commit
  gait -s                        # Show staged files
  `);
  process.exit(0);
}

/* Load config */
const config = loadConfig();
const dryRun = argv['dry-run'] || argv.n || false;
const debug = argv.debug || argv.d || false;
const showStaged = argv.staged || argv.s || false;
const listModels = argv['list-models'] || argv.l || false;
const setModel = argv['set-model'] || argv.M || false;

/* Set default model */
if (setModel) {
  config.model = setModel;
  saveConfig(config);
  console.log(chalk.green(`✅ Default model set to: ${setModel}`));
  console.log(chalk.gray(`   Saved to ${CONFIG_FILE}`));
  process.exit(0);
}

/* List available models */
if (listModels) {
  console.log(chalk.cyan('\n📋 Available Ollama models:'));
  try {
    const models = sh('ollama list');
    console.log(chalk.gray(models));
    process.exit(0);
  } catch (e) {
    console.error(chalk.red('Failed to list models'), e.message);
    process.exit(1);
  }
}

/* Determine model to use: CLI arg > config > default */
const model = argv.model || config.model || DEFAULT_MODEL;
if (debug) {
  console.log(chalk.gray(`   Using model: ${model} (config: ${config.model || 'default'})`));
}

/* Grab the diff */
const diff = sh('git diff --cached');

/* Show staged files only if --staged or -s flag is passed */
if (showStaged) {
  const stagedFiles = sh('git diff --cached --name-status');
  console.log(chalk.cyan('\n📁 Staged files:'));
  console.log(chalk.gray(stagedFiles.split('\n').map(f => '  ' + f).join('\n')));
  console.log('');
}

/* Debug mode - show all flags */
if (debug) {
  console.log(chalk.gray('\n🔧 Debug mode - CLI flags:'));
  console.log(chalk.gray(JSON.stringify(argv, null, 2)));
  console.log('');
}

/* Build prompt - with type detection and body */
const prompt = `Analyze the following git diff and create a conventional commit message.

Instructions:
1. Determine the commit type: feat, fix, docs, style, refactor, test, chore, perf, ci, or build
2. If possible, detect a relevant scope (e.g., filename, component, or module name)
3. Write a concise subject (under 50 characters)
4. Add a body with bullet points (each line max 120 characters)
5. Add a footer for issue references (e.g., "Closes #123", "Refs #456")

Format:
type(scope): subject

- Bullet point 1 (max 120 chars per line)
- Bullet point 2 (max 120 chars per line)

Footer: Closes #123

Examples:
- feat(auth): add OAuth login

- Added Google OAuth 2.0 support with PKCE flow
- Token refresh handled automatically with secure storage

Closes #45

- fix(api): handle null response

- Added null check for API response data
- Returns empty array when no results found

Refs #78

Diff:\n${diff}`;

/* Ask Ollama (HTTP first, fallback to CLI) */
async function generateMessage() {
  const spinner = ora('Generating commit message…').start();

  // Try HTTP API – most reliable
  try {
    const res = await axios.post(
      'http://localhost:11434/api/generate',
      { model, prompt, stream: false },
      { timeout: 60000, responseType: 'json' }
    );
    spinner.succeed('Done');
    const raw = res.data.response?.trim() ?? '';
    // Keep full multi-line message (subject + body + footer)
    const lines = raw.split('\n').filter(l => l.trim());
    return lines.join('\n');
  } catch (_) {
    // Fallback to CLI
    const cli = spawnSync('ollama', ['run', model], {
      input: `${prompt}\n`,
      encoding: 'utf8',
      timeout: 60000
    });

    if (cli.error) {
      spinner.fail('Failed to communicate with Ollama');
      console.error(cli.error);
      process.exit(1);
    }
    spinner.succeed('Done');
    const raw = cli.stdout.trim();
    // Keep full multi-line message (subject + body + footer)
    const lines = raw.split('\n').filter(l => l.trim());
    return lines.join('\n');
  }
}

/* Main flow */
(async () => {
  const suggested = await generateMessage();

  console.log(chalk.green('\nSuggested commit message:'));
  console.log(`> ${suggested}\n`);

  let commitMsg = suggested;

  // Only prompt for edit if NOT in dry-run mode
  if (!dryRun) {
    const { finalMsg } = await inquirer.prompt([
      {
        type: 'input',
        name: 'finalMsg',
        message: 'Edit commit message (leave empty to accept):',
        default: suggested
      }
    ]);
    commitMsg = finalMsg.trim() || suggested;
  }

  // Dry-run mode: just show what would be committed
  if (dryRun) {
    console.log(chalk.cyan('\n🔍 Dry-run mode - no commit was made\n'));
    console.log(chalk.yellow('Would commit with message:'));
    console.log(`> ${commitMsg}\n`);
    console.log(chalk.gray('Use without --dry-run or -n to actually commit.'));
    process.exit(0);
  }

  // Commit - handle multi-line messages properly
  try {
    if (commitMsg.includes('\n')) {
      // Multi-line: use separate subject and body with -m flags
      const lines = commitMsg.split('\n');
      const subject = lines[0];
      const body = lines.slice(1).join('\n');
      sh(`git commit -m "${subject.replace(/"/g, '\\"')}" -m "${body.replace(/"/g, '\\"')}"`);
    } else {
      // Single line
      sh(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    }
    console.log(chalk.blue(`\n✅ Committed with message:\n${commitMsg}`));
  } catch (e) {
    console.error(chalk.red('\n❌ Commit failed'), e.message);
    process.exit(1);
  }
})();
