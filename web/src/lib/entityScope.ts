import type { Ontology } from "../types";

type OpRecord = Record<string, unknown>;

function asOp(raw: unknown): OpRecord | null {
  if (!raw || typeof raw !== "object" || !("op" in raw)) return null;
  return raw as OpRecord;
}

function relationshipTouches(doc: Ontology, entityId: string, relationshipId: unknown): boolean {
  if (typeof relationshipId !== "string") return false;
  return doc.relationships.some(
    (r) => r.id === relationshipId && (r.from === entityId || r.to === entityId),
  );
}

/** Keeps only edits for the selected entity and its relationships. */
export function operationsInEntityScope(
  doc: Ontology,
  entityId: string,
  rawOps: unknown[],
): unknown[] {
  return rawOps.filter((raw) => {
    const op = asOp(raw);
    if (!op || typeof op.op !== "string") return false;

    switch (op.op) {
      case "update_entity":
        return op.id === entityId;
      case "add_attribute":
      case "update_attribute":
      case "remove_attribute":
        return op.entity_id === entityId;
      case "add_relationship": {
        const rel = op.relationship;
        if (!rel || typeof rel !== "object") return false;
        const link = rel as { from?: unknown; to?: unknown };
        return link.from === entityId || link.to === entityId;
      }
      case "update_relationship":
        return relationshipTouches(doc, entityId, op.id);
      default:
        return false;
    }
  });
}
