/** Trims whitespace and trailing slashes; returns undefined for empty input. */
export function normalizeBaseUrl(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim().replace(/\/+$/, "");
  return trimmed || undefined;
}

/** "https://example.com/" -> "example.com", for display and image captions. */
export function displayHost(baseUrl: string): string {
  return baseUrl.replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "");
}
