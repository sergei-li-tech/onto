import { create } from "zustand";
import type {
  ActionMapping,
  DataSource,
  EntityMapping,
  McpConnector,
  Ontology,
  Selection,
  TechnicalMapping,
  TemplateId,
  ViewMode,
} from "./types";
import { entityIdFromName, repairOntologyIds } from "./lib/autoIds";
import { nodePositionForFlowCenter } from "./lib/graphPlacement";
import { slugIdFromText } from "./lib/ids";
import { renameEntityInDocument } from "./lib/entityNames";
import { relationshipIdFromName, renameRelationshipInDocument } from "./lib/relationships";
import { copyFromTemplate } from "./lib/templates";
import { blockingIssues, invariantViolations, validateOntology, type ValidationIssue } from "./lib/validate";
import { cloneOntology } from "./lib/yaml";
import { autoLayoutEntities } from "./lib/layoutElk";
import { addActionPhrase, removeAction as removeActionPhrase, removeInvariant as removeInvariantPhrase } from "./lib/sideLists";
import { clearDraftFromStorage, loadDraftFromStorage, saveDraftToStorage } from "./lib/autosave";
import {
  createDefaultTechnicalMapping,
  migrateMappingOnActionRemove,
  migrateMappingOnEntityRemove,
  migrateMappingOnEntityRename,
  validateTechnicalMapping,
} from "./lib/technicalMapping";
import { t } from "./i18n";

const MAX_UNDO = 40;

type Screen = "start" | "editor";

export type AutosaveStatus = "idle" | "saving" | "saved";

type Store = {
  screen: Screen;
  doc: Ontology | null;
  fileHandle: FileSystemFileHandle | null;
  fileName: string | null;
  selection: Selection;
  search: string;
  validationErrors: ValidationIssue[];
  invariantViolations: ValidationIssue[];
  undoStack: Ontology[];
  redoStack: Ontology[];
  autosaveStatus: AutosaveStatus;

  openTemplate: (id: TemplateId, clientDomain?: string) => void;
  loadDocument: (doc: Ontology, handle?: FileSystemFileHandle | null, name?: string | null) => void;
  restoreDraft: () => void;
  clearDraft: () => void;
  setFileHandle: (handle: FileSystemFileHandle | null, name: string | null) => void;
  patchDoc: (updater: (d: Ontology) => Ontology) => void;
  repairIds: () => void;
  undo: () => void;
  redo: () => void;
  setSelection: (sel: Selection) => void;
  setSearch: (q: string) => void;
  addInvariantFromSentence: (sentence: string) => void;
  removeInvariant: (invariantId: string) => void;
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
  duplicateEntity: (entityId: string) => void;
  removeEntity: (entityId: string) => void;
  addAction: (name: string, entityId?: string) => void;
  removeAction: (actionId: string) => void;
  updateNodePosition: (entityId: string, x: number, y: number) => void;
  markSaved: () => void;
  backToStart: () => void;

  viewMode: ViewMode;
  /** When true the graph renders every entity expanded — used for whole-graph PNG export. */
  captureMode: boolean;
  mappingDoc: TechnicalMapping | null;
  mappingFileHandle: FileSystemFileHandle | null;
  mappingFileName: string | null;
  mappingValidationErrors: ValidationIssue[];

  setViewMode: (mode: ViewMode) => void;
  setCaptureMode: (on: boolean) => void;
  loadMappingDocument: (mapping: TechnicalMapping, handle?: FileSystemFileHandle | null, name?: string | null) => void;
  initTechnicalMapping: () => void;
  patchMappingDoc: (updater: (m: TechnicalMapping) => TechnicalMapping) => void;
  updateEntityMapping: (entityId: string, patch: Partial<EntityMapping>) => void;
  updateEntityFieldMapping: (entityId: string, attrId: string, columnName: string) => void;
  updateActionMapping: (actionId: string, patch: Partial<ActionMapping>) => void;
  addDataSource: (name: string, ds: DataSource) => void;
  removeDataSource: (name: string) => void;
  addMcpConnector: (connector: McpConnector) => void;
  removeMcpConnector: (name: string) => void;
};

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutosave(get: () => Store, set: (partial: Partial<Store>) => void) {
  if (typeof window === "undefined") return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  set({ autosaveStatus: "saving" });
  autosaveTimer = setTimeout(() => {
    const { doc, fileName } = get();
    if (doc) {
      saveDraftToStorage(doc, fileName);
      set({ autosaveStatus: "saved" });
    } else {
      set({ autosaveStatus: "idle" });
    }
  }, 1500);
}

