import { useEffect, useState } from "react";
import { useT } from "../i18n";

export function NotesField({
  id,
  label,
  notes,
  placeholder,
  rows = 3,
  labelClassName = "section-title",
  onCommit,
}: {
  id: string;
  label: string;
  notes: string;
  placeholder?: string;
  rows?: number;
  labelClassName?: string;
  onCommit: (next: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(notes);
  const resolvedPlaceholder = placeholder ?? t("sidebar.notesPlaceholder");

  useEffect(() => {
    setDraft(notes);
  }, [notes]);

  return (
    <div className="field">
      <label className={labelClassName} htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        placeholder={resolvedPlaceholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== notes) onCommit(draft);
        }}
      />
    </div>
  );
}
