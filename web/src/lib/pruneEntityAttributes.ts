const BOILERPLATE = new Set([
  "unique",
  "identifier",
  "description",
  "required",
  "value",
  "string",
  "field",
  "fields",
  "attribute",
  "attributes",
  "property",
  "entity",
  "entities",
  "object",
  "objects",
]);

type AttrLike = {
  id?: string;
  name?: string;
  values?: string[];
};

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? [];
}

/** Field is kept only if its name or value is present in the request text. */
export function attributeNamedInRequest(
  message: string,
  entityName: string,
  entityId: string,
  attr: AttrLike,
): boolean {
  const messageTokens = new Set(tokens(message));
  const skip = new Set([...tokens(entityName), ...tokens(entityId.replaceAll("_", " "))]);
  const attrId = (attr.id ?? "").toLowerCase();
  if (attrId && attrId !== "id" && (messageTokens.has(attrId) || message.toLowerCase().includes(attrId))) {
    return true;
  }

  const named = [...tokens(attr.name ?? ""), ...(attr.values ?? []).flatMap((v) => tokens(v))];
  return named.some((tok) => !BOILERPLATE.has(tok) && !skip.has(tok) && messageTokens.has(tok));
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

/**
 * Strips properties from add_entity that were not explicitly requested by user.
 * Does the same for add_attribute on an entity created in the same response.
 */
export function pruneUnrequestedEntityAttributes(message: string, rawOps: unknown[]): unknown[] {
  const createdIds = new Set<string>();
  for (const raw of rawOps) {
    const op = asRecord(raw);
    if (op?.op !== "add_entity") continue;
    const entity = asRecord(op.entity);
    if (typeof entity?.id === "string") createdIds.add(entity.id);
  }

  return rawOps.map((raw) => {
    const op = asRecord(raw);
    if (!op) return raw;

    if (op.op === "add_entity") {
      const entity = asRecord(op.entity);
      if (!entity) return raw;
      const name = typeof entity.name === "string" ? entity.name : "";
      const id = typeof entity.id === "string" ? entity.id : "";
      const attributes = Array.isArray(entity.attributes) ? entity.attributes : [];
      const kept = attributes.filter((attr) => {
        const row = asRecord(attr);
        if (!row) return false;
        return attributeNamedInRequest(message, name, id, {
          id: row.id,
          name: typeof row.name === "string" ? row.name : undefined,
          values: Array.isArray(row.values) ? row.values.filter((v): v is string => typeof v === "string") : undefined,
        });
      });
      const primaryFromModel =
        typeof entity.primary_key === "string" &&
        kept.some((attr) => asRecord(attr)?.id === entity.primary_key)
          ? entity.primary_key
          : undefined;
      const primary = primaryFromModel;
      const nextEntity = { ...entity, attributes: kept };
      if (primary) nextEntity.primary_key = primary;
      else delete nextEntity.primary_key;
      return { ...op, entity: nextEntity };
    }

    if (op.op === "add_attribute" && typeof op.entity_id === "string" && createdIds.has(op.entity_id)) {
      const attribute = asRecord(op.attribute);
      if (!attribute) return null;
      const named = attributeNamedInRequest(message, "", op.entity_id, {
        id: typeof attribute.id === "string" ? attribute.id : undefined,
        name: typeof attribute.name === "string" ? attribute.name : undefined,
        values: Array.isArray(attribute.values)
          ? attribute.values.filter((v): v is string => typeof v === "string")
          : undefined,
      });
      return named ? raw : null;
    }

    return raw;
  }).filter((op) => op != null);
}
