import type { Ontology } from "../types";
import { gatherNotes } from "../lib/gatherNotes";
import { useT } from "../i18n";
import { useOntologyStore } from "../store";
import { CollapsibleSidebarSection } from "./CollapsibleSidebarSection";

export function NotesSummary({ doc }: { doc: Ontology }) {
  const setSelection = useOntologyStore((s) => s.setSelection);
  const t = useT();
  const entries = gatherNotes(doc);

  return (
    <CollapsibleSidebarSection
      title={
        entries.length
          ? t("sidebar.notesSummaryCount", { count: entries.length })
          : t("sidebar.notesSummary")
      }
      defaultOpen={entries.length > 0}
    >
      {entries.length === 0 ? (
        <p className="hint-text notes-summary-empty">{t("sidebar.notesSummaryEmpty")}</p>
      ) : (
        <ul className="notes-summary-list">
          {entries.map((entry) => (
            <li key={`${entry.kind}:${entry.id ?? "doc"}`}>
              <button
                type="button"
                className="notes-summary-item"
                onClick={() => {
                  if (entry.kind === "entity" && entry.id) {
                    setSelection({ kind: "entity", id: entry.id });
                  } else if (entry.kind === "relationship" && entry.id) {
                    setSelection({ kind: "relationship", id: entry.id });
                  }
                }}
                disabled={entry.kind === "doc"}
              >
                <span className="notes-summary-label">
                  {entry.kind === "doc" ? t("sidebar.document") : entry.label}
                </span>
                <span className="notes-summary-text">{entry.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSidebarSection>
  );
}
