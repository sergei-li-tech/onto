import type { Ontology } from "../types";
import { slugIdFromText } from "./ids";

/** Relationship id from endpoints and name: rel-from-name-to. */
export function relationshipIdFromName(
  from: string,
  name: string,
  to: string,
  taken: string[],
): string {
  const baseId = slugIdFromText(`${from}-${name}-${to}`, "rel");
  let id = baseId;
  let suffix = 2;
  while (taken.includes(id)) {
    id = `${baseId}-${suffix}`.slice(0, 64);
    suffix += 1;
  }
  return id;
}

/** New relationship name sets its id. */
export function renameRelationshipInDocument(
  doc: Ontology,
  relationshipId: string,
  newName: string,
): { doc: Ontology; id: string } {
  const rel = doc.relationships.find((item) => item.id === relationshipId);
  if (!rel) return { doc, id: relationshipId };
  const trimmed = newName.trim();
  if (!trimmed || trimmed === rel.name) return { doc, id: relationshipId };

  const newId = relationshipIdFromName(
    rel.from,
    trimmed,
    rel.to,
    doc.relationships.filter((item) => item.id !== relationshipId).map((item) => item.id),
  );
  return {
    id: newId,
    doc: {
      ...doc,
      relationships: doc.relationships.map((item) =>
        item.id === relationshipId ? { ...item, id: newId, name: trimmed } : item,
      ),
    },
  };
}
