import { getRequest } from "@tanstack/react-start/server";
import { normalizeBaseUrl } from "./publicBaseUrl.shared";

/**
 * The public address of this site, from `PUBLIC_BASE_URL`. When it is unset we
 * fall back to localhost, which is only right for local development.
 * Used where there is no browser request (Discord bot, generated images).
 */
export function configuredPublicBaseUrl(): string {
  const configured = normalizeBaseUrl(process.env.PUBLIC_BASE_URL);
  if (configured) return configured;
  return `http://localhost:${Number(process.env.PORT) || 3000}`;
}

/**
 * Like configuredPublicBaseUrl, but when `PUBLIC_BASE_URL` is unset and we are
 * inside a request, use that request's origin so links follow the visited host.
 */
export function requestPublicBaseUrl(): string {
  const configured = normalizeBaseUrl(process.env.PUBLIC_BASE_URL);
  if (configured) return configured;
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return configuredPublicBaseUrl();
  }
}
