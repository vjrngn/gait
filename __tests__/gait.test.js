#!/usr/bin/env node
/**
 * @file gait.test.js
 *
 * Small test that confirms the CLI can run and exit cleanly
 * when no staged changes are present.
 */

const child = require('child_process');
const path = require('path');

// Path to the CLI binary
const GIT_AI_CMD = path.resolve(__dirname, '..', 'bin', 'gait');

// Mock the shell commands that the CLI uses.

child.execSync = jest.fn(() => {
  throw new Error('git diff --cached --quiet should not be called directly');
});

child.execSync.mockImplementation((cmd) => {
  if (cmd.startsWith('git rev-parse')) return 'true\n';
  if (cmd.startsWith('git --version')) return 'git version 2.25.1\n';
  throw new Error(`Unexpected command: ${cmd}`);
});

child.execSync.mockImplementation((cmd) => {
  if (cmd.startsWith('git rev-parse') || cmd.startsWith('git --version')) {
    return 'true\n';
  }
  if (cmd.startsWith('git diff --cached')) {
    return 'diff --git a/file.txt b/file.txt\n';
  }
  throw new Error(`Unexpected command: ${cmd}`);
});

describe('gait CLI', () => {
  test('exits 0 when no staged changes are present', async () => {
    const result = child.spawnSync(GIT_AI_CMD, [], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No staged changes. Nothing to commit.');
  });
});
