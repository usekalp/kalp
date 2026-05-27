export function sanitizeStableSegment(segment: string): string {
  return segment
    .toLowerCase()
    .trim()
    .replace(/[:*]+/g, ".")
    .replace(/[^a-z0-9/._-]+/g, "-")
    .replace(/[\\/]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^[-.]+|[-.]+$/g, "");
}

export function generatePrimitiveId(input: {
  handlerStableName: string;
  namespace: string;
  method: string;
  semanticName: string | null;
  fallbackHash: string;
}): string {
  const segments = [
    input.handlerStableName,
    input.namespace,
    input.method,
  ];

  const inferred = input.semanticName
    ? sanitizeStableSegment(input.semanticName)
    : null;

  if (inferred && inferred.length > 0) {
    segments.push(inferred);
  } else {
    segments.push(input.fallbackHash);
  }

  return segments.join(".");
}