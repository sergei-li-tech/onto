import { useEffect, useState } from "react";
import type { Entity, Ontology } from "../types";
import { useOntologyStore } from "../store";
import { EntityAssistant, RelationshipAssistant } from "./AiChatPanel";
import { CommaListInput } from "./CommaListInput";
import { NotesField } from "./NotesField";
import { EntityAttributesSection } from "./EntityAttributesSection";
import { InfoTip } from "./InfoTip";

export function DetailPanel({ doc }: { doc: Ontology }) {
  const selection = useOntologyStore((s) => s.selection);
  const patchDoc = useOntologyStore((s) => s.patchDoc);
  const renameEntityName = useOntologyStore((s) => s.renameEntityName);
  const removeRelationship = useOntologyStore((s) => s.removeRelationship);
  const renameRelationshipName = useOntologyStore((s) => s.renameRelationshipName);
  const setSelection = useOntologyStore((s) => s.setSelection);

  const [nameDraft, setNameDraft] = useState("");
  const [uniqueIdDraft, setUniqueIdDraft] = useState("");
  const [relNameDraft, setRelNameDraft] = useState("");

  const selectedEntityId =
    selection?.kind === "entity" ? selection.id : null;
  const selectedEntity = selectedEntityId
    ? doc.entities.find((e) => e.id === selectedEntityId)
    : undefined;

  const selectedRelId = selection?.kind === "relationship" ? selection.id : null;
  const selectedRelName = selectedRelId
    ? doc.relationships.find((r) => r.id === selectedRelId)?.name
    : undefined;

  useEffect(() => {
    setNameDraft(selectedEntity?.name ?? "");
  }, [selectedEntityId, selectedEntity?.name]);

  useEffect(() => {
    setUniqueIdDraft(selectedEntity?.unique_identifier ?? "");
  }, [selectedEntityId, selectedEntity?.unique_identifier]);

  useEffect(() => {
    setRelNameDraft(selectedRelName ?? "");
  }, [selectedRelId, selectedRelName]);

  if (!selection) {
    return (
      <aside className="detail">
        <DetailHead title="Nothing selected" hint="Select an entity on the diagram or from the list on the left." />
      </aside>
    );
  }

  if (selection.kind === "entity" && selectedEntity) {
    const entity = selectedEntity;
    const related = doc.relationships.filter(
      (r) => r.from === entity.id || r.to === entity.id,
    );

    function patchEntity(updater: (e: Entity) => Entity) {
      patchDoc((d) => ({
        ...d,
        entities: d.entities.map((en) => (en.id === entity.id ? updater(en) : en)),
      }));
    }

    return (
      <aside className="detail">
        <DetailHead
          title={`Selected: ${entity.name}`}
          hint="Entity card on the diagram: name, fields, and relationships."
        />
        <div className="detail-body">
          <EntityAssistant doc={doc} entity={entity} />
          <section className="card-block">
            <h3 className="heading-with-info">
              Entity name
              <InfoTip text="Label on the diagram. To change it, type a new name and click outside the field." />
            </h3>
            <div className="field">
              <label htmlFor="entity-name">Name</label>
              <input
                id="entity-name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  if (nameDraft.trim() && nameDraft.trim() !== entity.name) {
                    renameEntityName(entity.id, nameDraft);
                  } else {
                    setNameDraft(entity.name);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="entity-unique-id">Unique identifier</label>
              <input
                id="entity-unique-id"
                placeholder="Optional"
                value={uniqueIdDraft}
                onChange={(e) => setUniqueIdDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = uniqueIdDraft.trim();
                  const prev = entity.unique_identifier?.trim() ?? "";
                  if (trimmed === prev) {
                    setUniqueIdDraft(entity.unique_identifier ?? "");
                    return;
                  }
                  patchEntity((en) => ({
                    ...en,
                    unique_identifier: trimmed ? trimmed : undefined,
                  }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            </div>
            {entity.template_name && (
              <p className="hint-text tech-only">Template word: {entity.template_name}</p>
            )}
            <div className="field tech-only">
              <label htmlFor="entity-aliases">Aliases (comma-separated)</label>
              <CommaListInput
                id="entity-aliases"
                value={entity.aliases ?? []}
                onCommit={(aliases) =>
                  patchDoc((d) => ({
                    ...d,
                    entities: d.entities.map((en) =>
                      en.id === entity.id ? { ...en, aliases } : en,
                    ),
                  }))
                }
              />
            </div>
            <NotesField
              id={`entity-notes-${entity.id}`}
              label="Notes"
              labelClassName=""
              notes={entity.notes ?? ""}
              onCommit={(notes) =>
                patchEntity((en) => ({
                  ...en,
                  notes: notes.trim() ? notes : undefined,
                }))
              }
            />
          </section>

          <EntityAttributesSection doc={doc} entity={entity} patchEntity={patchEntity} />

          <section className="card-block">
            <h3 className="heading-with-info">
              Connected to
              <InfoTip text="New relationship: drag from one entity's handle to another on the diagram." />
            </h3>
            {related.length === 0 ? (
              <p className="hint-text">No relationships.</p>
            ) : (
              <ul className="link-list">
                {related.map((r) => {
                  const fromName = doc.entities.find((e) => e.id === r.from)?.name ?? r.from;
                  const toName = doc.entities.find((e) => e.id === r.to)?.name ?? r.to;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="list-item link-row"
                        onClick={() => setSelection({ kind: "relationship", id: r.id })}
                      >
                        <span>
                          {fromName} → {toName}
                        </span>
                        <span className="link-verb">{r.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <button
            type="button"
            className="list-item tech-only attr-remove"
            onClick={() => {
              patchDoc((d) => ({
                ...d,
                entities: d.entities.filter((e) => e.id !== entity.id),
                relationships: d.relationships.filter(
                  (r) => r.from !== entity.id && r.to !== entity.id,
                ),
                actions: d.actions.filter((a) => a.entity !== entity.id),
              }));
              setSelection(null);
            }}
          >
            Delete entity
          </button>
        </div>
      </aside>
    );
  }

  if (selection.kind === "relationship") {
    const rel = doc.relationships.find((r) => r.id === selection.id);
    if (!rel) return null;
    const fromName = doc.entities.find((e) => e.id === rel.from)?.name ?? rel.from;
    const toName = doc.entities.find((e) => e.id === rel.to)?.name ?? rel.to;
    return (
      <aside className="detail">
        <DetailHead
          title="Selected: relationship"
          hint="How two entities relate to each other."
        />
        <div className="detail-body">
          <RelationshipAssistant
            doc={doc}
            relationshipId={rel.id}
            name={rel.name}
            fromName={fromName}
            toName={toName}
          />
          <section className="card-block">
            <h3>
              {fromName} → {toName}
            </h3>
            <div className="field">
              <label htmlFor="rel-name">Relationship label</label>
              <input
                id="rel-name"
                value={relNameDraft}
                onChange={(e) => setRelNameDraft(e.target.value)}
                onBlur={() => {
                  if (relNameDraft.trim() && relNameDraft.trim() !== rel.name) {
                    renameRelationshipName(rel.id, relNameDraft);
                  } else {
                    setRelNameDraft(rel.name);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            </div>
            <NotesField
              id={`rel-notes-${rel.id}`}
              label="Notes"
              labelClassName=""
              notes={rel.notes ?? ""}
              onCommit={(notes) =>
                patchDoc((d) => ({
                  ...d,
                  relationships: d.relationships.map((r) =>
                    r.id === rel.id
                      ? { ...r, notes: notes.trim() ? notes : undefined }
                      : r,
                  ),
                }))
              }
            />
            <button
              type="button"
              className="list-item tech-only attr-remove"
              onClick={() => removeRelationship(rel.id)}
            >
              Delete relationship
            </button>
          </section>
        </div>
      </aside>
    );
  }

  return null;
}

function DetailHead({ title, hint }: { title: string; hint: string }) {
  return (
    <header className="detail-head">
      <p className="detail-kicker">Details</p>
      <h2 className="heading-with-info">
        {title}
        <InfoTip text={hint} />
      </h2>
    </header>
  );
}

