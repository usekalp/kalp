export function deriveLabelFromName(name: string): string {
  return name
    .split(/[_-]+/g)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}
