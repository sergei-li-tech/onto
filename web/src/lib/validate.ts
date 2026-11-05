import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../../schema/ontology.schema.json";
import type { Entity, Ontology } from "../types";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const validateSchema = ajv.compile(schema);

/**
 * Machine-readable validation issue. The interface layer turns it into text in
 * the selected language, so validation stays language-independent.
 */
export type ValidationIssue = {
  /** Issue class. `invariant` issues are reported separately from schema checks. */
  kind?: "invariant";
  code: string;
  keyword?: string;
  path?: string;
  field?: string;
  type?: string;
  value?: string;
  entity?: string;
  attribute?: string;
  relationship?: string;
  action?: string;
  /** States declared by the action, joined for the "add a status attribute" recipe. */
  states?: string;
};

function entityEnumValues(entity: Entity): string[] | null {
  const status = entity.attributes.find((a) => a.id === "status" && a.type === "enum");
  return status?.values ?? null;
}

export function validateOntology(doc: Ontology): ValidationIssue[] {
  const errors: ValidationIssue[] = [];

  const ok = validateSchema(doc);
  if (!ok && validateSchema.errors) {
    for (const e of validateSchema.errors) {
      const params = (e.params ?? {}) as Record<string, unknown>;
      const field =
        typeof params.missingProperty === "string"
          ? params.missingProperty
          : typeof params.additionalProperty === "string"
            ? params.additionalProperty
            : undefined;
      errors.push({
        code: "schema",
        keyword: e.keyword,
        path: e.instancePath || "/",
        field,
        type: typeof params.type === "string" ? params.type : undefined,
      });
    }
  }

  const allEntityIds = new Set(doc.entities.map((e) => e.id));
  const entityIds = new Set<string>();
  for (const e of doc.entities) {
    if (entityIds.has(e.id)) {
      errors.push({ code: "duplicateEntityId", entity: e.id, value: e.id });
    }
    entityIds.add(e.id);

    const attrIds = new Set<string>();
    for (const a of e.attributes) {
      if (attrIds.has(a.id)) {
        errors.push({ code: "duplicateAttributeId", entity: e.id, attribute: a.id });
      }
      attrIds.add(a.id);
      if (a.type === "enum" && (!a.values || a.values.length === 0)) {
        errors.push({ code: "enumValuesRequired", entity: e.id, attribute: a.id });
      }
      if (a.type === "ref") {
        if (!a.entity) {
          errors.push({ code: "refEntityRequired", entity: e.id, attribute: a.id });
        } else if (!allEntityIds.has(a.entity)) {
          errors.push({
            code: "refEntityUnknown",
            entity: e.id,
            attribute: a.id,
            value: a.entity,
          });
        }
      }
    }
    if (e.attributes.length > 0 && (!e.primary_key || !attrIds.has(e.primary_key))) {
      errors.push({
        code: "primaryKeyMissing",
        entity: e.id,
        value: e.primary_key ?? "",
      });
    }
  }

  const relIds = new Set<string>();
  for (const r of doc.relationships) {
    if (relIds.has(r.id)) {
      errors.push({ code: "duplicateRelationshipId", relationship: r.id, value: r.id });
    }
    relIds.add(r.id);
    if (!entityIds.has(r.from)) {
      errors.push({ code: "relationshipUnknownFrom", relationship: r.id, value: r.from });
    }
    if (!entityIds.has(r.to)) {
      errors.push({ code: "relationshipUnknownTo", relationship: r.id, value: r.to });
    }
  }

  const actionIds = new Set<string>();
  for (const a of doc.actions) {
    if (actionIds.has(a.id)) {
      errors.push({ code: "duplicateActionId", action: a.id, value: a.id });
    }
    actionIds.add(a.id);
    if (!a.entity) continue;
    if (!entityIds.has(a.entity)) {
      errors.push({ code: "actionUnknownEntity", action: a.id, value: a.entity });
      continue;
    }
    const ent = doc.entities.find((x) => x.id === a.entity)!;
    // A status enum is only meaningful for actions that declare state
    // transitions: `from_states` (non-empty) or `to_state`. An action bound to
    // an entity without states does not require the entity to have `status`.
    const declaredStates = [...(a.from_states ?? [])];
    if (a.to_state && !declaredStates.includes(a.to_state)) {
      declaredStates.push(a.to_state);
    }
    const states = entityEnumValues(ent);
    if (!states) {
      if (declaredStates.length > 0) {
        errors.push({
          code: "actionEntityNoStatus",
          action: a.id,
          value: a.entity,
          states: declaredStates.join(", "),
        });
      }
      continue;
    }
    for (const fs of a.from_states ?? []) {
      if (!states.includes(fs)) {
        errors.push({ code: "actionUnknownFromState", action: a.id, value: fs });
      }
    }
    if (a.to_state && !states.includes(a.to_state)) {
      errors.push({ code: "actionUnknownToState", action: a.id, value: a.to_state });
    }
  }

  const invariantIds = new Set<string>();
  const invariantStatements = new Set<string>();
  for (const r of doc.invariants) {
    if (invariantIds.has(r.id)) {
      errors.push({ kind: "invariant", code: "duplicateInvariantId", value: r.id });
    }
    invariantIds.add(r.id);
    const statement = r.statement.trim();
    if (statement && invariantStatements.has(statement)) {
      errors.push({ kind: "invariant", code: "invariantDuplicateStatement", value: r.id });
    }
    invariantStatements.add(statement);
  }

  return errors;
}

/** Invariant violations are reported on their own, never mixed with schema errors. */
export function invariantViolations(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.kind === "invariant");
}

/** Blocking issues: everything except invariant violations. */
export function blockingIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.kind !== "invariant");
}
