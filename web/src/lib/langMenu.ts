import type { Lang } from "../i18n";

/** Short codes shown on the switcher button — compact enough for a narrow topbar. */
export const LANG_CODES: Record<Lang, string> = {
  en: "EN",
  ru: "RU",
  ko: "KO",
};

export function langCode(lang: Lang): string {
  return LANG_CODES[lang];
}

/** Move through a circular menu list; wraps in both directions. */
export function stepIndex(index: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  const start = index < 0 ? 0 : index;
  return (((start + delta) % length) + length) % length;
}
