import { create } from "zustand";
import type { Ontology, Selection, TemplateId } from "./types";
import { entityIdFromName, repairOntologyIds } from "./lib/autoIds";
import { nodePositionForFlowCenter } from "./lib/graphPlacement";
import { slugIdFromText } from "./lib/ids";
import { renameEntityInDocument } from "./lib/entityNames";
import { relationshipIdFromName, renameRelationshipInDocument } from "./lib/relationships";
import { copyFromTemplate } from "./lib/templates";
import { validateOntology } from "./lib/validate";
import { cloneOntology } from "./lib/yaml";
import { autoLayoutEntities } from "./lib/layoutElk";

const MAX_UNDO = 40;

type Screen = "start" | "editor";

type Store = {
  screen: Screen;
  doc: Ontology | null;
  fileHandle: FileSystemFileHandle | null;
  fileName: string | null;
  selection: Selection;
  search: string;
  validationErrors: string[];
  undoStack: Ontology[];
  redoStack: Ontology[];

  openTemplate: (id: TemplateId, clientDomain?: string) => void;
  loadDocument: (doc: Ontology, handle?: FileSystemFileHandle | null, name?: string | null) => void;
  setFileHandle: (handle: FileSystemFileHandle | null, name: string | null) => void;
  patchDoc: (updater: (d: Ontology) => Ontology) => void;
  repairIds: () => void;
  undo: () => void;
  redo: () => void;
  setSelection: (sel: Selection) => void;
  setSearch: (q: string) => void;
  addRuleFromSentence: (sentence: string) => void;
  renameEntityName: (entityId: string, newName: string) => void;
  addRelationship: (
    from: string,
    to: string,
    name: string,
  ) => string | null;
  renameRelationshipName: (relationshipId: string, newName: string) => void;
  removeRelationship: (relationshipId: string) => void;
  runAutoLayout: () => Promise<void>;
  addEntity: (flowCenter?: { x: number; y: number }) => void;
  updateNodePosition: (entityId: string, x: number, y: number) => void;
  markSaved: () => void;
  backToStart: () => void;
};

function pushUndo(state: Store, prev: Ontology): Partial<Store> {
  const stack = [...state.undoStack, cloneOntology(prev)].slice(-MAX_UNDO);
  return { undoStack: stack, redoStack: [] };
}

function revalidate(doc: Ontology | null): string[] {
  return doc ? validateOntology(doc) : [];
}

