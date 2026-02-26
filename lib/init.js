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
    const lines = output.split('\n').slice(1);
    const models = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        const name = trimmed.split(/\s+/)[0];
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
    fs.writeFileSync(configPath, JSON.stringify({
      providers: { ollama: { model: 'llama3' } },
      activeProvider: 'ollama'
    }, null, 2));
  }
  return configPath;
}

/** Get available providers that user has configured */
function getConfiguredProviders(config) {
  return Object.keys(config.providers || {});
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

  // Load config
  const config = loadConfig();
  
  // If already configured, show current config
  if (config.activeProvider && config.providers?.[config.activeProvider]?.model) {
    console.log(chalk.green('\n✅ Already configured:'));
    console.log(chalk.gray(`   Provider: ${config.activeProvider}`));
    console.log(chalk.gray(`   Model: ${config.providers[config.activeProvider].model}\n`));
    
    const { reconfigure } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'reconfigure',
        message: 'Would you like to change your provider or model?',
        default: false
      }
    ]);
    
    if (!reconfigure) {
      return;
    }
  }

  // Ask if user wants to add more providers or just configure Ollama
  console.log(chalk.cyan('\n📦 Configuring providers...\n'));

  // Ensure providers object exists
  if (!config.providers) {
    config.providers = {};
  }
  
  // Ensure ollama is in providers
  if (!config.providers.ollama) {
    config.providers.ollama = { model: 'llama3' };
  }

  // Get Ollama models
  console.log(chalk.cyan('Fetching Ollama models...'));
  const ollamaModels = getOllamaModels();
  
  if (ollamaModels.length === 0) {
    console.log(chalk.yellow('⚠️  No Ollama models found. Please install one:'));
    console.log(chalk.gray('   ollama pull llama3\n'));
    process.exit(1);
  }

  // Configure Ollama model
  const { selectedModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedModel',
      message: 'Select Ollama model:',
      choices: ollamaModels,
      default: config.providers.ollama?.model || ollamaModels[0]
    }
  ]);

  config.providers.ollama = { model: selectedModel };
  config.activeProvider = 'ollama';
  
  // Remove old model key if it exists (legacy)
  delete config.model;

  // Save config
  saveConfig(config);

  console.log(chalk.green('\n✅ Configuration saved!'));
  console.log(chalk.gray(`   Provider: ${config.activeProvider}`));
  console.log(chalk.gray(`   Model: ${selectedModel}`));
  console.log(chalk.gray(`   Config: ~/.gait/gait.json\n`));
}

/** Quick init check - returns true if needs onboarding */
export function needsOnboarding() {
  if (!checkConfig()) return true;
  const config = loadConfig();
  return !config.activeProvider || !config.providers?.[config.activeProvider]?.model;
}
