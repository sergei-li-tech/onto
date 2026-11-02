import type { Entity, Ontology } from "../types";
import { entityIdFromName, rekeyEntityId } from "./autoIds";

/** Standard rename on diagram (blur). Preserves previous name in template_name. */
export function renameEntityDisplayName(entity: Entity, newName: string): Entity {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === entity.name) return entity;

  const next: Entity = { ...entity, name: trimmed };
  if (!next.template_name && entity.name !== trimmed) {
    next.template_name = entity.name;
  }
  return next;
}

/** Business display name: client name + synonyms from template. */
export function applyBusinessDisplayName(entity: Entity, newName: string): Entity {
  const trimmed = newName.trim();
  if (!trimmed) return entity;

  const templateLabel = entity.template_name ?? entity.name;
  const next: Entity = {
    ...entity,
    name: trimmed,
    template_name: templateLabel === trimmed ? entity.template_name : templateLabel,
  };

  const aliases = new Set(next.aliases ?? []);
  if (entity.name !== trimmed) aliases.add(entity.name);
  if (templateLabel && templateLabel !== trimmed) aliases.add(templateLabel);
  for (const a of entity.aliases ?? []) {
    if (a !== trimmed) aliases.add(a);
  }
  next.aliases = [...aliases];
  return next;
}

/** New name sets id. Relationships, references, and position move along with it. */
export function renameEntityInDocument(
  doc: Ontology,
  entityId: string,
  newName: string,
  mode: "display" | "business",
): { doc: Ontology; id: string } {
  const entity = doc.entities.find((item) => item.id === entityId);
  if (!entity) return { doc, id: entityId };

  const renamed =
    mode === "business"
      ? applyBusinessDisplayName(entity, newName)
      : renameEntityDisplayName(entity, newName);
  if (renamed === entity) return { doc, id: entityId };

  const withName: Ontology = {
    ...doc,
    entities: doc.entities.map((item) => (item.id === entityId ? renamed : item)),
  };
  if (renamed.name === entity.name) return { doc: withName, id: entityId };

  const newId = entityIdFromName(
    renamed.name,
    withName.entities.filter((item) => item.id !== entityId),
  );
  if (newId === entityId) return { doc: withName, id: entityId };
  return { doc: rekeyEntityId(withName, entityId, newId), id: newId };
}

export function entityMatchesSearch(entity: Entity, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    entity.name,
    entity.template_name,
    ...(entity.aliases ?? []),
    entity.id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function forkStampFromTemplate(doc: Ontology, templateDomain: string, templateVersion: string): Ontology {
  return {
    ...doc,
    based_on: { id: templateDomain, version: templateVersion },
  };
}
