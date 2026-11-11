import type { Action, Entity, Ontology } from "../types";
import { useT } from "../i18n";
import { useOntologyStore } from "../store";

export function EntityTechnicalMappingCard({
  doc: _doc,
  entity,
}: {
  doc: Ontology;
  entity: Entity;
}) {
  const t = useT();
  const mappingDoc = useOntologyStore((s) => s.mappingDoc);
  const updateEntityMapping = useOntologyStore((s) => s.updateEntityMapping);
  const updateEntityFieldMapping = useOntologyStore((s) => s.updateEntityFieldMapping);

  const entMapping = mappingDoc?.entity_mappings?.[entity.id];
  const dataSources = Object.keys(mappingDoc?.infrastructure?.data_sources ?? {});
  const fieldMappings = entMapping?.field_mappings ?? {};

  function autoFillColumns() {
    for (const attr of entity.attributes) {
      if (!fieldMappings[attr.id]) {
        updateEntityFieldMapping(entity.id, attr.id, attr.id);
      }
    }
  }

  return (
    <section className="card-block tech-mapping-card">
      <h3 className="heading-with-info">
        {t("mapping.entityMapping", { name: entity.name })}
      </h3>

      <div className="field">
        <label>{t("mapping.systemOfRecord")}</label>
        <select
          value={entMapping?.system_of_record ?? ""}
          onChange={(e) =>
            updateEntityMapping(entity.id, {
              system_of_record: e.target.value || undefined,
            })
          }
        >
          <option value="">{t("mapping.selectDataSource")}</option>
          {dataSources.map((ds) => (
            <option key={ds} value={ds}>
              {ds}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>{t("mapping.table")}</label>
        <input
          value={entMapping?.table ?? ""}
          placeholder={t("mapping.tablePlaceholder")}
          onChange={(e) =>
            updateEntityMapping(entity.id, {
              table: e.target.value.trim() || undefined,
            })
          }
        />
      </div>

      <div className="field-mappings-head">
        <label>{t("mapping.fieldMappings")}</label>
        <button
          type="button"
          className="link-button"
          onClick={autoFillColumns}
        >
          {t("mapping.autoFillColumns")}
        </button>
      </div>

      <div className="field-mappings-table">
        {entity.attributes.length === 0 ? (
          <div className="hint-text">{t("entityNode.noFields")}</div>
        ) : (
          entity.attributes.map((attr) => (
            <div key={attr.id} className="field-mapping-row">
              <div className="field-mapping-attr">
                <span className="field-mapping-attr-name">{attr.name}</span>
                <span className="field-mapping-attr-id">({attr.id})</span>
                {attr.pii && <span className="badge-pii">PII</span>}
              </div>
              <div className="field-mapping-arrow">→</div>
              <input
                className="field-mapping-input"
                placeholder={attr.id}
                value={fieldMappings[attr.id] ?? ""}
                onChange={(e) =>
                  updateEntityFieldMapping(entity.id, attr.id, e.target.value.trim())
                }
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function ActionTechnicalMappingCard({
  doc: _doc,
  action,
}: {
  doc: Ontology;
  action: Action;
}) {
  const t = useT();
  const mappingDoc = useOntologyStore((s) => s.mappingDoc);
  const updateActionMapping = useOntologyStore((s) => s.updateActionMapping);

  const actMapping = mappingDoc?.action_mappings?.[action.id];
  const mcpConnectors = mappingDoc?.infrastructure?.mcp_connectors ?? [];

  return (
    <section className="card-block tech-mapping-card">
      <h3 className="heading-with-info">
        {t("mapping.actionMapping", { name: action.name })}
      </h3>

      <div className="field">
        <label>{t("mapping.handler")}</label>
        <input
          value={actMapping?.handler ?? ""}
          placeholder={t("mapping.handlerPlaceholder")}
          onChange={(e) =>
            updateActionMapping(action.id, {
              handler: e.target.value.trim() || undefined,
            })
          }
        />
      </div>

      <div className="field">
        <label>{t("mapping.mcpConnector")}</label>
        <select
          value={actMapping?.mcp_connector ?? ""}
          onChange={(e) =>
            updateActionMapping(action.id, {
              mcp_connector: e.target.value || undefined,
            })
          }
        >
          <option value="">{t("mapping.selectConnector")}</option>
          {mcpConnectors.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.url})
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>{t("mapping.telemetrySink")}</label>
        <input
          value={actMapping?.telemetry_sink ?? ""}
          placeholder={t("mapping.telemetryPlaceholder")}
          onChange={(e) =>
            updateActionMapping(action.id, {
              telemetry_sink: e.target.value.trim() || undefined,
            })
          }
        />
      </div>
    </section>
  );
}

