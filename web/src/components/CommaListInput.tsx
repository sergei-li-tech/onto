import { useEffect, useState } from "react";
import { formatCommaList, parseCommaList } from "../lib/commaList";

export function CommaListInput({
  id,
  value,
  onCommit,
  placeholder,
}: {
  id?: string;
  value: readonly string[];
  onCommit: (items: string[]) => void;
  placeholder?: string;
}) {
  const stored = formatCommaList(value);
  const [draft, setDraft] = useState(stored);

  useEffect(() => {
    setDraft(stored);
  }, [stored]);

  function commit() {
    const next = parseCommaList(draft);
    const formatted = formatCommaList(next);
    setDraft(formatted);
    if (formatted !== stored) onCommit(next);
  }

  return (
    <input
      id={id}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
