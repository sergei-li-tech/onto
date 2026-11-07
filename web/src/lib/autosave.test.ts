import { beforeEach, describe, expect, it } from "vitest";
import type { Ontology } from "../types";
import {
  AUTOSAVE_STORAGE_KEY,
  clearDraftFromStorage,
  hasDraftInStorage,
  loadDraftFromStorage,
  saveDraftToStorage,
} from "./autosave";

const sampleDoc: Ontology = {
  domain: "draft-shop",
  version: "1.0.0",
  notes: "Draft notes",
  entities: [{ id: "client", name: "Client", attributes: [] }],
  relationships: [],
  actions: [],
  invariants: [],
  open_questions: [],
  out_of_scope: [],
};

const store = new Map<string, string>();
const storageMock: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => store.clear(),
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  get length() {
    return store.size;
  },
};

describe("Autosave storage", () => {
  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: storageMock,
      writable: true,
      configurable: true,
    });
  });

  it("saves and loads draft accurately", () => {
    expect(hasDraftInStorage()).toBe(false);
    expect(loadDraftFromStorage()).toBeNull();

    const ok = saveDraftToStorage(sampleDoc, "shop.yaml");
    expect(ok).toBe(true);
    expect(hasDraftInStorage()).toBe(true);

    const loaded = loadDraftFromStorage();
    expect(loaded).not.toBeNull();
    expect(loaded?.doc.domain).toBe("draft-shop");
    expect(loaded?.fileName).toBe("shop.yaml");
    expect(typeof loaded?.savedAt).toBe("string");
  });

  it("clears draft from storage", () => {
    saveDraftToStorage(sampleDoc, null);
    expect(hasDraftInStorage()).toBe(true);

    clearDraftFromStorage();
    expect(hasDraftInStorage()).toBe(false);
    expect(loadDraftFromStorage()).toBeNull();
  });

  it("handles corrupted storage content safely", () => {
    storageMock.setItem(AUTOSAVE_STORAGE_KEY, "invalid-json");
    expect(loadDraftFromStorage()).toBeNull();
    expect(hasDraftInStorage()).toBe(false);
  });
});
