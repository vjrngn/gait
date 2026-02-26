import fs from 'fs';
import path from 'path';

const DEFAULT_MODEL = 'ollama/llama3';
const CONFIG_DIR = path.join(process.env.HOME, '.gait');
const CONFIG_FILE = path.join(CONFIG_DIR, 'gait.json');

export const DEFAULT_PROVIDERS = {
  ollama: {
    model: 'llama3'
  }
};

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    // Ignore errors, use defaults
  }
  return { 
    providers: DEFAULT_PROVIDERS,
    activeProvider: 'ollama'
  };
}

export function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    return e;
  }
}

export function getModelString(config) {
  const active = config.activeProvider || 'ollama';
  const provider = config.providers?.[active];
  if (!provider) {
    return DEFAULT_MODEL;
  }
  return `${active}/${provider.model}`;
}

export { CONFIG_FILE, DEFAULT_MODEL, CONFIG_DIR };
