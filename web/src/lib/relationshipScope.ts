import type { Ontology } from "../types";

type OpRecord = Record<string, unknown>;

function asOp(raw: unknown): OpRecord | null {
  if (!raw || typeof raw !== "object" || !("op" in raw)) return null;
  return raw as OpRecord;
}

/** Keeps only the relationship name and cardinality for selected relationship. */
export function operationsInRelationshipScope(
  relationshipId: string,
  rawOps: unknown[],
): unknown[] {
  const kept: unknown[] = [];
  for (const raw of rawOps) {
    const op = asOp(raw);
    if (!op || op.op !== "update_relationship" || op.id !== relationshipId) continue;
    const patch = op.patch;
    if (!patch || typeof patch !== "object") continue;
    const source = patch as Record<string, unknown>;
    const nextPatch: Record<string, unknown> = {};
    if (typeof source.name === "string" && source.name.trim()) nextPatch.name = source.name;
    if (
      typeof source.cardinality === "string" ||
      (source.cardinality && typeof source.cardinality === "object")
    ) {
      nextPatch.cardinality = source.cardinality;
    }
    if (Object.keys(nextPatch).length === 0) continue;
    kept.push({ op: "update_relationship", id: relationshipId, patch: nextPatch });
  }
  return kept;
}

/** After changing relationship name, selection stays on the new id. */
export function relationshipIdAfterApply(
  before: Ontology,
  after: Ontology,
  relationshipId: string,
  rawOps: unknown[],
): string {
  if (after.relationships.some((item) => item.id === relationshipId)) return relationshipId;
  const current = before.relationships.find((item) => item.id === relationshipId);
  if (!current) return relationshipId;
  let name = current.name;
  for (const raw of rawOps) {
    const op = asOp(raw);
    const patch = op?.patch;
    const patchName =
      patch && typeof patch === "object" ? (patch as { name?: unknown }).name : undefined;
    if (
      op?.op === "update_relationship" &&
      op.id === relationshipId &&
      typeof patchName === "string" &&
      patchName.trim()
    ) {
      name = patchName.trim();
    }
  }
  return (
    after.relationships.find(
      (item) => item.from === current.from && item.to === current.to && item.name === name,
    )?.id ?? relationshipId
  );
}
