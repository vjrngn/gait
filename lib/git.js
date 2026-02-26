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

/**
 * Get all changed files (both staged and unstaged)
 * Returns array of objects: { path, status: 'staged' | 'unstaged' }
 */
export function getAllChangedFiles() {
  const files = [];
  
  // Get staged files
  const stagedOutput = sh('git diff --cached --name-status');
  if (stagedOutput) {
    stagedOutput.split('\n').forEach(line => {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        files.push({
          path: parts[1],
          status: 'staged'
        });
      }
    });
  }
  
  // Get unstaged files (modified but not staged)
  const unstagedOutput = sh('git diff --name-status');
  if (unstagedOutput) {
    unstagedOutput.split('\n').forEach(line => {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const path = parts[1];
        // Only add if not already in staged list
        if (!files.find(f => f.path === path)) {
          files.push({
            path: path,
            status: 'unstaged'
          });
        }
      }
    });
  }
  
  return files;
}

/**
 * Get list of unstaged files only
 */
export function getUnstagedFiles() {
  const files = [];
  const unstagedOutput = sh('git diff --name-status');
  if (unstagedOutput) {
    unstagedOutput.split('\n').forEach(line => {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        files.push(parts[1]);
      }
    });
  }
  return files;
}

/**
 * Stage specific files
 * @param {string[]} files - Array of file paths to stage
 */
export function stageFiles(files) {
  files.forEach(file => {
    sh(`git add "${file}"`);
  });
}
