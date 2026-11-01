export function parseCommaList(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function formatCommaList(items: readonly string[] | undefined): string {
  return (items ?? []).join(", ");
}
