import axios from 'axios';
import { spawnSync, execSync } from 'child_process';

export async function generateCommitMessage(model, prompt) {
  // Try HTTP API first
  try {
    const res = await axios.post(
      'http://localhost:11434/api/generate',
      { model, prompt, stream: false },
      { timeout: 60000, responseType: 'json' }
    );
    const raw = res.data.response?.trim() ?? '';
    const lines = raw.split('\n').filter(l => l.trim());
    return lines.join('\n');
  } catch (_) {
    // Fallback to CLI
  }

  // CLI fallback
  const cli = spawnSync('ollama', ['run', model], {
    input: `${prompt}\n`,
    encoding: 'utf8',
    timeout: 60000
  });

  if (cli.error) {
    throw new Error('Failed to communicate with Ollama');
  }

  const raw = cli.stdout.trim();
  const lines = raw.split('\n').filter(l => l.trim());
  return lines.join('\n');
}

export function listModels() {
  return execSync('ollama list', { encoding: 'utf8' }).trim();
}