export const useOntologyStore = create<Store>((set, get) => {
  return {
  screen: "start",
  doc: null,
  fileHandle: null,
  fileName: null,
  selection: null,
  search: "",
  validationErrors: [],
  undoStack: [],
  redoStack: [],

  openTemplate: (_id, clientDomain) => {
    const doc = copyFromTemplate(clientDomain ?? "");
    set({
      screen: "editor",
      doc,
      fileHandle: null,
      fileName: null,
      selection: doc.entities[0] ? { kind: "entity", id: doc.entities[0].id } : null,
      undoStack: [],
      redoStack: [],
      validationErrors: revalidate(doc),
    });
  },

  loadDocument: (doc, handle = null, name = null) => {
    set({
      screen: "editor",
      doc: cloneOntology(doc),
      fileHandle: handle ?? null,
      fileName: name,
      selection: doc.entities[0] ? { kind: "entity", id: doc.entities[0].id } : null,
      undoStack: [],
      redoStack: [],
      validationErrors: revalidate(doc),
    });
  },

  setFileHandle: (handle, name) => set({ fileHandle: handle, fileName: name }),

  patchDoc: (updater) => {
    const { doc } = get();
    if (!doc) return;
    const next = updater(cloneOntology(doc));
    set((s) => ({
      ...pushUndo(s, doc),
      doc: next,
      validationErrors: revalidate(next),
    }));
  },

  repairIds: () => {
    const { doc, selection } = get();
    if (!doc) return;
    const repaired = repairOntologyIds(doc);
    if (repaired.doc === doc) return;
    const nextSelection =
      selection?.kind === "entity" && repaired.aliases.has(selection.id)
        ? { kind: "entity" as const, id: repaired.aliases.get(selection.id)! }
        : selection;
    set({
      doc: repaired.doc,
      selection: nextSelection,
      validationErrors: revalidate(repaired.doc),
    });
  },

  undo: () => {
    const { doc, undoStack, redoStack } = get();
    if (!doc || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      doc: cloneOntology(prev),
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, cloneOntology(doc)],
      validationErrors: revalidate(prev),
    });
  },

  redo: () => {
    const { doc, undoStack, redoStack } = get();
    if (!doc || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      doc: cloneOntology(next),
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, cloneOntology(doc!)],
      validationErrors: revalidate(next),
    });
  },

  setSelection: (sel) => set({ selection: sel }),
  setSearch: (q) => set({ search: q }),

  addRuleFromSentence: (sentence) => {
    const text = sentence.trim();
    if (!text) return;
    get().patchDoc((d) => ({
      ...d,
      rules: [
        ...d.rules,
        { id: slugIdFromText(text, "rule"), statement: text },
      ],
    }));
  },

  renameEntityName: (entityId, newName) => {
    let nextId = entityId;
    get().patchDoc((d) => {
      const result = renameEntityInDocument(d, entityId, newName, "display");
      nextId = result.id;
      return result.doc;
    });
    const selection = get().selection;
    if (nextId !== entityId && selection?.kind === "entity" && selection.id === entityId) {
      get().setSelection({ kind: "entity", id: nextId });
    }
  },

  addRelationship: (from, to, name) => {
    const trimmedName = name.trim();
    if (!from || !to || !trimmedName) return null;
    if (from === to) return null;

    const { doc } = get();
    if (!doc) return null;

    const sameTriple = doc.relationships.find(
      (r) => r.from === from && r.to === to && r.name === trimmedName,
    );
    if (sameTriple) {
      get().setSelection({ kind: "relationship", id: sameTriple.id });
      return sameTriple.id;
    }

    const id = relationshipIdFromName(
      from,
      trimmedName,
      to,
      doc.relationships.map((r) => r.id),
    );

    get().patchDoc((d) => ({
      ...d,
      relationships: [
        ...d.relationships,
        {
          id,
          from,
          to,
          name: trimmedName,
          from_min: "1",
          from_max: "1",
          to_min: "0",
          to_max: "many",
        },
      ],
    }));
    get().setSelection({ kind: "relationship", id });
    return id;
  },

  renameRelationshipName: (relationshipId, newName) => {
    let nextId = relationshipId;
    get().patchDoc((d) => {
      const result = renameRelationshipInDocument(d, relationshipId, newName);
      nextId = result.id;
      return result.doc;
    });
    const selection = get().selection;
    if (
      nextId !== relationshipId &&
      selection?.kind === "relationship" &&
      selection.id === relationshipId
    ) {
      get().setSelection({ kind: "relationship", id: nextId });
    }
  },

  removeRelationship: (relationshipId) => {
    get().patchDoc((d) => ({
      ...d,
      relationships: d.relationships.filter((r) => r.id !== relationshipId),
    }));
    const sel = get().selection;
    if (sel?.kind === "relationship" && sel.id === relationshipId) {
      get().setSelection(null);
    }
  },

  runAutoLayout: async () => {
    const { doc } = get();
    if (!doc) return;
    const nodes = await autoLayoutEntities(doc);
    get().patchDoc((d) => ({
      ...d,
      layout: { nodes },
    }));
  },

  addEntity: (flowCenter) => {
    const { doc } = get();
    if (!doc) return;
    const name = "New entity";
    const id = entityIdFromName(name, doc.entities);
    const placement = flowCenter ? nodePositionForFlowCenter(flowCenter) : null;
    get().patchDoc((d) => {
      const entity = {
        id,
        name,
        aliases: [] as string[],
        attributes: [],
      };
      const nodes = [...(d.layout?.nodes ?? [])];
      if (placement) nodes.push({ id, x: placement.x, y: placement.y });
      return {
        ...d,
        entities: [...d.entities, entity],
        layout: nodes.length ? { nodes } : d.layout,
      };
    });
    get().setSelection({ kind: "entity", id });
  },

  updateNodePosition: (entityId, x, y) => {
    get().patchDoc((d) => {
      const nodes = [...(d.layout?.nodes ?? [])];
      const idx = nodes.findIndex((n) => n.id === entityId);
      if (idx >= 0) nodes[idx] = { id: entityId, x, y };
      else nodes.push({ id: entityId, x, y });
      return { ...d, layout: { nodes } };
    });
  },

  markSaved: () => set({ undoStack: [], redoStack: [] }),

  backToStart: () =>
    set({
      screen: "start",
      doc: null,
      fileHandle: null,
      fileName: null,
      selection: null,
      undoStack: [],
      redoStack: [],
      validationErrors: [],
    }),
  };
});
