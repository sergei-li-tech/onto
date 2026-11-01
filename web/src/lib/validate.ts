import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../../schema/ontology.schema.json";
import type { Entity, Ontology } from "../types";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const validateSchema = ajv.compile(schema);

function entityEnumValues(entity: Entity): string[] | null {
  const status = entity.attributes.find((a) => a.id === "status" && a.type === "enum");
  return status?.values ?? null;
}

export function validateOntology(doc: Ontology): string[] {
  const errors: string[] = [];

  const ok = validateSchema(doc);
  if (!ok && validateSchema.errors) {
    for (const e of validateSchema.errors) {
      const path = e.instancePath || "(root)";
      errors.push(`${path}: ${e.message ?? "schema error"}`);
    }
  }

  const allEntityIds = new Set(doc.entities.map((e) => e.id));
  const entityIds = new Set<string>();
  for (const e of doc.entities) {
    if (entityIds.has(e.id)) errors.push(`Duplicate entity id: ${e.id}`);
    entityIds.add(e.id);

    const attrIds = new Set<string>();
    for (const a of e.attributes) {
      if (attrIds.has(a.id)) errors.push(`Entity ${e.id}: duplicate attribute ${a.id}`);
      attrIds.add(a.id);
      if (a.type === "enum" && (!a.values || a.values.length === 0)) {
        errors.push(`Entity ${e.id}, attribute ${a.id}: values list required`);
      }
      if (a.type === "ref") {
        if (!a.entity) errors.push(`Entity ${e.id}, attribute ${a.id}: specify entity`);
        else if (!allEntityIds.has(a.entity)) {
          errors.push(`Entity ${e.id}, attribute ${a.id}: unknown entity "${a.entity}"`);
        }
      }
    }
    if (e.attributes.length > 0 && (!e.primary_key || !attrIds.has(e.primary_key))) {
      errors.push(`Entity ${e.id}: primary_key "${e.primary_key ?? ""}" not found in attributes`);
    }
  }

  const relIds = new Set<string>();
  for (const r of doc.relationships) {
    if (relIds.has(r.id)) errors.push(`Duplicate relationship id: ${r.id}`);
    relIds.add(r.id);
    if (!entityIds.has(r.from)) errors.push(`Relationship ${r.id}: unknown entity "${r.from}"`);
    if (!entityIds.has(r.to)) errors.push(`Relationship ${r.id}: unknown entity "${r.to}"`);
  }

  const actionIds = new Set<string>();
  for (const a of doc.actions) {
    if (actionIds.has(a.id)) errors.push(`Duplicate action id: ${a.id}`);
    actionIds.add(a.id);
    if (!a.entity) continue;
    if (!entityIds.has(a.entity)) {
      errors.push(`Action ${a.id}: unknown entity "${a.entity}"`);
      continue;
    }
    const ent = doc.entities.find((x) => x.id === a.entity)!;
    const states = entityEnumValues(ent);
    if (!states) {
      errors.push(`Action ${a.id}: entity ${a.entity} has no enum attribute status`);
      continue;
    }
    for (const fs of a.from_states ?? []) {
      if (!states.includes(fs)) {
        errors.push(`Action ${a.id}: unknown state "${fs}"`);
      }
    }
    if (a.to_state && !states.includes(a.to_state)) {
      errors.push(`Action ${a.id}: unknown destination state "${a.to_state}"`);
    }
  }

  const ruleIds = new Set<string>();
  for (const r of doc.rules) {
    if (ruleIds.has(r.id)) errors.push(`Duplicate rule id: ${r.id}`);
    ruleIds.add(r.id);
  }

  return errors;
}
