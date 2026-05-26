export function extractBearerToken(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const value = authorization.trim();
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  const token = match[1].trim();
  return token || null;
}

export function safeJsonParse<T = unknown>(value: string | null | undefined, fallback: T | null = null): T | null {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}