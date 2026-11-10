import { useEffect, useState } from "react";
import type { Ontology } from "../types";
import { CollapsibleSidebarSection } from "./CollapsibleSidebarSection";
import { NotesField } from "./NotesField";
import { NotesSummary } from "./NotesSummary";
import {
  addActionPhrase,
  addInvariantPhrase,
  addPhrase,
  editActionPhrase,
  editInvariantPhrase,
  editPhrase,
  removeAction,
  removeInvariant,
  removePhrase,
} from "../lib/sideLists";
import { useT } from "../i18n";
import { useOntologyStore } from "../store";

export function SideLists({ doc }: { doc: Ontology }) {
  const patchDoc = useOntologyStore((s) => s.patchDoc);
  const selection = useOntologyStore((s) => s.selection);
  const setSelection = useOntologyStore((s) => s.setSelection);
  const t = useT();

  return (
    <>
      <NotesSummary doc={doc} />
      <CollapsibleSidebarSection title={t("sidebar.notes")} defaultOpen>
        <NotesField
          id="doc-notes"
          label={t("sidebar.notesText")}
          labelClassName="sidebar-field-label"
          notes={doc.notes}
          onCommit={(notes) => patchDoc((d) => ({ ...d, notes }))}
        />
      </CollapsibleSidebarSection>
      <section>
        <div className="section-title">{t("sidebar.invariants")}</div>
        <p className="hint-text">{t("sidebar.invariantsHint")}</p>
        <PhraseList
          hideTitle
          title={t("sidebar.invariants")}
          placeholder={t("sidebar.invariantsPlaceholder")}
          phrases={doc.invariants.map((invariant) => {
            const metaParts = [];
            if (invariant.source) metaParts.push(invariant.source);
            if (invariant.checked_at) metaParts.push(invariant.checked_at);
            return {
              key: invariant.id,
              text: invariant.statement,
              note: metaParts.length > 0 ? metaParts.join(" · ") : undefined,
            };
          })}
          selectedKey={selection?.kind === "invariant" ? selection.id : null}
          onSelect={(key) => setSelection({ kind: "invariant", id: key })}
          onAdd={(phrase) =>
            patchDoc((d) => ({
              ...d,
              invariants: addInvariantPhrase(d.invariants, phrase),
            }))
          }
          onEdit={(key, phrase) =>
            patchDoc((d) => ({
              ...d,
              invariants: editInvariantPhrase(d.invariants, key, phrase),
            }))
          }
          onRemove={(key) =>
            patchDoc((d) => ({ ...d, invariants: removeInvariant(d.invariants, key) }))
          }
        />
      </section>
      <PhraseList
        title={t("sidebar.actions")}
        placeholder={t("sidebar.actionsPlaceholder")}
        phrases={doc.actions.map((action) => {
          const badges: string[] = [];
          if (action.risk_level) badges.push(action.risk_level);
          if (action.requires_confirmation) badges.push("HITL");
          if (action.roles_allowed?.length) badges.push(action.roles_allowed.join(", "));
          if (action.rule) badges.push(action.rule);
          return {
            key: action.id,
            text: action.name,
            note: badges.length > 0 ? badges.join(" · ") : undefined,
          };
        })}
        selectedKey={selection?.kind === "action" ? selection.id : null}
        onSelect={(key) => setSelection({ kind: "action", id: key })}
        onAdd={(phrase) =>
          patchDoc((d) => ({ ...d, actions: addActionPhrase(d.actions, phrase) }))
        }
        onEdit={(key, phrase) =>
          patchDoc((d) => ({ ...d, actions: editActionPhrase(d.actions, key, phrase) }))
        }
        onRemove={(key) => patchDoc((d) => ({ ...d, actions: removeAction(d.actions, key) }))}
      />
      <PhraseList
        title={t("sidebar.openQuestions")}
        placeholder={t("sidebar.openQuestionsPlaceholder")}
        phrases={doc.open_questions.map((text, index) => ({ key: String(index), text }))}
        onAdd={(phrase) =>
          patchDoc((d) => ({ ...d, open_questions: addPhrase(d.open_questions, phrase) }))
        }
        onEdit={(key, phrase) =>
          patchDoc((d) => ({
            ...d,
            open_questions: editPhrase(d.open_questions, Number(key), phrase),
          }))
        }
        onRemove={(key) =>
          patchDoc((d) => ({
            ...d,
            open_questions: removePhrase(d.open_questions, Number(key)),
          }))
        }
      />
      <PhraseList
        title={t("sidebar.outOfScope")}
        placeholder={t("sidebar.outOfScopePlaceholder")}
        phrases={doc.out_of_scope.map((text, index) => ({ key: String(index), text }))}
        onAdd={(phrase) =>
          patchDoc((d) => ({ ...d, out_of_scope: addPhrase(d.out_of_scope, phrase) }))
        }
        onEdit={(key, phrase) =>
          patchDoc((d) => ({
            ...d,
            out_of_scope: editPhrase(d.out_of_scope, Number(key), phrase),
          }))
        }
        onRemove={(key) =>
          patchDoc((d) => ({
            ...d,
            out_of_scope: removePhrase(d.out_of_scope, Number(key)),
          }))
        }
      />
    </>
  );
}

function PhraseList({
  title,
  hideTitle,
  placeholder,
  phrases,
  selectedKey,
  onSelect,
  onAdd,
  onEdit,
  onRemove,
}: {
  title: string;
  hideTitle?: boolean;
  placeholder: string;
  phrases: { key: string; text: string; note?: string }[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  onAdd: (phrase: string) => void;
  onEdit: (key: string, phrase: string) => void;
  onRemove: (key: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const t = useT();

  function add() {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft("");
  }

  return (
    <section>
      {hideTitle ? null : <div className="section-title">{title}</div>}
      {phrases.map((phrase) => (
        <PhraseRow
          key={phrase.key}
          text={phrase.text}
          note={phrase.note}
          active={selectedKey === phrase.key}
          onSelect={onSelect ? () => onSelect(phrase.key) : undefined}
          onCommit={(next) => onEdit(phrase.key, next)}
          onRemove={() => onRemove(phrase.key)}
        />
      ))}
      <div className="phrase-add">
        <input
          aria-label={title}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add}>
          {t("sidebar.add")}
        </button>
      </div>
    </section>
  );
}

function PhraseRow({
  text,
  note,
  active,
  onSelect,
  onCommit,
  onRemove,
}: {
  text: string;
  note?: string;
  active?: boolean;
  onSelect?: () => void;
  onCommit: (next: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(text);
  const t = useT();

  useEffect(() => {
    setDraft(text);
  }, [text]);

  return (
    <div className="phrase-row">
      <div className={`phrase-main${active ? " active" : ""}`}>
        <input
          value={draft}
          onFocus={onSelect}
          onClick={onSelect}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const trimmed = draft.trim();
            if (!trimmed || trimmed === text) setDraft(text);
            else onCommit(trimmed);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        {note ? <p className="hint-text phrase-note">{note}</p> : null}
      </div>
      <button type="button" aria-label={t("common.delete")} onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
