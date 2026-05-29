const DEFAULT_API_URL = "http://localhost:8080";
const API_PORT = "8080";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalApiUrl(value: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

function formatHostForUrl(hostname: string): string {
  return hostname.includes(":") ? `[${hostname}]` : hostname;
}

export function getApiUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;

  if (typeof window === "undefined" || LOCAL_HOSTS.has(window.location.hostname)) {
    return configuredUrl;
  }

  if (!process.env.NEXT_PUBLIC_API_URL || isLocalApiUrl(configuredUrl)) {
    return `${window.location.protocol}//${formatHostForUrl(window.location.hostname)}:${API_PORT}`;
  }

  return configuredUrl;
}

export const API_URL = getApiUrl();
