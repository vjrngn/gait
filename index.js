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

import { checkGit, hasStagedChanges, getDiff, getStagedFiles, commit, getAllChangedFiles, stageFiles } from './lib/git.js';
import { loadConfig, saveConfig, CONFIG_FILE, getModelString } from './lib/config.js';
import { generateCommitMessage as generateOllama, listModels } from './lib/ollama.js';
import { generateWithAIProvider } from './lib/ai.js';
import { buildPrompt } from './lib/prompt.js';
import { runOnboarding, needsOnboarding } from './lib/init.js';

/* Show help text */
function showHelp() {
  console.log(`
${chalk.cyan('gait')} - AI-powered Git commit messages

${chalk.yellow('Usage:')}
  gait                    Run with staged changes
  gait commit             Explicit commit command (same as gait)
  gait init               Initialize/setup
  gait -f, --files       Interactive file selection (staged + unstaged)
  gait -m <model>        Specify model (provider/model format)
  gait -M <model>        Set default model
  gait -n                Dry-run (preview only)
  gait -s                Show staged files
  gait -l                List available models
  gait -d                Debug mode
  gait -h, --help        Show this help

${chalk.yellow('Config:')}
  Config stored in: ~/.gait/gait.json
  
${chalk.yellow('Model Format:')}
  Use provider/model format: openai/gpt-4o, anthropic/claude-sonnet-4.5, ollama/llama3
  `);
}

