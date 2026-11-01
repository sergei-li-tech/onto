import { useEffect, useState } from "react";

export function NotesField({
  id,
  label,
  notes,
  placeholder = "Raw notes",
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
  const [draft, setDraft] = useState(notes);

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
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== notes) onCommit(draft);
        }}
      />
    </div>
  );
}
