import { useSyncExternalStore } from "react";
import { en, type Dict } from "./en";
import { ru } from "./ru";
import { ko } from "./ko";

export type Lang = "en" | "ru" | "ko";

export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ru", label: "Русский" },
  { id: "ko", label: "한국어" },
];

export const LANG_STORAGE_KEY = "onto.lang";
const DEFAULT_LANG: Lang = "en";
const DICTS: Record<Lang, Dict> = { en, ru, ko };

function isLang(value: unknown): value is Lang {
  return value === "en" || value === "ru" || value === "ko";
}

function readStoredLang(): Lang {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_LANG;
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(stored) ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

let current: Lang = readStoredLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function translate(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTS[lang] as Record<string, string>;
  const fallback = en as Record<string, string>;
  const template = dict[key] ?? fallback[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Translate a key using the currently selected interface language. */
export function t(key: string, vars?: Record<string, string | number>): string {
  return translate(current, key, vars);
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export function applyDocumentLanguage(): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = current;
  document.title = t("app.title");
}

export function setLang(next: Lang): void {
  if (!isLang(next) || next === current) return;
  current = next;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    }
  } catch {
    // Storage may be unavailable (private mode); the in-memory choice still works.
  }
  applyDocumentLanguage();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

export function useT(): TFunction {
  const lang = useLang();
  return (key, vars) => translate(lang, key, vars);
}

// Keep <html lang> and <title> correct from the first frame.
applyDocumentLanguage();
