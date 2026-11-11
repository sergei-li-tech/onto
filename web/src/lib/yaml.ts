import { Document, YAMLMap, isMap, isScalar, isSeq, parseDocument } from "yaml";
import type {
  Action,
  ActionInput,
  Attribute,
  AttributeType,
  Entity,
  Invariant,
  InvariantSourceType,
  Layout,
  Ontology,
  Relationship,
  RiskLevel,
} from "../types";

export const INVARIANTS_KEY = "invariants";
/** Key used by files written before the `rules` → `invariants` rename. */
export const LEGACY_RULES_KEY = "rules";

/** Canonical address of the schema the editor generates and validates against. */
export const ONTOLOGY_SCHEMA_URL =
  "https://raw.githubusercontent.com/sergei-li-tech/onto/main/schema/ontology.schema.json";

const TOP_LEVEL_ORDER = [
  "$schema",
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
    cardinality: r.cardinality,
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
  if (a.pii !== undefined) out.pii = a.pii;
  if (a.values) out.values = a.values;
  if (a.entity) out.entity = a.entity;
  return out;
}

function invariantToPlain(inv: Invariant): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: inv.id,
    statement: inv.statement,
  };
  if (inv.source?.trim()) out.source = inv.source.trim();
  if (inv.source_type) out.source_type = inv.source_type;
  if (inv.checked_at?.trim()) out.checked_at = inv.checked_at.trim();
  return out;
}

export function serializeOntology(doc: Ontology): string {
  const plain: Record<string, unknown> = {
    $schema: ONTOLOGY_SCHEMA_URL,
    domain: doc.domain,
    version: doc.version,
    notes: doc.notes,
    entities: doc.entities.map(entityToPlain),
    relationships: doc.relationships.map(relationshipToPlain),
    actions: doc.actions.map(actionToPlain),
    invariants: doc.invariants.map(invariantToPlain),
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
  const pii = raw.get("pii");
  if (pii !== undefined) a.pii = asBool(pii, "attributes.pii");
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
  const id = asString(raw.get("id"), "relationships.id");
  const from = asString(raw.get("from"), "relationships.from");
  const to = asString(raw.get("to"), "relationships.to");
  const name = asString(raw.get("name"), "relationships.name");

  const rawCard = raw.get("cardinality");
  if (rawCard === undefined || rawCard === null) {
    throw new Error(`Relationship ${id}: missing required field "cardinality"`);
  }
  const cardVal = isMap(rawCard)
    ? (rawCard.toJSON() as { from?: string; to?: string })
    : isScalar(rawCard)
      ? String(rawCard.value)
      : (rawCard as string);

  const rel: Relationship = {
    id,
    from,
    to,
    name,
    cardinality: cardVal,
  };
  const relNotes = raw.get("notes");
  if (relNotes !== undefined) rel.notes = asString(relNotes, "relationships.notes");
  return rel;
}

function actionInputToPlain(i: ActionInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: i.name,
    type: i.type,
  };
  if (i.required !== undefined) out.required = i.required;
  if (i.description?.trim()) out.description = i.description.trim();
  if (i.values && i.values.length > 0) out.values = i.values;
  if (i.entity) out.entity = i.entity;
  return out;
}

function actionToPlain(a: Action): Record<string, unknown> {
  const out: Record<string, unknown> = { id: a.id, name: a.name };
  if (a.entity) out.entity = a.entity;
  if (a.produces) out.produces = a.produces;
  if (a.roles_allowed && a.roles_allowed.length > 0) out.roles_allowed = a.roles_allowed;
  if (a.risk_level) out.risk_level = a.risk_level;
  if (a.requires_confirmation !== undefined) out.requires_confirmation = a.requires_confirmation;
  if (a.warning_prompt?.trim()) out.warning_prompt = a.warning_prompt.trim();
  if (a.rule?.trim()) out.rule = a.rule.trim();
  if (a.inputs && a.inputs.length > 0) {
    out.inputs = a.inputs.map(actionInputToPlain);
  }
  return out;
}

function parseActionInput(raw: unknown): ActionInput {
  if (!isMap(raw)) throw new Error("Action input must be an object");
  const input: ActionInput = {
    name: asString(raw.get("name"), "actions.inputs.name"),
    type: asString(raw.get("type"), "actions.inputs.type") as AttributeType,
  };
  const req = raw.get("required");
  if (req !== undefined) input.required = asBool(req, "actions.inputs.required");
  const desc = raw.get("description");
  if (desc !== undefined && desc !== null) {
    input.description = asString(desc, "actions.inputs.description");
  }
  const values = raw.get("values");
  if (isSeq(values)) input.values = values.toJSON() as string[];
  const ent = raw.get("entity");
  if (ent !== undefined && ent !== null) input.entity = asString(ent, "actions.inputs.entity");
  return input;
}

function parseAction(raw: unknown): Action {
  if (!isMap(raw)) throw new Error("Action must be an object");
  // Keep every key from the file, including legacy `from_states`/`to_state`:
  // the schema rejects unknown action properties, so a file that still
  // declares states fails validation with a clear message instead of loading
  // with those fields silently dropped.
  const action = raw.toJSON() as Record<string, unknown> as unknown as Action;
  action.id = asString(raw.get("id"), "actions.id");
  action.name = asString(raw.get("name"), "actions.name");
  const entity = raw.get("entity");
  if (entity !== undefined) action.entity = asString(entity, "actions.entity");
  const produces = raw.get("produces");
  if (produces !== undefined && produces !== null) {
    action.produces = asString(produces, "actions.produces");
  }
  const confirm = raw.get("requires_confirmation");
  if (confirm !== undefined) {
    action.requires_confirmation = asBool(confirm, "actions.requires_confirmation");
  }
  const risk = raw.get("risk_level");
  if (risk !== undefined && risk !== null) {
    action.risk_level = asString(risk, "actions.risk_level") as RiskLevel;
  }
  const roles = raw.get("roles_allowed");
  if (isSeq(roles)) action.roles_allowed = roles.toJSON() as string[];
  const warning = raw.get("warning_prompt");
  if (warning !== undefined && warning !== null) {
    action.warning_prompt = asString(warning, "actions.warning_prompt");
  }
  const rule = raw.get("rule");
  if (rule !== undefined) action.rule = asString(rule, "actions.rule");
  const inputs = raw.get("inputs");
  if (isSeq(inputs)) {
    action.inputs = inputs.items.map(parseActionInput);
  }
  return action;
}

function parseInvariant(raw: unknown): Invariant {
  if (!isMap(raw)) throw new Error("Invariant must be an object");
  const inv: Invariant = {
    id: asString(raw.get("id"), "invariants.id"),
    statement: asString(raw.get("statement"), "invariants.statement"),
  };
  const source = raw.get("source");
  if (source !== undefined && source !== null) {
    inv.source = asString(source, "invariants.source");
  }
  const sourceType = raw.get("source_type");
  if (sourceType !== undefined && sourceType !== null) {
    inv.source_type = asString(sourceType, "invariants.source_type") as InvariantSourceType;
  }
  const checkedAt = raw.get("checked_at");
  if (checkedAt !== undefined && checkedAt !== null) {
    inv.checked_at = asString(checkedAt, "invariants.checked_at");
  }
  return inv;
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
