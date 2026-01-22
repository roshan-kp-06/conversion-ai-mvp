/**
 * OpenAI Client Setup
 *
 * Provides a configured OpenAI client for AI-powered email generation.
 * Uses GPT-4 for high-quality personalized cold emails.
 */

import OpenAI from 'openai';

// Validate API key exists
if (!process.env.OPENAI_API_KEY) {
  console.warn('[OpenAI] Warning: OPENAI_API_KEY not set. AI features will fail.');
}

// Create and export OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Default model configuration
export const DEFAULT_MODEL = 'gpt-4-turbo-preview';
export const FALLBACK_MODEL = 'gpt-3.5-turbo';

// Temperature settings for different use cases
export const TEMPERATURE = {
  CREATIVE: 0.8,    // For more varied, creative outputs
  BALANCED: 0.7,    // Default for emails - professional but engaging
  PRECISE: 0.3,     // For factual, consistent outputs
};

// Max tokens for different content types
export const MAX_TOKENS = {
  EMAIL_SUBJECT: 100,
  EMAIL_BODY: 1000,
  FULL_EMAIL: 1200,
};

/**
 * Detect if the API key is a placeholder/example value
 */
function isPlaceholderKey(key: string | undefined): boolean {
  if (!key) return true;
  // Common placeholder patterns
  if (key.includes('your-') || key.includes('your_')) return true;
  if (key.includes('placeholder') || key.includes('example')) return true;
  if (key.startsWith('sk_test') || key.startsWith('test_')) return true;
  if (key.includes('xxx') || key.includes('XXX')) return true;
  // Too short to be a real key (OpenAI keys are ~50 chars)
  if (key.length < 40) return true;
  return false;
}

/**
 * Check if OpenAI is properly configured
 */
export function isOpenAIConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && !isPlaceholderKey(key);
}

/**
 * Simple chat completion wrapper with error handling
 */
export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    temperature = TEMPERATURE.BALANCED,
    maxTokens = MAX_TOKENS.FULL_EMAIL,
  } = options;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    return content.trim();
  } catch (error) {
    // If GPT-4 fails, try fallback model
    if (model === DEFAULT_MODEL && error instanceof Error) {
      console.warn(`[OpenAI] ${DEFAULT_MODEL} failed, trying ${FALLBACK_MODEL}:`, error.message);
      return chatCompletion(systemPrompt, userPrompt, {
        ...options,
        model: FALLBACK_MODEL,
      });
    }
    throw error;
  }
}
