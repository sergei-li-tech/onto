import { useEffect, useState } from "react";
import type { Entity, InvariantSourceType, Ontology, Relationship, RiskLevel } from "../types";
import { useOntologyStore } from "../store";
import { EntityAssistant, RelationshipAssistant } from "./AiChatPanel";
import { CommaListInput } from "./CommaListInput";
import { NotesField } from "./NotesField";
import { EntityAttributesSection } from "./EntityAttributesSection";
import { ActionInputsSection } from "./ActionInputsSection";
import { InfoTip } from "./InfoTip";
import { editActionPhrase, setActionRule } from "../lib/sideLists";
import { ActionTechnicalMappingCard, EntityTechnicalMappingCard } from "./TechnicalMappingDetail";
import {
  CARDINALITY_PRESETS,
  formatCardinalitySpec,
  getRelationshipBounds,
  isCardinalityBoundValid,
  normalizeBound,
} from "../lib/cardinality";
import { useT } from "../i18n";

export function DetailPanel({ doc }: { doc: Ontology }) {
  const selection = useOntologyStore((s) => s.selection);
  const patchDoc = useOntologyStore((s) => s.patchDoc);
  const renameEntityName = useOntologyStore((s) => s.renameEntityName);
  const removeEntity = useOntologyStore((s) => s.removeEntity);
  const removeRelationship = useOntologyStore((s) => s.removeRelationship);
  const removeInvariant = useOntologyStore((s) => s.removeInvariant);
  const removeAction = useOntologyStore((s) => s.removeAction);
  const renameRelationshipName = useOntologyStore((s) => s.renameRelationshipName);
  const setSelection = useOntologyStore((s) => s.setSelection);
  const viewMode = useOntologyStore((s) => s.viewMode);
  const t = useT();

  const [nameDraft, setNameDraft] = useState("");
  const [uniqueIdDraft, setUniqueIdDraft] = useState("");
  const [relNameDraft, setRelNameDraft] = useState("");
  const [fromMinDraft, setFromMinDraft] = useState("");
  const [fromMaxDraft, setFromMaxDraft] = useState("");
  const [toMinDraft, setToMinDraft] = useState("");
  const [toMaxDraft, setToMaxDraft] = useState("");
  const [invStatementDraft, setInvStatementDraft] = useState("");
  const [invSourceDraft, setInvSourceDraft] = useState("");

  const selectedEntityId =
    selection?.kind === "entity" ? selection.id : null;
  const selectedEntity = selectedEntityId
    ? doc.entities.find((e) => e.id === selectedEntityId)
    : undefined;

  const selectedRelId = selection?.kind === "relationship" ? selection.id : null;
  const selectedRel = selectedRelId
    ? doc.relationships.find((r) => r.id === selectedRelId)
    : undefined;
  const selectedRelName = selectedRel?.name;

  const selectedActionId = selection?.kind === "action" ? selection.id : null;
  const selectedAction = selectedActionId
    ? doc.actions.find((a) => a.id === selectedActionId)
    : undefined;

  const selectedInvariantId = selection?.kind === "invariant" ? selection.id : null;
  const selectedInvariant = selectedInvariantId
    ? doc.invariants.find((i) => i.id === selectedInvariantId)
    : undefined;

  const [actionNameDraft, setActionNameDraft] = useState("");
  const [ruleDraft, setRuleDraft] = useState("");
  const [warningPromptDraft, setWarningPromptDraft] = useState("");

  useEffect(() => {
    setActionNameDraft(selectedAction?.name ?? "");
  }, [selectedActionId, selectedAction?.name]);

  useEffect(() => {
    setRuleDraft(selectedAction?.rule ?? "");
  }, [selectedActionId, selectedAction?.rule]);

  useEffect(() => {
    setWarningPromptDraft(selectedAction?.warning_prompt ?? "");
  }, [selectedActionId, selectedAction?.warning_prompt]);

  useEffect(() => {
    setNameDraft(selectedEntity?.name ?? "");
  }, [selectedEntityId, selectedEntity?.name]);

  useEffect(() => {
    setUniqueIdDraft(selectedEntity?.unique_identifier ?? "");
  }, [selectedEntityId, selectedEntity?.unique_identifier]);

  useEffect(() => {
    setRelNameDraft(selectedRelName ?? "");
  }, [selectedRelId, selectedRelName]);

  useEffect(() => {
    if (selectedRel) {
      const bounds = getRelationshipBounds(selectedRel.cardinality);
      setFromMinDraft(bounds.from_min);
      setFromMaxDraft(bounds.from_max);
      setToMinDraft(bounds.to_min);
      setToMaxDraft(bounds.to_max);
    } else {
      setFromMinDraft("1");
      setFromMaxDraft("1");
      setToMinDraft("0");
      setToMaxDraft("*");
    }
  }, [selectedRelId, selectedRel?.cardinality]);

  useEffect(() => {
    setInvStatementDraft(selectedInvariant?.statement ?? "");
  }, [selectedInvariantId, selectedInvariant?.statement]);

  useEffect(() => {
    setInvSourceDraft(selectedInvariant?.source ?? "");
  }, [selectedInvariantId, selectedInvariant?.source]);

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

    if (viewMode === "technical") {
      return (
        <aside className="detail">
          <DetailHead
            title={t("mapping.entityMapping", { name: entity.name })}
            hint={t("mapping.title")}
          />
          <div className="detail-body">
            <EntityTechnicalMappingCard doc={doc} entity={entity} />
          </div>
        </aside>
      );
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
            onClick={() => removeEntity(entity.id)}
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

    function patchAction(updater: (a: Action) => Action) {
      patchDoc((d) => ({
        ...d,
        actions: d.actions.map((a) => (a.id === action.id ? updater(a) : a)),
      }));
    }

    if (viewMode === "technical") {
      return (
        <aside className="detail">
          <DetailHead
            title={t("mapping.actionMapping", { name: action.name })}
            hint={t("mapping.title")}
          />
          <div className="detail-body">
            <ActionTechnicalMappingCard doc={doc} action={action} />
          </div>
        </aside>
      );
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
              <div className="heading-with-info">
                <label htmlFor="action-produces">{t("detail.actionProduces")}</label>
                <InfoTip text={t("detail.actionProducesInfo")} />
              </div>
              <select
                id="action-produces"
                value={action.produces ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  patchDoc((d) => ({
                    ...d,
                    actions: d.actions.map((a) =>
                      a.id === action.id
                        ? { ...a, produces: val ? val : undefined }
                        : a,
                    ),
                  }));
                }}
              >
                <option value="">{t("detail.actionProducesNone")}</option>
                {doc.entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
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

            <div className="field">
              <label htmlFor="action-risk-level">{t("detail.actionRiskLevel")}</label>
              <select
                id="action-risk-level"
                value={action.risk_level ?? ""}
                onChange={(e) => {
                  const val = e.target.value as RiskLevel | "";
                  patchDoc((d) => ({
                    ...d,
                    actions: d.actions.map((a) =>
                      a.id === action.id
                        ? { ...a, risk_level: val ? val : undefined }
                        : a,
                    ),
                  }));
                }}
              >
                <option value="">{t("detail.riskNone")}</option>
                <option value="LOW">{t("detail.riskLow")}</option>
                <option value="MEDIUM">{t("detail.riskMedium")}</option>
                <option value="HIGH">{t("detail.riskHigh")}</option>
              </select>
            </div>

            <div className="checkbox-row">
              <label htmlFor={`action-confirm-${action.id}`}>
                <input
                  id={`action-confirm-${action.id}`}
                  type="checkbox"
                  checked={Boolean(action.requires_confirmation)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    patchDoc((d) => ({
                      ...d,
                      actions: d.actions.map((a) =>
                        a.id === action.id
                          ? { ...a, requires_confirmation: checked ? true : undefined }
                          : a,
                      ),
                    }));
                  }}
                />
                <span className="heading-with-info">
                  {t("detail.actionRequiresConfirmation")}
                  <InfoTip text={t("detail.actionRequiresConfirmationInfo")} />
                </span>
              </label>
            </div>

            {action.requires_confirmation ? (
              <div className="field">
                <div className="heading-with-info">
                  <label htmlFor={`action-warning-${action.id}`}>
                    {t("detail.actionWarningPrompt")}
                  </label>
                  <InfoTip text={t("detail.actionWarningPromptInfo")} />
                </div>
                <input
                  id={`action-warning-${action.id}`}
                  placeholder={t("detail.actionWarningPromptPlaceholder")}
                  value={warningPromptDraft}
                  onChange={(e) => setWarningPromptDraft(e.target.value)}
                  onBlur={() => {
                    const trimmed = warningPromptDraft.trim();
                    patchDoc((d) => ({
                      ...d,
                      actions: d.actions.map((a) =>
                        a.id === action.id
                          ? { ...a, warning_prompt: trimmed ? trimmed : undefined }
                          : a,
                      ),
                    }));
                  }}
                />
              </div>
            ) : null}

            <div className="field">
              <div className="heading-with-info">
                <label htmlFor={`action-roles-${action.id}`}>
                  {t("detail.actionRolesAllowed")}
                </label>
                <InfoTip text={t("detail.actionRolesAllowedInfo")} />
              </div>
              <CommaListInput
                id={`action-roles-${action.id}`}
                placeholder={t("detail.actionRolesAllowedPlaceholder")}
                value={action.roles_allowed ?? []}
                onCommit={(roles) => {
                  patchDoc((d) => ({
                    ...d,
                    actions: d.actions.map((a) =>
                      a.id === action.id
                        ? { ...a, roles_allowed: roles.length > 0 ? roles : undefined }
                        : a,
                    ),
                  }));
                }}
              />
            </div>

            <button
              type="button"
              className="list-item tech-only attr-remove"
              onClick={() => removeAction(action.id)}
            >
              {t("detail.deleteAction")}
            </button>
          </section>

          <ActionInputsSection doc={doc} action={action} patchAction={patchAction} />
        </div>
      </aside>
    );
  }

  if (selection.kind === "relationship") {
    const rel = doc.relationships.find((r) => r.id === selection.id);
    if (!rel) return null;
    const fromName = doc.entities.find((e) => e.id === rel.from)?.name ?? rel.from;
    const toName = doc.entities.find((e) => e.id === rel.to)?.name ?? rel.to;
    const bounds = getRelationshipBounds(rel.cardinality);
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

            <div className="cardinality-group">
              <label className="group-label">
                {t("detail.cardinalitySource", { name: fromName })}
              </label>
              <div className="cardinality-presets">
                {CARDINALITY_PRESETS.map((p) => {
                  const active = bounds.from_min === p.min && bounds.from_max === p.max;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      className={`cardinality-preset-btn ${active ? "active" : ""}`}
                      onClick={() =>
                        patchDoc((d) => ({
                          ...d,
                          relationships: d.relationships.map((r) =>
                            r.id === rel.id
                              ? {
                                  ...r,
                                  cardinality: formatCardinalitySpec(
                                    p.min,
                                    p.max,
                                    bounds.to_min,
                                    bounds.to_max,
                                  ),
                                }
                              : r,
                          ),
                        }))
                      }
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="cardinality-inputs">
                <div className="field">
                  <label htmlFor={`rel-from-min-${rel.id}`}>{t("detail.cardinalityMin")}</label>
                  <input
                    id={`rel-from-min-${rel.id}`}
                    value={fromMinDraft}
                    onChange={(e) => setFromMinDraft(e.target.value)}
                    onBlur={() => {
                      const val = fromMinDraft.trim();
                      if (val && isCardinalityBoundValid(val)) {
                        patchDoc((d) => ({
                          ...d,
                          relationships: d.relationships.map((r) =>
                            r.id === rel.id
                              ? {
                                  ...r,
                                  cardinality: formatCardinalitySpec(
                                    val,
                                    bounds.from_max,
                                    bounds.to_min,
                                    bounds.to_max,
                                  ),
                                }
                              : r,
                          ),
                        }));
                      } else {
                        setFromMinDraft(bounds.from_min);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                </div>
                <span className="cardinality-separator">..</span>
                <div className="field">
                  <label htmlFor={`rel-from-max-${rel.id}`}>{t("detail.cardinalityMax")}</label>
                  <input
                    id={`rel-from-max-${rel.id}`}
                    value={fromMaxDraft}
                    onChange={(e) => setFromMaxDraft(e.target.value)}
                    onBlur={() => {
                      const val = fromMaxDraft.trim();
                      if (val && isCardinalityBoundValid(val)) {
                        patchDoc((d) => ({
                          ...d,
                          relationships: d.relationships.map((r) =>
                            r.id === rel.id
                              ? {
                                  ...r,
                                  cardinality: formatCardinalitySpec(
                                    bounds.from_min,
                                    val,
                                    bounds.to_min,
                                    bounds.to_max,
                                  ),
                                }
                              : r,
                          ),
                        }));
                      } else {
                        setFromMaxDraft(bounds.from_max);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="cardinality-group">
              <label className="group-label">
                {t("detail.cardinalityTarget", { name: toName })}
              </label>
              <div className="cardinality-presets">
                {CARDINALITY_PRESETS.map((p) => {
                  const active = bounds.to_min === p.min && bounds.to_max === p.max;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      className={`cardinality-preset-btn ${active ? "active" : ""}`}
                      onClick={() =>
                        patchDoc((d) => ({
                          ...d,
                          relationships: d.relationships.map((r) =>
                            r.id === rel.id
                              ? {
                                  ...r,
                                  cardinality: formatCardinalitySpec(
                                    bounds.from_min,
                                    bounds.from_max,
                                    p.min,
                                    p.max,
                                  ),
                                }
                              : r,
                          ),
                        }))
                      }
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="cardinality-inputs">
                <div className="field">
                  <label htmlFor={`rel-to-min-${rel.id}`}>{t("detail.cardinalityMin")}</label>
                  <input
                    id={`rel-to-min-${rel.id}`}
                    value={toMinDraft}
                    onChange={(e) => setToMinDraft(e.target.value)}
                    onBlur={() => {
                      const val = toMinDraft.trim();
                      if (val && isCardinalityBoundValid(val)) {
                        patchDoc((d) => ({
                          ...d,
                          relationships: d.relationships.map((r) =>
                            r.id === rel.id
                              ? {
                                  ...r,
                                  cardinality: formatCardinalitySpec(
                                    bounds.from_min,
                                    bounds.from_max,
                                    val,
                                    bounds.to_max,
                                  ),
                                }
                              : r,
                          ),
                        }));
                      } else {
                        setToMinDraft(bounds.to_min);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                </div>
                <span className="cardinality-separator">..</span>
                <div className="field">
                  <label htmlFor={`rel-to-max-${rel.id}`}>{t("detail.cardinalityMax")}</label>
                  <input
                    id={`rel-to-max-${rel.id}`}
                    value={toMaxDraft}
                    onChange={(e) => setToMaxDraft(e.target.value)}
                    onBlur={() => {
                      const val = toMaxDraft.trim();
                      if (val && isCardinalityBoundValid(val)) {
                        patchDoc((d) => ({
                          ...d,
                          relationships: d.relationships.map((r) =>
                            r.id === rel.id
                              ? {
                                  ...r,
                                  cardinality: formatCardinalitySpec(
                                    bounds.from_min,
                                    bounds.from_max,
                                    bounds.to_min,
                                    val,
                                  ),
                                }
                              : r,
                          ),
                        }));
                      } else {
                        setToMaxDraft(bounds.to_max);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                </div>
              </div>
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

  if (selection.kind === "invariant" && selectedInvariant) {
    const inv = selectedInvariant;
    return (
      <aside className="detail">
        <DetailHead
          title={t("detail.selectedInvariant")}
          hint={t("detail.invariantCardHint")}
        />
        <div className="detail-body">
          <section className="card-block">
            <div className="field">
              <label htmlFor="inv-statement">{t("detail.invariantStatement")}</label>
              <textarea
                id="inv-statement"
                rows={3}
                value={invStatementDraft}
                onChange={(e) => setInvStatementDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = invStatementDraft.trim();
                  if (trimmed && trimmed !== inv.statement) {
                    patchDoc((d) => ({
                      ...d,
                      invariants: d.invariants.map((i) =>
                        i.id === inv.id ? { ...i, statement: trimmed } : i,
                      ),
                    }));
                  } else {
                    setInvStatementDraft(inv.statement);
                  }
                }}
              />
            </div>

            <div className="field">
              <div className="heading-with-info">
                <label htmlFor="inv-source">{t("detail.invariantSource")}</label>
                <InfoTip text={t("detail.invariantSourceInfo")} />
              </div>
              <input
                id="inv-source"
                placeholder={t("detail.invariantSourcePlaceholder")}
                value={invSourceDraft}
                onChange={(e) => setInvSourceDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = invSourceDraft.trim();
                  patchDoc((d) => ({
                    ...d,
                    invariants: d.invariants.map((i) =>
                      i.id === inv.id
                        ? { ...i, source: trimmed ? trimmed : undefined }
                        : i,
                    ),
                  }));
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="inv-source-type">{t("detail.invariantSourceType")}</label>
              <select
                id="inv-source-type"
                value={inv.source_type ?? ""}
                onChange={(e) => {
                  const val = e.target.value as InvariantSourceType | "";
                  patchDoc((d) => ({
                    ...d,
                    invariants: d.invariants.map((i) =>
                      i.id === inv.id
                        ? { ...i, source_type: val ? val : undefined }
                        : i,
                    ),
                  }));
                }}
              >
                <option value="">{t("detail.sourceTypeNone")}</option>
                <option value="doc">{t("detail.sourceTypeDoc")}</option>
                <option value="call">{t("detail.sourceTypeCall")}</option>
                <option value="legal">{t("detail.sourceTypeLegal")}</option>
                <option value="system">{t("detail.sourceTypeSystem")}</option>
                <option value="other">{t("detail.sourceTypeOther")}</option>
              </select>
            </div>

            <div className="field">
              <div className="heading-with-info">
                <label htmlFor="inv-checked-at">{t("detail.invariantCheckedAt")}</label>
                <InfoTip text={t("detail.invariantCheckedAtInfo")} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  id="inv-checked-at"
                  type="date"
                  value={inv.checked_at ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    patchDoc((d) => ({
                      ...d,
                      invariants: d.invariants.map((i) =>
                        i.id === inv.id
                          ? { ...i, checked_at: val ? val : undefined }
                          : i,
                      ),
                    }));
                  }}
                />
                <button
                  type="button"
                  style={{
                    padding: "6px 10px",
                    fontSize: "0.8rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    background: "#fff",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    patchDoc((d) => ({
                      ...d,
                      invariants: d.invariants.map((i) =>
                        i.id === inv.id ? { ...i, checked_at: today } : i,
                      ),
                    }));
                  }}
                >
                  {t("detail.setToday")}
                </button>
              </div>
            </div>

            <button
              type="button"
              className="list-item tech-only attr-remove"
              onClick={() => removeInvariant(inv.id)}
            >
              {t("detail.deleteInvariant")}
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

