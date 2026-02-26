#!/usr/bin/env node
/**
 * Gait – Git Commit with AI (ESM)
 * -----------------------------------
 * Generates a git commit message from the staged diff using Ollama,
 * cleans up any "thinking" artefacts, lets you edit it, and commits the changes.
 */

import minimist from 'minimist';
import ora from 'ora';
import inquirer from 'inquirer';
import chalk from 'chalk';

import { checkGit, hasStagedChanges, getDiff, getStagedFiles, commit } from './lib/git.js';
import { loadConfig, saveConfig, CONFIG_FILE, DEFAULT_MODEL } from './lib/config.js';
import { generateCommitMessage, listModels } from './lib/ollama.js';
import { buildPrompt } from './lib/prompt.js';

/* Show help text */
function showHelp() {
  console.log(`
${chalk.cyan('gait')} - AI-powered Git commit messages

${chalk.yellow('Usage:')}
  gait                    Run with staged changes
  gait -m <model>         Specify Ollama model
  gait -M <model>         Set default model
  gait -n                 Dry-run (preview only)
  gait -s                 Show staged files
  gait -l                 List available models
  gait -d                 Debug mode
  gait -h, --help         Show this help

${chalk.yellow('Config:')}
  Model stored in: ~/.gait/gait.json
  `);
}

/* Main flow */
(async () => {
  /* Parse CLI flags */
  const argv = minimist(process.argv.slice(2), {
    string: ['m', 'model', 'list-models', 'l', 'set-model'],
    boolean: ['dry-run', 'n', 'debug', 'd', 'staged', 's', 'help', 'h'],
    alias: { 
      m: 'model',
      'dry-run': 'n',
      debug: 'd',
      staged: 's',
      'list-models': 'l',
      'set-model': 'M',
      help: 'h'
    }
  });

  const dryRun = argv['dry-run'] || argv.n;
  const debug = argv.debug || argv.d;
  const showStaged = argv.staged || argv.s;
  const listModelsFlag = argv['list-models'] || argv.l;
  const setModel = argv['set-model'] || argv.M;

  /* Show help */
  if (argv.help || argv.h) {
    showHelp();
    process.exit(0);
  }

  /* Validate git environment */
  try {
    checkGit();
  } catch (e) {
    console.error(chalk.red(`✖ ${e.message}`));
    process.exit(1);
  }

  /* Check for staged changes */
  if (!hasStagedChanges()) {
    console.log(chalk.yellow('No staged changes. Nothing to commit.\n'));
    showHelp();
    process.exit(0);
  }

  /* Load config */
  const config = loadConfig();

  /* Set default model */
  if (setModel) {
    config.model = setModel;
    saveConfig(config);
    console.log(chalk.green(`✅ Default model set to: ${setModel}`));
    console.log(chalk.gray(`   Saved to ${CONFIG_FILE}`));
    process.exit(0);
  }

  /* List available models */
  if (listModelsFlag) {
    console.log(chalk.cyan('\n📋 Available Ollama models:'));
    try {
      console.log(chalk.gray(listModels()));
    } catch (e) {
      console.error(chalk.red('Failed to list models'), e.message);
    }
    process.exit(0);
  }

  /* Determine model to use */
  const model = argv.model || config.model || DEFAULT_MODEL;

  /* Debug mode */
  if (debug) {
    console.log(chalk.gray('\n🔧 Debug mode - CLI flags:'));
    console.log(chalk.gray(JSON.stringify(argv, null, 2)));
    console.log(chalk.gray(`   Using model: ${model}`));
  }

  /* Show staged files if requested */
  if (showStaged) {
    const stagedFiles = getStagedFiles();
    console.log(chalk.cyan('\n📁 Staged files:'));
    console.log(chalk.gray(stagedFiles.split('\n').map(f => '  ' + f).join('\n')));
    console.log('');
  }

  /* Generate commit message */
  const diff = getDiff();
  const prompt = buildPrompt(diff);
  
  const spinner = ora('Generating commit message…').start();
  const suggested = await generateCommitMessage(model, prompt);
  spinner.succeed('Done');

  console.log(chalk.green('\nSuggested commit message:'));
  console.log(`> ${suggested}\n`);

  let commitMsg = suggested;

  /* Get user input */
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

  /* Dry-run mode */
  if (dryRun) {
    console.log(chalk.cyan('\n🔍 Dry-run mode - no commit was made\n'));
    console.log(chalk.yellow('Would commit with message:'));
    console.log(`> ${commitMsg}\n`);
    console.log(chalk.gray('Use without --dry-run or -n to actually commit.'));
    process.exit(0);
  }

  /* Commit */
  try {
    commit(commitMsg);
    console.log(chalk.blue(`\n✅ Committed with message:\n${commitMsg}`));
  } catch (e) {
    console.error(chalk.red('\n❌ Commit failed'), e.message);
    process.exit(1);
  }
})();
