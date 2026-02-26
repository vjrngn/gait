export function buildPrompt(diff) {
  return `Analyze the following git diff and create a conventional commit message.

Instructions:
1. Determine the commit type: feat, fix, docs, style, refactor, test, chore, perf, ci, or build
2. If possible, detect a relevant scope (e.g., filename, component, or module name)
3. Write a concise subject (under 50 characters)
4. Add a body with bullet points (each line max 120 characters)
5. Add a footer for issue references (e.g., "Closes #123", "Refs #456")

Format:
type(scope): subject

- Bullet point 1 (max 120 chars per line)
- Bullet point 2 (max 120 chars per line)

Footer: Closes #123

Examples:
- feat(auth): add OAuth login

- Added Google OAuth 2.0 support with PKCE flow
- Token refresh handled automatically with secure storage

Closes #45

- fix(api): handle null response

- Added null check for API response data
- Returns empty array when no results found

Refs #78

Diff:\n${diff}`;
}
