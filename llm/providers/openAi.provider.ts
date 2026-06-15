import OpenAI from 'openai';

import type { LLMProvider } from '../llm.interface';

export class OpenAIProvider implements LLMProvider {
	private readonly client: OpenAI;
	private readonly model: string;
	private readonly temperature: number;
	private readonly topP: number;
	private readonly seed: number | undefined;

	constructor(
		apiKey: string | undefined = process.env.OPENAI_API_KEY,
		model: string = process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
		temperature: number = parseNumberEnv(process.env.OPENAI_TEMPERATURE, 0),
		topP: number = parseNumberEnv(process.env.OPENAI_TOP_P, 1),
		seed: number | undefined = parseIntegerEnv(process.env.OPENAI_SEED)
	) {
		if (!apiKey) {
			throw new Error('OPENAI_API_KEY is not set.');
		}

		this.client = new OpenAI({ apiKey });
		this.model = model;
		this.temperature = temperature;
		this.topP = topP;
		this.seed = seed;
	}

	async generateResponse(prompt: string): Promise<string> {
		const response = await this.client.chat.completions.create({
			model: this.model,
			messages: [{ role: 'user', content: prompt }],
			temperature: this.temperature,
			top_p: this.topP,
			...(this.seed !== undefined ? { seed: this.seed } : {}),
		});

		const text = response.choices[0]?.message?.content?.trim();
		if (!text) {
			throw new Error('OpenAI returned an empty response.');
		}

		return text;
	}
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
	if (value === undefined) {
		return fallback;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntegerEnv(value: string | undefined): number | undefined {
	if (value === undefined) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isInteger(parsed) ? parsed : undefined;
}
