import Groq from 'groq-sdk';

import type { LLMProvider } from '../llm.interface';

export class GroqProvider implements LLMProvider {
	private readonly client: Groq;
	private readonly model: string;
	private readonly temperature: number;
	private readonly topP: number;
	private readonly seed: number | undefined;

	constructor(
		apiKey: string | undefined = process.env.GROQ_API_KEY,
		model: string = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
		temperature: number = parseNumberEnv(process.env.GROQ_TEMPERATURE, 0),
		topP: number = parseNumberEnv(process.env.GROQ_TOP_P, 1),
		seed: number | undefined = parseIntegerEnv(process.env.GROQ_SEED)
	) {
		if (!apiKey) {
			throw new Error('GROQ_API_KEY is not set.');
		}

		this.client = new Groq({ apiKey });
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
			throw new Error('Groq returned an empty response.');
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
