import { useEffect, useState } from "react";
import type { Entity, Ontology } from "../types";
import { useOntologyStore } from "../store";
import { EntityAssistant, RelationshipAssistant } from "./AiChatPanel";
import { CommaListInput } from "./CommaListInput";
import { NotesField } from "./NotesField";
import { EntityAttributesSection } from "./EntityAttributesSection";
import { InfoTip } from "./InfoTip";
import { editActionPhrase, setActionRule } from "../lib/sideLists";
import { useT } from "../i18n";

export function DetailPanel({ doc }: { doc: Ontology }) {
  const selection = useOntologyStore((s) => s.selection);
  const patchDoc = useOntologyStore((s) => s.patchDoc);
  const renameEntityName = useOntologyStore((s) => s.renameEntityName);
  const removeRelationship = useOntologyStore((s) => s.removeRelationship);
  const renameRelationshipName = useOntologyStore((s) => s.renameRelationshipName);
  const setSelection = useOntologyStore((s) => s.setSelection);
  const t = useT();

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

  const selectedActionId = selection?.kind === "action" ? selection.id : null;
  const selectedAction = selectedActionId
    ? doc.actions.find((a) => a.id === selectedActionId)
    : undefined;
  const [actionNameDraft, setActionNameDraft] = useState("");
  const [ruleDraft, setRuleDraft] = useState("");

  useEffect(() => {
    setActionNameDraft(selectedAction?.name ?? "");
  }, [selectedActionId, selectedAction?.name]);

  useEffect(() => {
    setRuleDraft(selectedAction?.rule ?? "");
  }, [selectedActionId, selectedAction?.rule]);

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
        <DetailHead
          title={t("detail.nothingSelected")}
          hint={t("detail.nothingSelectedHint")}
        />
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
          title={t("detail.selectedEntity", { name: entity.name })}
          hint={t("detail.entityCardHint")}
        />
        <div className="detail-body">
          <EntityAssistant doc={doc} entity={entity} />
          <section className="card-block">
            <h3 className="heading-with-info">
              {t("detail.entityName")}
              <InfoTip text={t("detail.entityNameInfo")} />
            </h3>
            <div className="field">
              <label htmlFor="entity-name">{t("detail.name")}</label>
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
              <label htmlFor="entity-unique-id">{t("detail.uniqueIdentifier")}</label>
              <input
                id="entity-unique-id"
                placeholder={t("detail.optional")}
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
              <p className="hint-text tech-only">
                {t("detail.templateWord", { name: entity.template_name })}
              </p>
            )}
            <div className="field tech-only">
              <label htmlFor="entity-aliases">{t("detail.aliases")}</label>
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
              label={t("sidebar.notes")}
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
              {t("detail.connectedTo")}
              <InfoTip text={t("detail.connectedToInfo")} />
            </h3>
            {related.length === 0 ? (
              <p className="hint-text">{t("detail.noRelationships")}</p>
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
            {t("detail.deleteEntity")}
          </button>
        </div>
      </aside>
    );
  }

  if (selection.kind === "action" && selectedAction) {
    const action = selectedAction;
    const entityName = action.entity
      ? (doc.entities.find((e) => e.id === action.entity)?.name ?? action.entity)
      : null;

    function commitActionName() {
      const trimmed = actionNameDraft.trim();
      if (!trimmed || trimmed === action.name) {
        setActionNameDraft(action.name);
        return;
      }
      let nextId = action.id;
      patchDoc((d) => {
        const actions = editActionPhrase(d.actions, action.id, trimmed);
        nextId = actions.find((item) => item.name === trimmed)?.id ?? action.id;
        return { ...d, actions };
      });
      if (nextId !== action.id) setSelection({ kind: "action", id: nextId });
    }

    return (
      <aside className="detail">
        <DetailHead
          title={t("detail.selectedAction", { name: action.name })}
          hint={t("detail.actionCardHint")}
        />
        <div className="detail-body">
          <section className="card-block">
            <h3 className="heading-with-info">
              {t("detail.actionName")}
              <InfoTip text={t("detail.actionNameInfo")} />
            </h3>
            <div className="field">
              <label htmlFor="action-name">{t("detail.name")}</label>
              <input
                id="action-name"
                value={actionNameDraft}
                onChange={(e) => setActionNameDraft(e.target.value)}
                onBlur={commitActionName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            </div>
            {entityName ? (
              <p className="hint-text tech-only">
                {t("detail.actionEntity", { name: entityName })}
              </p>
            ) : null}
            <div className="field">
              <label className="heading-with-info" htmlFor={`action-rule-${action.id}`}>
                {t("detail.rule")}
                <InfoTip text={t("detail.ruleInfo")} />
              </label>
              <textarea
                id={`action-rule-${action.id}`}
                rows={2}
                placeholder={t("detail.rulePlaceholder")}
                value={ruleDraft}
                onChange={(e) => setRuleDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = ruleDraft.trim();
                  if (trimmed === (action.rule ?? "")) {
                    setRuleDraft(action.rule ?? "");
                    return;
                  }
                  patchDoc((d) => ({
                    ...d,
                    actions: setActionRule(d.actions, action.id, trimmed),
                  }));
                }}
              />
              <p className="hint-text">{t("detail.ruleHint")}</p>
            </div>
          </section>
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
          title={t("detail.selectedRelationship")}
          hint={t("detail.relationshipHint")}
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
              <label htmlFor="rel-name">{t("detail.relationshipLabel")}</label>
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
              label={t("sidebar.notes")}
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
              {t("detail.deleteRelationship")}
            </button>
          </section>
        </div>
      </aside>
    );
  }

  return null;
}

function DetailHead({ title, hint }: { title: string; hint: string }) {
  const t = useT();
  return (
    <header className="detail-head">
      <p className="detail-kicker">{t("detail.kicker")}</p>
      <h2 className="heading-with-info">
        {title}
        <InfoTip text={hint} />
      </h2>
    </header>
  );
}

