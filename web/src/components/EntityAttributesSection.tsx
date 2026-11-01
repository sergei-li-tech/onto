import { useEffect, useState } from "react";
import type { Attribute, AttributeType, Entity, Ontology } from "../types";
import { CommaListInput } from "./CommaListInput";
import { InfoTip } from "./InfoTip";
import { attributeIdFromName, renameAttributeInEntity } from "../lib/autoIds";

const TYPE_LABELS: Record<AttributeType, string> = {
  string: "Text",
  integer: "Integer",
  decimal: "Decimal / Money",
  boolean: "Yes / No",
  date: "Date",
  datetime: "Date and time",
  enum: "State list (Enum)",
  ref: "Reference to entity",
};

type Props = {
  doc: Ontology;
  entity: Entity;
  patchEntity: (updater: (e: Entity) => Entity) => void;
};

function AttributeNameField({
  name,
  onCommit,
}: {
  name: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== name) onCommit(trimmed);
        else setDraft(name);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
    />
  );
}

export function EntityAttributesSection({ doc, entity, patchEntity }: Props) {
  function patchAttributes(mapper: (attrs: Attribute[]) => Attribute[]) {
    patchEntity((e) => ({ ...e, attributes: mapper(e.attributes) }));
  }

  function updateAttribute(attrId: string, patch: Partial<Attribute>) {
    patchAttributes((attrs) =>
      attrs.map((a) => (a.id === attrId ? { ...a, ...patch } : a)),
    );
  }

  function commitAttributeName(attrId: string, newName: string) {
    patchEntity((e) => renameAttributeInEntity(e, attrId, newName));
  }

  function removeAttribute(attrId: string) {
    if (attrId === entity.primary_key) return;
    patchAttributes((attrs) => attrs.filter((a) => a.id !== attrId));
  }

  function addAttribute() {
    const name = "Field description.";
    const id = attributeIdFromName(name, entity);
    patchEntity((e) => ({
      ...e,
      primary_key: e.primary_key || id,
      attributes: [
        ...e.attributes,
        {
          id,
          type: "string",
          name,
          required: false,
        },
      ],
    }));
  }

  return (
    <section className="card-block attributes-section">
      <h3 className="heading-with-info">
        Fields
        <InfoTip text="Fields of this entity." />
      </h3>

      {entity.attributes.map((attr) => (
        <div key={attr.id} className="attribute-card">
          <div className="field">
            <label>Type</label>
            <select
              value={attr.type}
              onChange={(e) => {
                const type = e.target.value as AttributeType;
                const extra: Partial<Attribute> = { type };
                if (type === "enum" && !attr.values?.length) extra.values = ["draft"];
                if (type === "ref" && !attr.entity) {
                  extra.entity = doc.entities.find((en) => en.id !== entity.id)?.id;
                }
                updateAttribute(attr.id, extra);
              }}
            >
              {(Object.keys(TYPE_LABELS) as AttributeType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Field name</label>
            <AttributeNameField
              name={attr.name}
              onCommit={(next) => commitAttributeName(attr.id, next)}
            />
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(attr.required)}
              onChange={(e) => updateAttribute(attr.id, { required: e.target.checked })}
            />
            Required field
          </label>

          {attr.type === "enum" && (
            <div className="field">
              <div className="heading-with-info">
                <label>States</label>
                <InfoTip text="Lifecycle stages, comma-separated." />
              </div>
              <CommaListInput
                value={attr.values ?? []}
                onCommit={(values) => updateAttribute(attr.id, { values })}
                placeholder="draft, confirmed, completed"
              />
            </div>
          )}

          {attr.type === "ref" && (
            <div className="field">
              <label>Entity</label>
              <select
                value={attr.entity ?? ""}
                onChange={(e) => updateAttribute(attr.id, { entity: e.target.value })}
              >
                <option value="">— select —</option>
                {doc.entities
                  .filter((en) => en.id !== entity.id)
                  .map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {attr.id !== entity.primary_key && (
            <button
              type="button"
              className="list-item attr-remove"
              onClick={() => removeAttribute(attr.id)}
            >
              Delete field
            </button>
          )}
        </div>
      ))}

      <button type="button" className="list-item card-action" onClick={addAttribute}>
        + Field
      </button>
    </section>
  );
}
