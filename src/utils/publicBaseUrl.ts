import { createIsomorphicFn } from "@tanstack/react-start";
import { requestPublicBaseUrl } from "./publicBaseUrl.server";
import { displayHost } from "./publicBaseUrl.shared";

export { displayHost };

declare global {
  interface Window {
    __TI4_PUBLIC_BASE_URL__?: string;
  }
}

/**
 * The site's public base URL (no trailing slash), usable in components and
 * route head() on both server and client. The server reads `PUBLIC_BASE_URL`
 * at runtime (falling back to the request origin); the root document writes
 * that value into `window.__TI4_PUBLIC_BASE_URL__` so the client agrees with
 * the server-rendered HTML without a build-time variable.
 */
export const getPublicBaseUrl = createIsomorphicFn()
  .server(() => requestPublicBaseUrl())
  .client(() => window.__TI4_PUBLIC_BASE_URL__ ?? window.location.origin);

/** Inline script for the root document that hands the value to the client. */
export function publicBaseUrlScript(): string {
  const json = JSON.stringify(getPublicBaseUrl()).replace(/</g, "\\u003c");
  return `window.__TI4_PUBLIC_BASE_URL__=${json};`;
}
