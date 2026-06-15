import { GoogleGenAI } from '@google/genai';

import type { LLMProvider } from '../llm.interface';

export class GeminiProvider implements LLMProvider {
	private readonly client: GoogleGenAI;
	private readonly model: string;
	private readonly temperature: number;
	private readonly topP: number;
	private readonly seed: number | undefined;
	private readonly maxRetries: number;
	private readonly retryBaseDelayMs: number;

	constructor(
		apiKey: string | undefined = process.env.GEMINI_API_KEY,
		model: string = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
		temperature: number = parseNumberEnv(process.env.GEMINI_TEMPERATURE, 0),
		topP: number = parseNumberEnv(process.env.GEMINI_TOP_P, 1),
		seed: number | undefined = parseIntegerEnv(process.env.GEMINI_SEED),
		maxRetries: number = parseIntegerEnv(process.env.GEMINI_MAX_RETRIES) ?? 0,
		retryBaseDelayMs: number = parseIntegerEnv(process.env.GEMINI_RETRY_BASE_DELAY_MS) ?? 1000
	) {
		if (!apiKey) {
			throw new Error('GEMINI_API_KEY is not set.');
		}

		this.client = new GoogleGenAI({ apiKey });
		this.model = model;
		this.temperature = temperature;
		this.topP = topP;
		this.seed = seed;
		this.maxRetries = maxRetries;
		this.retryBaseDelayMs = retryBaseDelayMs;
	}

	async generateResponse(prompt: string): Promise<string> {
		let lastError: unknown;

		for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
			try {
				const response = await this.client.models.generateContent({
					model: this.model,
					contents: prompt,
					config: {
						temperature: this.temperature,
						topP: this.topP,
						...(this.seed !== undefined ? { seed: this.seed } : {}),
					},
				});

				const text = response.text?.trim();
				if (!text) {
					throw new Error('Gemini returned an empty response.');
				}

				return text;
			} catch (error) {
				lastError = error;

				if (!isTransientNetworkError(error) || attempt >= this.maxRetries) {
					break;
				}

				await delay(this.retryBaseDelayMs * (attempt + 1));
			}
		}

		throw new Error(buildGeminiErrorMessage(lastError, this.maxRetries + 1));
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildGeminiErrorMessage(error: unknown, attempts: number): string {
	const details = formatErrorDetails(error);
	const base = `Gemini request failed after ${attempts} attempt(s). ${details}`.trim();

	if (isTransientNetworkError(error)) {
		return `${base} Check internet/VPN/firewall and try again, or switch LLM_PROVIDER to groq/openai.`;
	}

	return base;
}

function formatErrorDetails(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

function isTransientNetworkError(error: unknown): boolean {
	const errorText = extractErrorText(error);

	return [
		'fetch failed',
		'und_err_connect_timeout',
		'connect timeout',
		'etimedout',
		'econnreset',
		'enotfound',
		'eai_again',
		'429',
		'503',
	].some((signal) => errorText.includes(signal));
}

function extractErrorText(error: unknown): string {
	if (error instanceof Error) {
		const causeMessage =
			typeof (error as { cause?: unknown }).cause === 'object' &&
			(error as { cause?: unknown }).cause !== null &&
			'message' in ((error as { cause?: unknown }).cause as object)
				? String(((error as { cause?: { message?: unknown } }).cause?.message ?? ''))
				: '';

		return `${error.message} ${causeMessage}`.toLowerCase();
	}

	return String(error).toLowerCase();
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
