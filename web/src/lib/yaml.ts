import { Document, YAMLMap, isMap, isSeq, parseDocument } from "yaml";
import type {
  Action,
  Attribute,
  Entity,
  Invariant,
  Layout,
  Ontology,
  Relationship,
} from "../types";

export const INVARIANTS_KEY = "invariants";
/** Key used by files written before the `rules` → `invariants` rename. */
export const LEGACY_RULES_KEY = "rules";

const TOP_LEVEL_ORDER = [
  "domain",
  "version",
  "based_on",
  "updated_at",
  "author",
  "notes",
  "entities",
  "relationships",
  "actions",
  "invariants",
  "open_questions",
  "out_of_scope",
  "layout",
] as const;

function orderedMap(obj: Record<string, unknown>): YAMLMap {
  const map = new YAMLMap();
  for (const key of TOP_LEVEL_ORDER) {
    if (key in obj && obj[key] !== undefined) {
      map.set(key, obj[key]);
    }
  }
  return map;
}

function entityToPlain(e: Entity): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: e.id,
    name: e.name,
    aliases: e.aliases ?? [],
    attributes: e.attributes.map((a) => attributeToPlain(a)),
  };
  if (e.primary_key) out.primary_key = e.primary_key;
  if (e.template_name) out.template_name = e.template_name;
  if (e.notes?.trim()) out.notes = e.notes;
  if (e.unique_identifier?.trim()) out.unique_identifier = e.unique_identifier.trim();
  return out;
}

function relationshipToPlain(r: Relationship): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: r.id,
    from: r.from,
    to: r.to,
    name: r.name,
    from_min: r.from_min,
    from_max: r.from_max,
    to_min: r.to_min,
    to_max: r.to_max,
  };
  if (r.notes?.trim()) out.notes = r.notes;
  return out;
}

function attributeToPlain(a: Attribute): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: a.id,
    type: a.type,
    name: a.name,
  };
  if (a.required !== undefined) out.required = a.required;
  if (a.values) out.values = a.values;
  if (a.entity) out.entity = a.entity;
  return out;
}

export function serializeOntology(doc: Ontology): string {
  const plain: Record<string, unknown> = {
    domain: doc.domain,
    version: doc.version,
    notes: doc.notes,
    entities: doc.entities.map(entityToPlain),
    relationships: doc.relationships.map(relationshipToPlain),
    actions: doc.actions.map(actionToPlain),
    invariants: doc.invariants,
    open_questions: doc.open_questions,
    out_of_scope: doc.out_of_scope,
  };
  if (doc.based_on) plain.based_on = doc.based_on;
  if (doc.updated_at) plain.updated_at = doc.updated_at;
  if (doc.author) plain.author = doc.author;
  if (doc.layout?.nodes?.length) plain.layout = doc.layout;

  const yamlDoc = new Document(orderedMap(plain));
  yamlDoc.options.lineWidth = 0;
  return yamlDoc.toString();
}

function asString(v: unknown, field: string): string {
  if (typeof v !== "string") throw new Error(`Field ${field} must be a string`);
  return v;
}

function asBool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") throw new Error(`Field ${field} must be a boolean`);
  return v;
}

function parseAttribute(raw: unknown): Attribute {
  if (!isMap(raw)) throw new Error("Attribute must be an object");
  const a: Attribute = {
    id: asString(raw.get("id"), "attributes.id"),
    type: asString(raw.get("type"), "attributes.type") as Attribute["type"],
    name: asString(raw.get("name"), "attributes.name"),
  };
  const req = raw.get("required");
  if (req !== undefined) a.required = asBool(req, "attributes.required");
  const values = raw.get("values");
  if (isSeq(values)) a.values = values.toJSON() as string[];
  const ent = raw.get("entity");
  if (ent !== undefined) a.entity = asString(ent, "attributes.entity");
  return a;
}

function parseEntity(raw: unknown): Entity {
  if (!isMap(raw)) throw new Error("Entity must be an object");
  const attrs = raw.get("attributes");
  if (!isSeq(attrs)) throw new Error("entities.attributes must be a list");
  const aliases = raw.get("aliases");
  const e: Entity = {
    id: asString(raw.get("id"), "entities.id"),
    name: asString(raw.get("name"), "entities.name"),
    attributes: attrs.items.map(parseAttribute),
  };
  const primaryKey = raw.get("primary_key");
  if (primaryKey !== undefined) e.primary_key = asString(primaryKey, "entities.primary_key");
  if (isSeq(aliases)) e.aliases = aliases.toJSON() as string[];
  const tn = raw.get("template_name");
  if (tn !== undefined) e.template_name = asString(tn, "entities.template_name");
  const entNotes = raw.get("notes");
  if (entNotes !== undefined) e.notes = asString(entNotes, "entities.notes");
  const uid = raw.get("unique_identifier");
  if (uid !== undefined) e.unique_identifier = asString(uid, "entities.unique_identifier");
  return e;
}

