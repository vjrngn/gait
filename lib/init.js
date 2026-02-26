import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import ora from 'ora';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadConfig, saveConfig } from './config.js';

/** Check if config file exists */
function checkConfig() {
  const configPath = path.join(process.env.HOME, '.gait', 'gait.json');
  return fs.existsSync(configPath);
}

/** Check if Ollama is installed */
function checkOllamaInstalled() {
  try {
    execSync('ollama --version', { encoding: 'utf8' });
    return true;
  } catch (e) {
    return false;
  }
}

/** Check if Ollama is running */
function checkOllamaRunning() {
  try {
    execSync('curl -s http://localhost:11434/api/tags', { encoding: 'utf8' });
    return true;
  } catch (e) {
    return false;
  }
}

/** Get list of available Ollama models */
function getOllamaModels() {
  try {
    const output = execSync('ollama list', { encoding: 'utf8' });
    // Parse model names from output
    const lines = output.split('\n').slice(1); // Skip header
    const models = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        const name = trimmed.split(/\s+/)[0]; // First column is name
        if (name && !name.includes('=')) {
          models.push(name);
        }
      }
    }
    return models;
  } catch (e) {
    return [];
  }
}

/** Create empty config file */
function createEmptyConfig() {
  const configPath = path.join(process.env.HOME, '.gait', 'gait.json');
  const configDir = path.join(process.env.HOME, '.gait');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
  }
  return configPath;
}

/** Run onboarding flow */
export async function runOnboarding() {
  console.log(chalk.cyan('\n🚀 Welcome to Gait! Let\'s get you set up.\n'));

  // Create empty config file first
  const spinner = ora('Creating config file...').start();
  try {
    createEmptyConfig();
    spinner.succeed(chalk.green('✓ ') + 'Config file created');
  } catch (e) {
    spinner.fail(chalk.red('✗ ') + 'Failed to create config');
    console.log(chalk.red('\n⚠️  Could not create config file.\n'));
    process.exit(1);
  }

  const steps = [
    { 
      name: 'Checking Ollama installation', 
      check: () => checkOllamaInstalled(),
      message: 'Ollama is installed',
      error: 'Ollama not found'
    },
    { 
      name: 'Checking Ollama is running', 
      check: () => checkOllamaRunning(),
      message: 'Ollama is running',
      error: 'Ollama is not running'
    }
  ];

  let allPassed = true;

  // Run pre-init checks
  for (const step of steps) {
    const spinner = ora(step.name + '...').start();
    const result = step.check();
    
    if (result) {
      spinner.succeed(chalk.green('✓ ') + step.message);
    } else {
      spinner.fail(chalk.red('✗ ') + step.error);
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.log(chalk.red('\n⚠️  Please fix the issues above before continuing.\n'));
    process.exit(1);
  }

  // Check if already configured
  const config = loadConfig();
  if (config.model) {
    console.log(chalk.green('\n✅ Already configured with model: ') + config.model + '\n');
    return;
  }

  // Get models and prompt selection
  console.log(chalk.cyan('\n📋 Fetching available models...'));
  const models = getOllamaModels();
  
  if (models.length === 0) {
    console(chalk.yellow('⚠️  No models found. Please install some models first:'));
    console(chalk.gray('   ollama pull llama3\n'));
    process.exit(1);
  }

  console.log(chalk.cyan('\nSelect your preferred model:\n'));
  
  const { selectedModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedModel',
      choices: models,
      default: models[0]
    }
  ]);

  // Save config
  config.model = selectedModel;
  saveConfig(config);

  console.log(chalk.green('\n✅ Configuration saved!'));
  console.log(chalk.gray(`   Model: ${selectedModel}`));
  console.log(chalk.gray(`   Config: ~/.gait/gait.json\n`));
}

/** Quick init check - returns true if needs onboarding */
export function needsOnboarding() {
  return !checkConfig() || !loadConfig().model;
}
