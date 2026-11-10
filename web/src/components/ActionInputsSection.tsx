import { useEffect, useState } from "react";
import type { Action, ActionInput, AttributeType, Ontology } from "../types";
import { CommaListInput } from "./CommaListInput";
import { InfoTip } from "./InfoTip";
import { useT } from "../i18n";

const TYPE_KEYS: Record<AttributeType, string> = {
  string: "type.string",
  integer: "type.integer",
  decimal: "type.decimal",
  boolean: "type.boolean",
  date: "type.date",
  datetime: "type.datetime",
  enum: "type.enum",
  ref: "type.ref",
};

type Props = {
  doc: Ontology;
  action: Action;
  patchAction: (updater: (a: Action) => Action) => void;
};

function uniqueInputName(existing: ActionInput[], base: string): string {
  let name = base;
  let counter = 2;
  const taken = new Set(existing.map((i) => i.name));
  while (taken.has(name)) {
    name = `${base}_${counter}`;
    counter += 1;
  }
  return name;
}

function ActionInputNameField({
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
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== name) onCommit(trimmed);
        else setDraft(name);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function ActionInputDescriptionField({
  description,
  onCommit,
  placeholder,
}: {
  description?: string;
  onCommit: (next?: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(description ?? "");

  useEffect(() => {
    setDraft(description ?? "");
  }, [description]);

  return (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed !== (description ?? "")) {
          onCommit(trimmed || undefined);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function ActionInputsSection({ doc, action, patchAction }: Props) {
  const t = useT();
  const inputs = action.inputs ?? [];

  function patchInputs(mapper: (items: ActionInput[]) => ActionInput[]) {
    patchAction((a) => {
      const next = mapper(a.inputs ?? []);
      return {
        ...a,
        inputs: next.length > 0 ? next : undefined,
      };
    });
  }

  function updateInput(index: number, patch: Partial<ActionInput>) {
    patchInputs((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function removeInput(index: number) {
    patchInputs((items) => items.filter((_, i) => i !== index));
  }

  function addInput() {
    const base = t("detail.actionInputDefaultName");
    const name = uniqueInputName(inputs, base);
    patchInputs((items) => [
      ...items,
      {
        name,
        type: "string",
        required: true,
      },
    ]);
  }

  return (
    <section className="card-block action-inputs-section">
      <h3 className="heading-with-info">
        {t("detail.actionInputs")}
        <InfoTip text={t("detail.actionInputsInfo")} />
      </h3>

      {inputs.map((input, index) => (
        <div key={`${index}-${input.name}`} className="attribute-card">
          <div className="field">
            <label>{t("detail.actionInputName")}</label>
            <ActionInputNameField
              name={input.name}
              onCommit={(next) => updateInput(index, { name: next })}
            />
          </div>

          <div className="field">
            <label>{t("attributes.type")}</label>
            <select
              value={input.type}
              onChange={(e) => {
                const type = e.target.value as AttributeType;
                const extra: Partial<ActionInput> = { type };
                if (type === "enum" && !input.values?.length) extra.values = ["default"];
                if (type === "ref" && !input.entity) {
                  extra.entity = doc.entities[0]?.id;
                }
                updateInput(index, extra);
              }}
            >
              {(Object.keys(TYPE_KEYS) as AttributeType[]).map((type) => (
                <option key={type} value={type}>
                  {t(TYPE_KEYS[type])}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>{t("detail.actionInputDescription")}</label>
            <ActionInputDescriptionField
              description={input.description}
              placeholder={t("detail.actionInputDescriptionPlaceholder")}
              onCommit={(desc) => updateInput(index, { description: desc })}
            />
          </div>

          <div className="checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={input.required ?? false}
                onChange={(e) => updateInput(index, { required: e.target.checked })}
              />
              {t("detail.actionInputRequired")}
            </label>
          </div>

          {input.type === "enum" && (
            <div className="field">
              <div className="heading-with-info">
                <label>{t("attributes.values")}</label>
                <InfoTip text={t("attributes.valuesInfo")} />
              </div>
              <CommaListInput
                value={input.values ?? []}
                onCommit={(values) => updateInput(index, { values })}
                placeholder={t("attributes.valuesPlaceholder")}
              />
            </div>
          )}

          {input.type === "ref" && (
            <div className="field">
              <label>{t("attributes.entity")}</label>
              <select
                value={input.entity ?? ""}
                onChange={(e) => updateInput(index, { entity: e.target.value })}
              >
                <option value="">{t("attributes.select")}</option>
                {doc.entities.map((en) => (
                  <option key={en.id} value={en.id}>
                    {en.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            className="list-item attr-remove"
            onClick={() => removeInput(index)}
          >
            {t("detail.deleteActionInput")}
          </button>
        </div>
      ))}

      <button type="button" className="list-item card-action" onClick={addInput}>
        {t("detail.addActionInput")}
      </button>
    </section>
  );
}

