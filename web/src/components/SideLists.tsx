import { useEffect, useState } from "react";
import type { Ontology } from "../types";
import { CollapsibleSidebarSection } from "./CollapsibleSidebarSection";
import { NotesField } from "./NotesField";
import { NotesSummary } from "./NotesSummary";
import {
  addActionPhrase,
  addPhrase,
  addRulePhrase,
  editActionPhrase,
  editPhrase,
  editRulePhrase,
  removeAction,
  removePhrase,
  removeRule,
} from "../lib/sideLists";
import { useOntologyStore } from "../store";

export function SideLists({ doc }: { doc: Ontology }) {
  const patchDoc = useOntologyStore((s) => s.patchDoc);

  return (
    <>
      <NotesSummary doc={doc} />
      <CollapsibleSidebarSection title="Notes" defaultOpen>
        <NotesField
          id="doc-notes"
          label="Notes text"
          labelClassName="sidebar-field-label"
          notes={doc.notes}
          onCommit={(notes) => patchDoc((d) => ({ ...d, notes }))}
        />
      </CollapsibleSidebarSection>
      <PhraseList
        title="Rules"
        placeholder="Rule"
        phrases={doc.rules.map((rule) => ({ key: rule.id, text: rule.statement }))}
        onAdd={(phrase) => patchDoc((d) => ({ ...d, rules: addRulePhrase(d.rules, phrase) }))}
        onEdit={(key, phrase) =>
          patchDoc((d) => ({ ...d, rules: editRulePhrase(d.rules, key, phrase) }))
        }
        onRemove={(key) => patchDoc((d) => ({ ...d, rules: removeRule(d.rules, key) }))}
      />
      <PhraseList
        title="Actions"
        placeholder="Action"
        phrases={doc.actions.map((action) => ({ key: action.id, text: action.name }))}
        onAdd={(phrase) =>
          patchDoc((d) => ({ ...d, actions: addActionPhrase(d.actions, phrase) }))
        }
        onEdit={(key, phrase) =>
          patchDoc((d) => ({ ...d, actions: editActionPhrase(d.actions, key, phrase) }))
        }
        onRemove={(key) => patchDoc((d) => ({ ...d, actions: removeAction(d.actions, key) }))}
      />
      <PhraseList
        title="Open questions"
        placeholder="Question"
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
        title="Out of scope"
        placeholder="Out of scope"
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
          patchDoc((d) => ({ ...d, out_of_scope: removePhrase(d.out_of_scope, Number(key)) }))
        }
      />
    </>
  );
}

function PhraseList({
  title,
  placeholder,
  phrases,
  onAdd,
  onEdit,
  onRemove,
}: {
  title: string;
  placeholder: string;
  phrases: { key: string; text: string }[];
  onAdd: (phrase: string) => void;
  onEdit: (key: string, phrase: string) => void;
  onRemove: (key: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft("");
  }

  return (
    <section>
      <div className="section-title">{title}</div>
      {phrases.map((phrase) => (
        <PhraseRow
          key={phrase.key}
          text={phrase.text}
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
          Add
        </button>
      </div>
    </section>
  );
}

function PhraseRow({
  text,
  onCommit,
  onRemove,
}: {
  text: string;
  onCommit: (next: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(text);

  useEffect(() => {
    setDraft(text);
  }, [text]);

  return (
    <div className="phrase-row">
      <input
        value={draft}
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
      <button type="button" aria-label="Delete" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
