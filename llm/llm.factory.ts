import type { LLMProvider } from './llm.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenAIProvider } from './providers/openAi.provider';

export type LLMProviderType = 'gemini' | 'groq' | 'openai';

export function getLLMProvider(type: string): LLMProvider {
	const normalizedType = type.trim().toLowerCase();

	switch (normalizedType) {
		case 'gemini':
			return new GeminiProvider();
		case 'groq':
			return new GroqProvider();
		case 'openai':
			return new OpenAIProvider();
		default:
			throw new Error(
				`Unsupported LLM provider type: ${type}. Supported types are: gemini, groq, openai.`
			);
	}
}
