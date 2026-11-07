import type { Ontology } from "../types";

export const AUTOSAVE_STORAGE_KEY = "onto_autosave_draft_v1";

export interface AutosaveDraft {
  doc: Ontology;
  fileName: string | null;
  savedAt: string;
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // Access denied / restricted
  }
  return null;
}

export function saveDraftToStorage(doc: Ontology, fileName: string | null): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    const draft: AutosaveDraft = {
      doc,
      fileName,
      savedAt: new Date().toISOString(),
    };
    storage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadDraftFromStorage(): AutosaveDraft | null {
  try {
    const storage = getStorage();
    if (!storage) return null;
    const raw = storage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutosaveDraft;
    if (parsed && parsed.doc && parsed.doc.domain && Array.isArray(parsed.doc.entities)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearDraftFromStorage(): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(AUTOSAVE_STORAGE_KEY);
  } catch {
    // Ignore error
  }
}

export function hasDraftInStorage(): boolean {
  return loadDraftFromStorage() !== null;
}