function parseRelationship(raw: unknown): Relationship {
  if (!isMap(raw)) throw new Error("Relationship must be an object");
  const rel: Relationship = {
    id: asString(raw.get("id"), "relationships.id"),
    from: asString(raw.get("from"), "relationships.from"),
    to: asString(raw.get("to"), "relationships.to"),
    name: asString(raw.get("name"), "relationships.name"),
    from_min: asString(raw.get("from_min"), "relationships.from_min") as Relationship["from_min"],
    from_max: asString(raw.get("from_max"), "relationships.from_max") as Relationship["from_max"],
    to_min: asString(raw.get("to_min"), "relationships.to_min") as Relationship["to_min"],
    to_max: asString(raw.get("to_max"), "relationships.to_max") as Relationship["to_max"],
  };
  const relNotes = raw.get("notes");
  if (relNotes !== undefined) rel.notes = asString(relNotes, "relationships.notes");
  return rel;
}

function actionToPlain(a: Action): Record<string, unknown> {
  const out: Record<string, unknown> = { id: a.id, name: a.name };
  if (a.entity) out.entity = a.entity;
  if (a.from_states) out.from_states = a.from_states;
  if (a.to_state) out.to_state = a.to_state;
  if (a.requires_confirmation !== undefined) out.requires_confirmation = a.requires_confirmation;
  if (a.rule?.trim()) out.rule = a.rule;
  return out;
}

function parseAction(raw: unknown): Action {
  if (!isMap(raw)) throw new Error("Action must be an object");
  const action: Action = {
    id: asString(raw.get("id"), "actions.id"),
    name: asString(raw.get("name"), "actions.name"),
  };
  const entity = raw.get("entity");
  if (entity !== undefined) action.entity = asString(entity, "actions.entity");
  const fromStates = raw.get("from_states");
  if (fromStates !== undefined) {
    if (!isSeq(fromStates)) throw new Error("actions.from_states must be a list");
    action.from_states = fromStates.toJSON() as string[];
  }
  const toState = raw.get("to_state");
  if (toState !== undefined) action.to_state = asString(toState, "actions.to_state");
  const confirm = raw.get("requires_confirmation");
  if (confirm !== undefined) {
    action.requires_confirmation = asBool(confirm, "actions.requires_confirmation");
  }
  const rule = raw.get("rule");
  if (rule !== undefined) action.rule = asString(rule, "actions.rule");
  return action;
}

function parseInvariant(raw: unknown): Invariant {
  if (!isMap(raw)) throw new Error("Invariant must be an object");
  return {
    id: asString(raw.get("id"), "invariants.id"),
    statement: asString(raw.get("statement"), "invariants.statement"),
  };
}

function parseLayout(raw: unknown): Layout {
  if (!isMap(raw)) return {};
  const nodes = raw.get("nodes");
  if (!isSeq(nodes)) return {};
  return {
    nodes: nodes.toJSON() as Layout["nodes"],
  };
}

export function parseOntologyYaml(text: string): Ontology {
  const doc = parseDocument(text);
  if (!isMap(doc.contents)) throw new Error("YAML root must be an object");
  const root = doc.contents;

  const entitiesRaw = root.get("entities");
  const relsRaw = root.get("relationships");
  const actionsRaw = root.get("actions");
  // Legacy files written before the rename keep their list under `rules`.
  const invariantsRaw =
    root.get(INVARIANTS_KEY) ?? root.get(LEGACY_RULES_KEY);
  const oq = root.get("open_questions");
  const oos = root.get("out_of_scope");

  if (!isSeq(entitiesRaw)) throw new Error("entities must be a list");
  if (!isSeq(relsRaw)) throw new Error("relationships must be a list");
  if (!isSeq(actionsRaw)) throw new Error("actions must be a list");
  if (!isSeq(invariantsRaw)) throw new Error("invariants must be a list");
  if (!isSeq(oq)) throw new Error("open_questions must be a list");
  if (!isSeq(oos)) throw new Error("out_of_scope must be a list");

  const basedOnRaw = root.get("based_on");
  let based_on: Ontology["based_on"];
  if (basedOnRaw !== undefined) {
    if (!isMap(basedOnRaw)) throw new Error("based_on must be an object");
    based_on = {
      id: asString(basedOnRaw.get("id"), "based_on.id"),
      version: asString(basedOnRaw.get("version"), "based_on.version"),
    };
  }

  const layoutRaw = root.get("layout");
  const layout = layoutRaw !== undefined ? parseLayout(layoutRaw) : undefined;

  const authorRaw = root.get("author");
  const updatedRaw = root.get("updated_at");

  return {
    domain: asString(root.get("domain"), "domain"),
    version: asString(root.get("version"), "version"),
    based_on,
    updated_at: updatedRaw !== undefined ? asString(updatedRaw, "updated_at") : undefined,
    author: authorRaw !== undefined ? asString(authorRaw, "author") : undefined,
    notes: asString(root.get("notes"), "notes"),
    entities: entitiesRaw.items.map(parseEntity),
    relationships: relsRaw.items.map(parseRelationship),
    actions: actionsRaw.items.map(parseAction),
    invariants: invariantsRaw.items.map(parseInvariant),
    open_questions: oq.toJSON() as string[],
    out_of_scope: oos.toJSON() as string[],
    layout,
  };
}

export function cloneOntology(doc: Ontology): Ontology {
  return structuredClone(doc);
}
