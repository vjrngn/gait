import { generateText } from 'ai';

// Map provider names to AI SDK provider imports
const providerMap = {
  openai: () => import('openai'),
  anthropic: () => import('@anthropic-ai/sdk'),
  google: () => import('@google/generative-ai'),
  cohere: () => import('cohere'),
  mistral: () => import('@mistralai/mistralai'),
};

/**
 * Generate text using Vercel AI SDK for non-Ollama providers
 */
export async function generateWithAIProvider(provider, model, prompt) {
  const providerFn = providerMap[provider];
  
  if (!providerFn) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const providerModule = await providerFn();
  
  let modelInstance;
  
  switch (provider) {
    case 'openai':
      modelInstance = providerModule.default || providerModule;
      break;
    case 'anthropic':
      modelInstance = providerModule.default || providerModule;
      break;
    case 'google':
      modelInstance = providerModule.GoogleGenerativeAI;
      break;
    case 'cohere':
      modelInstance = providerModule.default || providerModule;
      break;
    case 'mistral':
      modelInstance = providerModule.default || providerModule;
      break;
    default:
      throw new Error(`Provider ${provider} not implemented`);
  }

  // Create model using AI SDK format
  const modelId = `${provider}/${model}`;
  
  const result = await generateText({
    model: modelId,
    prompt: prompt,
  });

  return result.text;
}

/**
 * Get list of available providers
 */
export function getAvailableProviders() {
  return Object.keys(providerMap);
}
