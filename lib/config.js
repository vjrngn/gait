import fs from 'fs';
import path from 'path';

const DEFAULT_MODEL = 'gpt-oss:20b';
const CONFIG_DIR = path.join(process.env.HOME, '.gait');
const CONFIG_FILE = path.join(CONFIG_DIR, 'gait.json');

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    // Ignore errors, use defaults
  }
  return { model: DEFAULT_MODEL };
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

export { CONFIG_FILE, DEFAULT_MODEL };
