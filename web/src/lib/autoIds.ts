import type { Entity, Ontology } from "../types";
import { coerceSnakeId, isSnakeId, snakeIdFromText } from "./ids";

export function uniqueEntityId(entities: Entity[], base: string): string {
  let id = base.slice(0, 64);
  let n = 2;
  while (entities.some((e) => e.id === id)) {
    id = `${base.slice(0, 58)}_${n}`.slice(0, 64);
    n += 1;
  }
  return id;
}

export function uniqueAttributeId(entity: Entity, base: string): string {
  let id = base.slice(0, 64);
  let n = 2;
  while (entity.attributes.some((a) => a.id === id)) {
    id = `${base.slice(0, 58)}_${n}`.slice(0, 64);
    n += 1;
  }
  return id;
}

export function entityIdFromName(name: string, entities: Entity[]): string {
  const base = snakeIdFromText(name, "entity");
  return uniqueEntityId(entities, base);
}

export function attributeIdFromName(name: string, entity: Entity): string {
  const base = snakeIdFromText(name, "field");
  return uniqueAttributeId(entity, base);
}

/** New field name sets its id. primary_key moves along with it. */
export function renameAttributeInEntity(
  entity: Entity,
  attributeId: string,
  newName: string,
): Entity {
  const attr = entity.attributes.find((item) => item.id === attributeId);
  if (!attr) return entity;
  const trimmed = newName.trim();
  if (!trimmed || trimmed === attr.name) return entity;
  const newId = attributeIdFromName(trimmed, {
    ...entity,
    attributes: entity.attributes.filter((item) => item.id !== attributeId),
  });
  return {
    ...entity,
    primary_key: entity.primary_key === attributeId ? newId : entity.primary_key,
    attributes: entity.attributes.map((item) =>
      item.id === attributeId ? { ...item, id: newId, name: trimmed } : item,
    ),
  };
}

function uniqueTaken(taken: string[], base: string): string {
  let id = base.slice(0, 64).replace(/_+$/g, "") || "item";
  let n = 2;
  while (taken.includes(id)) {
    id = `${base.slice(0, 58)}_${n}`.slice(0, 64);
    n += 1;
  }
  return id;
}

/** Normalizes previously created hyphenated ids to match schema. */
export function repairOntologyIds(doc: Ontology): { doc: Ontology; aliases: Map<string, string> } {
  const aliases = new Map<string, string>();
  const taken: string[] = [];
  let changed = false;

  const entities = doc.entities.map((entity) => {
    const base = isSnakeId(entity.id)
      ? entity.id
      : coerceSnakeId(entity.id, entity.name, "entity");
    const id = uniqueTaken(taken, base);
    taken.push(id);
    if (id !== entity.id) {
      aliases.set(entity.id, id);
      changed = true;
    }

    const host: Entity = { ...entity, id, attributes: [] };
    const attrAliases = new Map<string, string>();
    const attributes = entity.attributes.map((attr) => {
      const attrBase = isSnakeId(attr.id)
        ? attr.id
        : coerceSnakeId(attr.id, attr.name || "field", "field");
      const attrId = uniqueTaken(
        host.attributes.map((item) => item.id),
        attrBase,
      );
      host.attributes.push({ ...attr, id: attrId });
      if (attrId !== attr.id) {
        attrAliases.set(attr.id, attrId);
        changed = true;
      }
      return { ...attr, id: attrId };
    });
    const primary = entity.primary_key
      ? (attrAliases.get(entity.primary_key) ?? entity.primary_key)
      : entity.primary_key;
    if (primary !== entity.primary_key) changed = true;
    return { ...entity, id, attributes, primary_key: primary };
  });

  const resolve = (id: string) => aliases.get(id) ?? id;
  const linkedEntities = entities.map((entity) => ({
    ...entity,
    attributes: entity.attributes.map((attr) => {
      if (!attr.entity || !aliases.has(attr.entity)) return attr;
      changed = true;
      return { ...attr, entity: resolve(attr.entity) };
    }),
  }));

  const relationships = doc.relationships.map((rel) => {
    const from = resolve(rel.from);
    const to = resolve(rel.to);
    if (from === rel.from && to === rel.to) return rel;
    changed = true;
    return { ...rel, from, to };
  });
  const actions = doc.actions.map((action) => {
    let actionChanged = false;
    let nextEntity = action.entity;
    let nextProduces = action.produces;
    if (nextEntity && aliases.has(nextEntity)) {
      nextEntity = resolve(nextEntity);
      actionChanged = true;
    }
    if (nextProduces && aliases.has(nextProduces)) {
      nextProduces = resolve(nextProduces);
      actionChanged = true;
    }
    if (!actionChanged) return action;
    changed = true;
    return { ...action, entity: nextEntity, produces: nextProduces };
  });
  const layout = doc.layout?.nodes
    ? {
        nodes: doc.layout.nodes.map((node) => {
          const id = resolve(node.id);
          if (id === node.id) return node;
          changed = true;
          return { ...node, id };
        }),
      }
    : doc.layout;

  if (!changed) return { doc, aliases };
  return {
    aliases,
    doc: { ...doc, entities: linkedEntities, relationships, actions, layout },
  };
}

/** When an entity id changes, update references across the document. */
export function rekeyEntityId(doc: Ontology, oldId: string, newId: string): Ontology {
  if (oldId === newId) return doc;
  return {
    ...doc,
    entities: doc.entities.map((e) => {
      const id = e.id === oldId ? newId : e.id;
      const attributes = e.attributes.map((attr) =>
        attr.entity === oldId ? { ...attr, entity: newId } : attr,
      );
      if (id === e.id && attributes.every((attr, index) => attr === e.attributes[index])) return e;
      return { ...e, id, attributes };
    }),
    relationships: doc.relationships.map((r) => ({
      ...r,
      from: r.from === oldId ? newId : r.from,
      to: r.to === oldId ? newId : r.to,
    })),
    actions: doc.actions.map((a) => {
      const nextEntity = a.entity === oldId ? newId : a.entity;
      const nextProduces = a.produces === oldId ? newId : a.produces;
      if (nextEntity === a.entity && nextProduces === a.produces) return a;
      return { ...a, entity: nextEntity, produces: nextProduces };
    }),
    layout: doc.layout
      ? {
          nodes: doc.layout.nodes?.map((n) =>
            n.id === oldId ? { ...n, id: newId } : n,
          ),
        }
      : doc.layout,
  };
}
