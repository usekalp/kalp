export function deriveLabelFromName(name: string): string {
  return name
    .split(/[_-]/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}
