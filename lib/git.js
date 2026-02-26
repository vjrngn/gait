import { execSync, spawnSync } from 'child_process';

export function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (e) {
    throw new Error(e.message);
  }
}

export function checkGit() {
  sh('git --version');
  sh('git rev-parse --is-inside-work-tree');
}

export function hasStagedChanges() {
  const staged = spawnSync('git', ['diff', '--cached', '--quiet']);
  return staged.status !== 0;
}

export function getDiff() {
  return sh('git diff --cached');
}

export function getStagedFiles() {
  return sh('git diff --cached --name-status');
}

export function commit(message) {
  if (message.includes('\n')) {
    const lines = message.split('\n');
    const subject = lines[0];
    const body = lines.slice(1).join('\n');
    sh(`git commit -m "${subject.replace(/"/g, '\\"')}" -m "${body.replace(/"/g, '\\"')}"`);
  } else {
    sh(`git commit -m "${message.replace(/"/g, '\\"')}"`);
  }
}