function pushUndo(state: Store, prev: Ontology): Partial<Store> {
  const stack = [...state.undoStack, cloneOntology(prev)].slice(-MAX_UNDO);
  return { undoStack: stack, redoStack: [] };
}

function revalidate(doc: Ontology | null): {
  validationErrors: ValidationIssue[];
  invariantViolations: ValidationIssue[];
} {
  const issues = doc ? validateOntology(doc) : [];
  return {
    validationErrors: blockingIssues(issues),
    invariantViolations: invariantViolations(issues),
  };
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
    invariantViolations: [],
    undoStack: [],
    redoStack: [],
    autosaveStatus: "idle",
    viewMode: "business",
    captureMode: false,
    mappingDoc: null,
    mappingFileHandle: null,
    mappingFileName: null,
    mappingValidationErrors: [],

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
        autosaveStatus: "idle",
        viewMode: "business",
        captureMode: false,
        mappingDoc: null,
        mappingFileHandle: null,
        mappingFileName: null,
        mappingValidationErrors: [],
        ...revalidate(doc),
      });
      scheduleAutosave(get, set);
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
        autosaveStatus: "saved",
        viewMode: "business",
        captureMode: false,
        mappingDoc: null,
        mappingFileHandle: null,
        mappingFileName: null,
        mappingValidationErrors: [],
        ...revalidate(doc),
      });
    },

    restoreDraft: () => {
      const draft = loadDraftFromStorage();
      if (!draft) return;
      get().loadDocument(draft.doc, null, draft.fileName ?? null);
      set({ autosaveStatus: "saved" });
    },

    clearDraft: () => {
      clearDraftFromStorage();
      set({ autosaveStatus: "idle" });
    },

    setFileHandle: (handle, name) => set({ fileHandle: handle, fileName: name }),

    patchDoc: (updater) => {
      const { doc } = get();
      if (!doc) return;
      const next = updater(cloneOntology(doc));
      set((s) => ({
        ...pushUndo(s, doc),
        doc: next,
        ...revalidate(next),
      }));
      scheduleAutosave(get, set);
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
        ...revalidate(repaired.doc),
      });
      scheduleAutosave(get, set);
    },

    undo: () => {
      const { doc, undoStack, redoStack } = get();
      if (!doc || undoStack.length === 0) return;
      const prev = undoStack[undoStack.length - 1];
      set({
        doc: cloneOntology(prev),
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, cloneOntology(doc)],
        ...revalidate(prev),
      });
      scheduleAutosave(get, set);
    },

    redo: () => {
      const { doc, undoStack, redoStack } = get();
      if (!doc || redoStack.length === 0) return;
      const next = redoStack[redoStack.length - 1];
      set({
        doc: cloneOntology(next),
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack, cloneOntology(doc!)],
        ...revalidate(next),
      });
      scheduleAutosave(get, set);
    },

    setSelection: (sel) => set({ selection: sel }),
    setSearch: (q) => set({ search: q }),

    addInvariantFromSentence: (sentence) => {
      const text = sentence.trim();
      if (!text) return;
      get().patchDoc((d) => ({
        ...d,
        invariants: [
          ...d.invariants,
          { id: slugIdFromText(text, "invariant"), statement: text },
        ],
      }));
    },

    removeInvariant: (invariantId) => {
      get().patchDoc((d) => ({
        ...d,
        invariants: removeInvariantPhrase(d.invariants, invariantId),
      }));
      const sel = get().selection;
      if (sel?.kind === "invariant" && sel.id === invariantId) {
        get().setSelection(null);
      }
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
      if (nextId !== entityId && get().mappingDoc) {
        const nextMapping = migrateMappingOnEntityRename(get().mappingDoc!, entityId, nextId);
        set({
          mappingDoc: nextMapping,
          mappingValidationErrors: validateTechnicalMapping(nextMapping, get().doc ?? undefined),
        });
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
            cardinality: "0..*",
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
      const name = t("graph.newEntityName");
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

    duplicateEntity: (entityId) => {
      const { doc } = get();
      if (!doc) return;
      const original = doc.entities.find((e) => e.id === entityId);
      if (!original) return;
      const copyName = `${original.name} Copy`;
      const copyId = entityIdFromName(copyName, doc.entities);
      const originalPos = doc.layout?.nodes?.find((n) => n.id === entityId);
      const copyX = originalPos ? originalPos.x + 40 : 100;
      const copyY = originalPos ? originalPos.y + 40 : 100;

      get().patchDoc((d) => {
        const entity = {
          id: copyId,
          name: copyName,
          aliases: [...(original.aliases ?? [])],
          attributes: original.attributes.map((a) => ({ ...a })),
        };
        const nodes = [...(d.layout?.nodes ?? [])];
        nodes.push({ id: copyId, x: copyX, y: copyY });
        return {
          ...d,
          entities: [...d.entities, entity],
          layout: { nodes },
        };
      });
      get().setSelection({ kind: "entity", id: copyId });
    },

    removeEntity: (entityId) => {
      get().patchDoc((d) => ({
        ...d,
        entities: d.entities.filter((e) => e.id !== entityId),
        relationships: d.relationships.filter(
          (r) => r.from !== entityId && r.to !== entityId,
        ),
        actions: d.actions
          .filter((a) => a.entity !== entityId)
          .map((a) => (a.produces === entityId ? { ...a, produces: undefined } : a)),
        layout: d.layout?.nodes
          ? { nodes: d.layout.nodes.filter((n) => n.id !== entityId) }
          : d.layout,
      }));
      const sel = get().selection;
      if (sel?.kind === "entity" && sel.id === entityId) {
        get().setSelection(null);
      }
      if (get().mappingDoc) {
        const nextMapping = migrateMappingOnEntityRemove(get().mappingDoc!, entityId);
        set({
          mappingDoc: nextMapping,
          mappingValidationErrors: validateTechnicalMapping(nextMapping, get().doc ?? undefined),
        });
      }
    },

    addAction: (name, entityId) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      get().patchDoc((d) => {
        const nextActions = addActionPhrase(d.actions, trimmed);
        if (entityId) {
          return {
            ...d,
            actions: nextActions.map((a) =>
              a.name === trimmed ? { ...a, entity: entityId } : a,
            ),
          };
        }
        return { ...d, actions: nextActions };
      });
    },

    removeAction: (actionId) => {
      get().patchDoc((d) => ({
        ...d,
        actions: removeActionPhrase(d.actions, actionId),
      }));
      const sel = get().selection;
      if (sel?.kind === "action" && sel.id === actionId) {
        get().setSelection(null);
      }
      if (get().mappingDoc) {
        const nextMapping = migrateMappingOnActionRemove(get().mappingDoc!, actionId);
        set({
          mappingDoc: nextMapping,
          mappingValidationErrors: validateTechnicalMapping(nextMapping, get().doc ?? undefined),
        });
      }
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

    markSaved: () => {
      clearDraftFromStorage();
      set({ undoStack: [], redoStack: [], autosaveStatus: "saved" });
    },

    backToStart: () => {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      set({
        screen: "start",
        doc: null,
        fileHandle: null,
        fileName: null,
        selection: null,
        undoStack: [],
        redoStack: [],
        validationErrors: [],
        invariantViolations: [],
        autosaveStatus: "idle",
        viewMode: "business",
        captureMode: false,
        mappingDoc: null,
        mappingFileHandle: null,
        mappingFileName: null,
        mappingValidationErrors: [],
      });
    },

    setViewMode: (mode) => {
      if (mode === "technical" && !get().mappingDoc && get().doc) {
        get().initTechnicalMapping();
      }
      set({ viewMode: mode });
    },

    setCaptureMode: (on) => set({ captureMode: on }),

    loadMappingDocument: (mapping, handle = null, name = null) => {
      const { doc } = get();
      set({
        mappingDoc: mapping,
        mappingFileHandle: handle,
        mappingFileName: name,
        mappingValidationErrors: validateTechnicalMapping(mapping, doc ?? undefined),
      });
    },

    initTechnicalMapping: () => {
      const { doc } = get();
      if (!doc) return;
      const mapping = createDefaultTechnicalMapping(doc);
      set({
        mappingDoc: mapping,
        mappingValidationErrors: validateTechnicalMapping(mapping, doc),
      });
    },

    patchMappingDoc: (updater) => {
      const { mappingDoc, doc } = get();
      if (!mappingDoc) return;
      const next = updater(mappingDoc);
      set({
        mappingDoc: next,
        mappingValidationErrors: validateTechnicalMapping(next, doc ?? undefined),
      });
    },

    updateEntityMapping: (entityId, patch) => {
      const { mappingDoc, doc } = get();
      if (!mappingDoc) return;
      const current = mappingDoc.entity_mappings?.[entityId] ?? {};
      const next = {
        ...mappingDoc,
        entity_mappings: {
          ...(mappingDoc.entity_mappings ?? {}),
          [entityId]: { ...current, ...patch },
        },
      };
      set({
        mappingDoc: next,
        mappingValidationErrors: validateTechnicalMapping(next, doc ?? undefined),
      });
    },

    updateEntityFieldMapping: (entityId, attrId, columnName) => {
      const { mappingDoc, doc } = get();
      if (!mappingDoc) return;
      const current = mappingDoc.entity_mappings?.[entityId] ?? {};
      const currentFields = current.field_mappings ?? {};
      const nextFields = { ...currentFields, [attrId]: columnName };
      const next = {
        ...mappingDoc,
        entity_mappings: {
          ...(mappingDoc.entity_mappings ?? {}),
          [entityId]: {
            ...current,
            field_mappings: nextFields,
          },
        },
      };
      set({
        mappingDoc: next,
        mappingValidationErrors: validateTechnicalMapping(next, doc ?? undefined),
      });
    },

    updateActionMapping: (actionId, patch) => {
      const { mappingDoc, doc } = get();
      if (!mappingDoc) return;
      const current = mappingDoc.action_mappings?.[actionId] ?? {};
      const next = {
        ...mappingDoc,
        action_mappings: {
          ...(mappingDoc.action_mappings ?? {}),
          [actionId]: { ...current, ...patch },
        },
      };
      set({
        mappingDoc: next,
        mappingValidationErrors: validateTechnicalMapping(next, doc ?? undefined),
      });
    },

    addDataSource: (name, ds) => {
      const { mappingDoc, doc } = get();
      if (!mappingDoc) return;
      const infra = mappingDoc.infrastructure ?? {};
      const next = {
        ...mappingDoc,
        infrastructure: {
          ...infra,
          data_sources: {
            ...(infra.data_sources ?? {}),
            [name]: ds,
          },
        },
      };
      set({
        mappingDoc: next,
        mappingValidationErrors: validateTechnicalMapping(next, doc ?? undefined),
      });
    },

    removeDataSource: (name) => {
      const { mappingDoc, doc } = get();
      if (!mappingDoc || !mappingDoc.infrastructure?.data_sources) return;
      const { [name]: _, ...rest } = mappingDoc.infrastructure.data_sources;
      const next = {
        ...mappingDoc,
        infrastructure: {
          ...mappingDoc.infrastructure,
          data_sources: rest,
        },
      };
      set({
        mappingDoc: next,
        mappingValidationErrors: validateTechnicalMapping(next, doc ?? undefined),
      });
    },

    addMcpConnector: (connector) => {
      const { mappingDoc, doc } = get();
      if (!mappingDoc) return;
      const infra = mappingDoc.infrastructure ?? {};
      const current = infra.mcp_connectors ?? [];
      const filtered = current.filter((c) => c.name !== connector.name);
      const next = {
        ...mappingDoc,
        infrastructure: {
          ...infra,
          mcp_connectors: [...filtered, connector],
        },
      };
      set({
        mappingDoc: next,
        mappingValidationErrors: validateTechnicalMapping(next, doc ?? undefined),
      });
    },

    removeMcpConnector: (name) => {
      const { mappingDoc, doc } = get();
      if (!mappingDoc || !mappingDoc.infrastructure?.mcp_connectors) return;
      const next = {
        ...mappingDoc,
        infrastructure: {
          ...mappingDoc.infrastructure,
          mcp_connectors: mappingDoc.infrastructure.mcp_connectors.filter((c) => c.name !== name),
        },
      };
      set({
        mappingDoc: next,
        mappingValidationErrors: validateTechnicalMapping(next, doc ?? undefined),
      });
    },
  };
});
