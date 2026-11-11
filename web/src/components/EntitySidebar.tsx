import type { Ontology } from "../types";
import { entityMatchesSearch } from "../lib/entityNames";
import { useT } from "../i18n";
import { useOntologyStore } from "../store";
import { CollapsibleSidebarSection } from "./CollapsibleSidebarSection";
import { SideLists } from "./SideLists";
import { InfrastructureSidebarSection } from "./InfrastructureSidebarSection";

export function EntitySidebar({ doc }: { doc: Ontology }) {
  const search = useOntologyStore((s) => s.search);
  const setSearch = useOntologyStore((s) => s.setSearch);
  const selection = useOntologyStore((s) => s.selection);
  const setSelection = useOntologyStore((s) => s.setSelection);
  const viewMode = useOntologyStore((s) => s.viewMode);
  const t = useT();

  const entities = doc.entities.filter((e) => entityMatchesSearch(e, search));

  return (
    <aside className="sidebar">
      <CollapsibleSidebarSection title={t("sidebar.entities")} defaultOpen>
        <div className="field">
          <label htmlFor="search">{t("sidebar.search")}</label>
          <input
            id="search"
            placeholder={t("sidebar.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {entities.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`list-item ${selection?.kind === "entity" && selection.id === e.id ? "active" : ""}`}
            onClick={() => setSelection({ kind: "entity", id: e.id })}
          >
            {e.name}
          </button>
        ))}
      </CollapsibleSidebarSection>

      {viewMode === "technical" ? (
        <InfrastructureSidebarSection />
      ) : (
        <SideLists doc={doc} />
      )}
    </aside>
  );
}