/* Main flow */
(async () => {
  /* Get raw args to check for subcommands */
  const rawArgs = process.argv.slice(2);
  const subcommand = rawArgs[0];
  
  /* Handle subcommands */
  if (subcommand === 'commit') {
    // Explicit commit command - run commit flow directly
    const commitArgs = minimist(rawArgs.slice(1), {
      string: ['m', 'model'],
      boolean: ['dry-run', 'n', 'debug', 'd', 'help', 'h', 'interactive', 'f'],
      alias: { 
        m: 'model',
        'dry-run': 'n',
        debug: 'd',
        help: 'h',
        interactive: 'f',
        files: 'f'
      }
    });
    
    if (commitArgs.help || commitArgs.h) {
      console.log(`
${chalk.cyan('gait commit')} - Explicit commit command

${chalk.yellow('Usage:')}
  gait commit                 Commit with staged changes
  gait commit -f             Interactive file selection
  gait commit -n             Dry-run (preview only)
  gait commit -m <model>    Specify model

${chalk.yellow('Flags:')}
  -f, --files       Interactive file selection (staged + unstaged)
  -n, --dry-run    Preview only, don't commit
  -d, --debug      Show debug info
  -m, --model      Specify AI model
      `);
      process.exit(0);
    }
    
    // Handle interactive file selection for commit subcommand
    const interactiveSelect = commitArgs.interactive || commitArgs.files || commitArgs.f;
    
    if (interactiveSelect) {
      const allFiles = getAllChangedFiles();
      
      if (allFiles.length === 0) {
        console.log(chalk.yellow('No changed files found.\n'));
        process.exit(0);
      }

      const choices = allFiles.map(f => ({
        name: `${f.path}`,
        value: f.path,
        checked: f.status === 'staged'
      }));

      const { selectedFiles } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedFiles',
          message: 'Select files to include in commit:',
          choices: choices,
          pageSize: 999
        }
      ]);

      if (selectedFiles.length === 0) {
        console.log(chalk.yellow('No files selected. Aborting.\n'));
        process.exit(0);
      }

      const filesToStage = selectedFiles.filter(path => {
        const file = allFiles.find(f => f.path === path);
        return file && file.status === 'unstaged';
      });

      if (filesToStage.length > 0) {
        console.log(chalk.cyan(`\n📦 Staging ${filesToStage.length} file(s)...`));
        stageFiles(filesToStage);
      }

      console.log(chalk.green(`\n✅ Selected ${selectedFiles.length} file(s) for commit\n`));
    }
    
    // Continue with commit flow - no need to check for staged changes
    const config = loadConfig();
    const dryRun = commitArgs['dry-run'] || commitArgs.n;
    const debug = commitArgs.debug || commitArgs.d;
    const modelArg = commitArgs.model || commitArgs.m;
    
    // Handle model override
    if (modelArg) {
      const [provider, model] = modelArg.split('/');
      if (!provider || !model) {
        console.error(chalk.red('✖ Model must be in provider/model format (e.g., ollama/llama3)'));
        process.exit(1);
      }
      config.activeProvider = provider;
      if (!config.providers) config.providers = {};
      config.providers[provider] = { model };
    }
    
    const provider = config.activeProvider || 'ollama';
    const providerConfig = config.providers?.[provider] || { model: 'llama3' };
    
    if (debug) {
      console.log(chalk.gray('\n🔧 Debug mode:'));
      console.log(chalk.gray(`   Provider: ${provider}`));
      console.log(chalk.gray(`   Model: ${providerConfig.model}`));
    }

    const diff = getDiff();
    const prompt = buildPrompt(diff);
    
    const spinner = ora('Generating commit message…').start();
    
    let suggested;
    try {
      if (provider === 'ollama') {
        suggested = await generateOllama(providerConfig.model, prompt);
      } else {
        suggested = await generateWithAIProvider(provider, providerConfig.model, prompt);
      }
      spinner.succeed('Done');
    } catch (e) {
      spinner.fail('Failed to generate message');
      console.error(chalk.red(e.message));
      process.exit(1);
    }

    console.log(chalk.green('\nSuggested commit message:'));
    console.log(`> ${suggested}\n`);

    let commitMsg = suggested;

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

    if (dryRun) {
      console.log(chalk.cyan('\n🔍 Dry-run mode - no commit was made\n'));
      console.log(chalk.yellow('Would commit with message:'));
      console.log(`> ${commitMsg}\n`);
      process.exit(0);
    }

    try {
      commit(commitMsg);
      console.log(chalk.blue(`\n✅ Committed with message:\n${commitMsg}`));
    } catch (e) {
      console.error(chalk.red('\n❌ Commit failed'), e.message);
      process.exit(1);
    }
    
    process.exit(0);
  }

  /* Parse CLI flags */
  const argv = minimist(rawArgs, {
    string: ['m', 'model', 'list-models', 'l', 'set-model'],
    boolean: ['dry-run', 'n', 'debug', 'd', 'staged', 's', 'help', 'h', 'init', 'i', 'interactive', 'f'],
    alias: { 
      m: 'model',
      'dry-run': 'n',
      debug: 'd',
      staged: 's',
      'list-models': 'l',
      'set-model': 'M',
      help: 'h',
      init: 'i',
      interactive: 'f',
      files: 'f'
    }
  });

  const init = argv.init || argv.i;
  const interactiveSelect = argv.interactive || argv.files || argv.f;
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

  /* Run onboarding if needed */
  if (init || needsOnboarding()) {
    await runOnboarding();
    if (init) {
      process.exit(0);
    }
  }

  /* Validate git environment */
  try {
    checkGit();
  } catch (e) {
    console.error(chalk.red(`✖ ${e.message}`));
    process.exit(1);
  }

  /* Check for staged changes (unless in interactive mode) */
  if (!interactiveSelect && !hasStagedChanges()) {
    console.log(chalk.yellow('No staged changes. Nothing to commit.\n'));
    showHelp();
    process.exit(0);
  }

  /* Interactive file selection */
  if (interactiveSelect) {
    const allFiles = getAllChangedFiles();
    
    if (allFiles.length === 0) {
      console.log(chalk.yellow('No changed files found.\n'));
      process.exit(0);
    }

    // Build choices for inquirer checkbox
    const choices = allFiles.map(f => ({
      name: `${f.path}`,
      value: f.path,
      checked: f.status === 'staged' // Pre-check already staged files
    }));

    const { selectedFiles } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedFiles',
        message: 'Select files to include in commit:',
        choices: choices,
        pageSize: 999
      }
    ]);

    if (selectedFiles.length === 0) {
      console.log(chalk.yellow('No files selected. Aborting.\n'));
      process.exit(0);
    }

    // Stage any newly selected files that were previously unstaged
    const filesToStage = selectedFiles.filter(path => {
      const file = allFiles.find(f => f.path === path);
      return file && file.status === 'unstaged';
    });

    if (filesToStage.length > 0) {
      console.log(chalk.cyan(`\n📦 Staging ${filesToStage.length} file(s)...`));
      stageFiles(filesToStage);
    }

    console.log(chalk.green(`\n✅ Selected ${selectedFiles.length} file(s) for commit\n`));
  }

  /* Load config */
  const config = loadConfig();

  /* Set default model */
  if (setModel) {
    const [provider, model] = setModel.split('/');
    if (!provider || !model) {
      console.error(chalk.red('✖ Model must be in provider/model format (e.g., ollama/llama3)'));
      process.exit(1);
    }
    config.activeProvider = provider;
    if (!config.providers) config.providers = {};
    config.providers[provider] = { model };
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

  /* Determine provider and model */
  const provider = config.activeProvider || 'ollama';
  const providerConfig = config.providers?.[provider] || { model: 'llama3' };
  const modelString = getModelString(config);

  /* Debug mode */
  if (debug) {
    console.log(chalk.gray('\n🔧 Debug mode:'));
    console.log(chalk.gray(`   Provider: ${provider}`));
    console.log(chalk.gray(`   Model: ${providerConfig.model}`));
    console.log(chalk.gray(`   Full: ${modelString}`));
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
  
  let suggested;
  try {
    if (provider === 'ollama') {
      suggested = await generateOllama(providerConfig.model, prompt);
    } else {
      suggested = await generateWithAIProvider(provider, providerConfig.model, prompt);
    }
    spinner.succeed('Done');
  } catch (e) {
    spinner.fail('Failed to generate message');
    console.error(chalk.red(e.message));
    process.exit(1);
  }

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
