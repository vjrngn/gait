# @vjrngn/gait

AI-powered git commit message generator. Uses [Ollama](https://ollama.com/) or other AI providers to automatically generate meaningful commit messages from your staged changes.

![npm](https://img.shields.io/npm/v/@vjrngn/gait)
![License: MIT](https://img.shields.io/npm/l/@vjrngn/gait)
![Node.js](https://img.shields.io/node/v/@vjrngn/gait)

## Features

- 🤖 **AI-Powered** - Generate commit messages using local or cloud AI models
- 🔒 **Privacy-First** - Uses Ollama for local processing (your code never leaves your machine)
- 🌐 **Multi-Provider Support** - Ollama, OpenAI, Anthropic, Google, Cohere, Mistral
- 🎯 **Conventional Commits** - Generates messages following the Conventional Commits specification
- ⚡ **Fast** - Simple CLI interface
- 💾 **Configurable** - Custom model selection and provider configuration

## Installation

```bash
# Install globally
npm install -g @vjrngn/gait

# Or use npx without installing
npx @vjrngn/gait
```

## Prerequisites

### For Ollama (Default - Local)

1. Install [Ollama](https://ollama.com/)
2. Pull a model:
   ```bash
   ollama pull llama3
   ollama pull codellama
   ollama pull mistral
   ```

### For Cloud Providers

If using OpenAI, Anthropic, or other cloud providers, set their API keys:

```bash
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
# etc.
```

## Usage

```bash
# Stage your changes first
git add .

# Run gait to generate a commit message
gait

# Or use the full command
git-commit-ai
```

### Options

```bash
gait                    # Generate commit message for staged changes
gait --all              # Use all changes (not just staged)
gait --model <name>     # Specify a different model
gait --provider <name> # Switch between ollama/openai/anthropic/etc.
gait --config           # Open configuration
gait --list-models      # List available Ollama models
```

## Configuration

Gait stores config in `~/.gait/gait.json`. You can configure:

- **Default provider** - Which AI provider to use
- **Model** - Which model to use per provider
- **Custom prompts** - Modify how commit messages are generated

### Example Configuration

```json
{
  "providers": {
    "ollama": {
      "model": "llama3"
    },
    "openai": {
      "model": "gpt-4"
    }
  },
  "activeProvider": "ollama"
}
```

## Supported Providers

| Provider | Setup Required |
|----------|---------------|
| [Ollama](https://ollama.com/) | Install Ollama, pull model |
| [OpenAI](https://openai.com/) | Set `OPENAI_API_KEY` |
| [Anthropic](https://anthropic.com/) | Set `ANTHROPIC_API_KEY` |
| [Google Gemini](https://gemini.google.com/) | Set `GOOGLE_API_KEY` |
| [Cohere](https://cohere.com/) | Set `COHERE_API_KEY` |
| [Mistral](https://mistral.ai/) | Set `MISTRAL_API_KEY` |

## Development

```bash
# Clone the repo
git clone https://github.com/vjrngn/gait.git
cd gait

# Install dependencies
npm install

# Run tests
npm test

# Link for local development
npm link
```

## Publishing

```bash
# Create a git release (patch version)
npm run release

# Create a git release (minor version)
npm run release:minor

# Create a git release (major version)
npm run release:major

# Publish to npm
npm run publish
```

## How It Works

1. **Git Diff** - Gait runs `git diff --staged` to get your staged changes
2. **Prompt Engineering** - The diff is sent to your configured AI provider with a prompt asking for a conventional commit message
3. **Message Generation** - AI generates a commit message following the format: `type(scope): description`
4. **Confirmation** - You can edit or accept the generated message before committing

## License

MIT

## Author

[OpenClaw](https://github.com/vjrngn)
