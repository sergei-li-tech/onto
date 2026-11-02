const SNAKE_ID = /^[a-z][a-z0-9_]*$/;

export function isSnakeId(id: string): boolean {
  return SNAKE_ID.test(id);
}

function latinSnake(text: string): string {
  const lowered = text.toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]+/gi, "_");
  const latin = transliterateRough(lowered);
  return latin
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Entity or attribute id: latin and underscores, matching schema. */
export function snakeIdFromText(text: string, prefix: string): string {
  const body = latinSnake(text);
  const id = body ? `${prefix}_${body}` : `${prefix}_item`;
  return id.slice(0, 64).replace(/_+$/g, "") || `${prefix}_item`;
}

/** Preserves valid snake_case. Normalizes hyphens to schema. */
export function coerceSnakeId(
  id: string | undefined,
  fallbackText: string,
  prefix: string,
): string {
  if (id && isSnakeId(id)) return id;
  const fromRaw = id ? latinSnake(id) : "";
  if (isSnakeId(fromRaw)) return fromRaw.slice(0, 64);
  return snakeIdFromText(fallbackText || id || prefix, prefix);
}

export function slugIdFromText(text: string, prefix: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const latin = transliterateRough(base);
  const cleaned = latin.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-");
  return `${prefix}-${cleaned || "item"}`.slice(0, 64);
}

function transliterateRough(s: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  return [...s].map((c) => map[c] ?? c).join("");
}
