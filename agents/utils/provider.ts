export const getProviderOrder = (primaryProvider: string): string[] => {
  const fallbackProviders = (process.env.LLM_FALLBACK_PROVIDERS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return dedupeProviders([primaryProvider.trim().toLowerCase(), ...fallbackProviders]);
}

export const dedupeProviders = (providers: string[]): string[] => {
  return [...new Set(providers)];
}

export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
