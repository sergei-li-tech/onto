import type { Attribute, Entity, Ontology, Relationship } from "../types";
import { renameAttributeInEntity, uniqueAttributeId, uniqueEntityId } from "./autoIds";
import { coerceSnakeId } from "./ids";
import { renameRelationshipInDocument } from "./relationships";

export type OntologyOperation =
  | { op: "add_entity"; entity: Entity }
  | { op: "update_entity"; id: string; patch: Partial<Entity> }
  | { op: "remove_entity"; id: string }
  | { op: "add_attribute"; entity_id: string; attribute: Attribute }
  | { op: "update_attribute"; entity_id: string; attribute_id: string; patch: Partial<Attribute> }
  | { op: "remove_attribute"; entity_id: string; attribute_id: string }
  | { op: "add_relationship"; relationship: Relationship }
  | { op: "update_relationship"; id: string; patch: Partial<Relationship> };

function snakeAttributes(
  raw: Attribute[],
  primaryKey: string | undefined,
): { attributes: Attribute[]; primary_key: string } {
  const host: Entity = {
    id: "tmp",
    name: "tmp",
    attributes: [],
  };
  const aliases = new Map<string, string>();
  const attributes = raw.map((attr) => {
    const base = coerceSnakeId(attr.id, attr.name || "field", "field");
    const id = uniqueAttributeId(host, base);
    host.attributes.push({ ...attr, id });
    if (attr.id && attr.id !== id) aliases.set(attr.id, id);
    return { ...attr, id, name: attr.name?.trim() || "Field description." };
  });
  const mapped = primaryKey ? (aliases.get(primaryKey) ?? primaryKey) : undefined;
  const primary =
    mapped && attributes.some((attr) => attr.id === mapped)
      ? mapped
      : attributes.some((attr) => attr.id === "id")
        ? "id"
        : (attributes[0]?.id ?? "id");
  return { attributes, primary_key: primary };
}

function defaultEntity(
  entity: Partial<Entity>,
  taken: Entity[],
): { entity: Entity; rawId?: string } {
  const rawId = entity.id;
  const base = coerceSnakeId(rawId, entity.name ?? "entity", "entity");
  const id = uniqueEntityId(taken, base);
  const source = entity.attributes ?? [];
  const { attributes, primary_key } = snakeAttributes(source, entity.primary_key);
  return {
    rawId,
    entity: {
      id,
      name: entity.name ?? "New entity",
      aliases: entity.aliases ?? [],
      ...(attributes.length > 0 ? { primary_key } : {}),
      attributes,
      template_name: entity.template_name,
    },
  };
}

export function applyOperations(doc: Ontology, rawOps: unknown[]): Ontology {
  let next = structuredClone(doc);
  const entityAliases = new Map<string, string>();
  const resolveEntity = (id: string) => entityAliases.get(id) ?? id;

  for (const raw of rawOps) {
    if (!raw || typeof raw !== "object" || !("op" in raw)) continue;
    const op = raw as OntologyOperation;

    switch (op.op) {
      case "add_entity": {
        const built = defaultEntity((raw as { entity: Partial<Entity> }).entity, next.entities);
        if (next.entities.some((e) => e.id === built.entity.id)) continue;
        if (built.rawId && built.rawId !== built.entity.id) {
          entityAliases.set(built.rawId, built.entity.id);
        }
        next = { ...next, entities: [...next.entities, built.entity] };
        break;
      }
      case "update_entity": {
        const id = resolveEntity(op.id);
        next = {
          ...next,
          entities: next.entities.map((e) =>
            e.id === id ? { ...e, ...op.patch, id: e.id } : e,
          ),
        };
        break;
      }
      case "remove_entity": {
        const id = resolveEntity(op.id);
        next = {
          ...next,
          entities: next.entities.filter((e) => e.id !== id),
          relationships: next.relationships.filter((r) => r.from !== id && r.to !== id),
          actions: next.actions
            .filter((a) => a.entity !== id)
            .map((a) => (a.produces === id ? { ...a, produces: undefined } : a)),
        };
        break;
      }
      case "add_attribute": {
        const { entity_id, attribute } = raw as {
          op: "add_attribute";
          entity_id: string;
          attribute: Attribute;
        };
        const entityId = resolveEntity(entity_id);
        next = {
          ...next,
          entities: next.entities.map((e) => {
            if (e.id !== entityId) return e;
            const id = uniqueAttributeId(
              e,
              coerceSnakeId(attribute.id, attribute.name || "field", "field"),
            );
            if (e.attributes.some((a) => a.id === id)) return e;
            return {
              ...e,
              primary_key: e.primary_key || id,
              attributes: [
                ...e.attributes,
                { ...attribute, id, name: attribute.name?.trim() || "Field description." },
              ],
            };
          }),
        };
        break;
      }
      case "update_attribute": {
        const entityId = resolveEntity(op.entity_id);
        const { name: nextName, ...rest } = op.patch;
        next = {
          ...next,
          entities: next.entities.map((e) => {
            if (e.id !== entityId) return e;
            return {
              ...e,
              attributes: e.attributes.map((a) =>
                a.id === op.attribute_id ? { ...a, ...rest, id: a.id, name: a.name } : a,
              ),
            };
          }),
        };
        if (typeof nextName === "string" && nextName.trim()) {
          next = {
            ...next,
            entities: next.entities.map((e) =>
              e.id === entityId ? renameAttributeInEntity(e, op.attribute_id, nextName) : e,
            ),
          };
        }
        break;
      }
      case "remove_attribute": {
        const entityId = resolveEntity(op.entity_id);
        next = {
          ...next,
          entities: next.entities.map((e) => {
            if (e.id !== entityId) return e;
            if (op.attribute_id === e.primary_key) return e;
            return {
              ...e,
              attributes: e.attributes.filter((a) => a.id !== op.attribute_id),
            };
          }),
        };
        break;
      }
      case "add_relationship": {
        const rel = (raw as { relationship: Relationship }).relationship;
        const linked = {
          ...rel,
          from: resolveEntity(rel.from),
          to: resolveEntity(rel.to),
        };
        if (next.relationships.some((r) => r.id === linked.id)) break;
        next = { ...next, relationships: [...next.relationships, linked] };
        break;
      }
      case "update_relationship": {
        const current = next.relationships.find((r) => r.id === op.id);
        if (!current) break;
        const { name: nextName, ...rest } = op.patch;
        const patched = { ...current, ...rest, id: current.id, name: current.name };
        next = {
          ...next,
          relationships: next.relationships.map((r) => (r.id === op.id ? patched : r)),
        };
        if (typeof nextName === "string" && nextName.trim() && nextName.trim() !== current.name) {
          next = renameRelationshipInDocument(next, current.id, nextName).doc;
        }
        break;
      }
      default:
        break;
    }
  }

  return next;
}
