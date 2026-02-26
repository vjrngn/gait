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

const DEFAULT_MODEL = 'gpt-oss:20b';

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
  console.log(chalk.yellow('No staged changes. Nothing to commit.'));
  process.exit(0);
}

/* Grab the diff */
const diff = sh('git diff --cached');

/* Parse CLI flags */
const argv = minimist(process.argv.slice(2), {
  string: ['m', 'model'],
  alias: { m: 'model' }
});
const model = argv.model || DEFAULT_MODEL;

/* Build prompt - with type detection */
const prompt = `Analyze the following git diff and create a conventional commit message.

Instructions:
1. Determine the commit type: feat, fix, docs, style, refactor, test, chore, perf, ci, or build
2. If possible, detect a relevant scope (e.g., filename, component, or module name)
3. Write a concise subject (under 50 characters)

Format: type(scope): subject

Examples:
- feat(auth): add OAuth login
- fix(api): handle null response
- docs(readme): update installation

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
    const cleaned = raw.split('\n').filter(l => l.trim()).shift() ?? '';
    return cleaned;
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
    const cleaned = raw.split('\n').filter(l => l.trim()).shift() ?? '';
    return cleaned;
  }
}

/* Main flow */
(async () => {
  const suggested = await generateMessage();

  console.log(chalk.green('\nSuggested commit message:'));
  console.log(`> ${suggested}\n`);

  const { finalMsg } = await inquirer.prompt([
    {
      type: 'input',
      name: 'finalMsg',
      message: 'Edit commit message (leave empty to accept):',
      default: suggested
    }
  ]);

  const commitMsg = finalMsg.trim() || suggested;

  // Commit
  try {
    sh(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    console.log(chalk.blue(`\n✅ Committed with message: ${commitMsg}`));
  } catch (e) {
    console.error(chalk.red('\n❌ Commit failed'), e.message);
    process.exit(1);
  }
})();
