import { useState } from "react";
import type { DataSource, DataSourceType, McpConnector } from "../types";
import { useT } from "../i18n";
import { useOntologyStore } from "../store";
import { CollapsibleSidebarSection } from "./CollapsibleSidebarSection";

const DATA_SOURCE_TYPES: DataSourceType[] = [
  "postgresql",
  "snowflake",
  "openapi_v3",
  "rest",
  "custom",
];

export function InfrastructureSidebarSection() {
  const t = useT();
  const mappingDoc = useOntologyStore((s) => s.mappingDoc);
  const addDataSource = useOntologyStore((s) => s.addDataSource);
  const removeDataSource = useOntologyStore((s) => s.removeDataSource);
  const addMcpConnector = useOntologyStore((s) => s.addMcpConnector);
  const removeMcpConnector = useOntologyStore((s) => s.removeMcpConnector);

  const [showAddDs, setShowAddDs] = useState(false);
  const [dsName, setDsName] = useState("");
  const [dsType, setDsType] = useState<DataSourceType>("postgresql");
  const [dsDsn, setDsDsn] = useState("");

  const [showAddMcp, setShowAddMcp] = useState(false);
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");

  const dataSources = mappingDoc?.infrastructure?.data_sources ?? {};
  const mcpConnectors = mappingDoc?.infrastructure?.mcp_connectors ?? [];

  function handleCreateDs() {
    const trimmed = dsName.trim();
    if (!trimmed) return;
    const ds: DataSource = {
      type: dsType,
      dsn_env_var: dsDsn.trim() || undefined,
    };
    addDataSource(trimmed, ds);
    setDsName("");
    setDsDsn("");
    setShowAddDs(false);
  }

  function handleCreateMcp() {
    const trimmed = mcpName.trim();
    const url = mcpUrl.trim();
    if (!trimmed || !url) return;
    const connector: McpConnector = {
      name: trimmed,
      url,
    };
    addMcpConnector(connector);
    setMcpName("");
    setMcpUrl("");
    setShowAddMcp(false);
  }

  return (
    <div className="infra-sidebar-container">
      <CollapsibleSidebarSection title={t("infra.dataSources")} defaultOpen>
        <div className="infra-list">
          {Object.entries(dataSources).map(([name, ds]) => (
            <div key={name} className="infra-item-card">
              <div className="infra-item-head">
                <span className="infra-item-name">{name}</span>
                <span className="infra-item-badge">{ds.type}</span>
                <button
                  type="button"
                  className="infra-delete-btn"
                  title={t("common.delete")}
                  onClick={() => removeDataSource(name)}
                >
                  ✕
                </button>
              </div>
              {ds.dsn_env_var && (
                <div className="infra-item-meta">ENV: {ds.dsn_env_var}</div>
              )}
            </div>
          ))}
        </div>

        {showAddDs ? (
          <div className="infra-add-form card-block">
            <div className="field">
              <label>{t("infra.dsName")}</label>
              <input
                value={dsName}
                placeholder="e.g. primary_postgres"
                onChange={(e) => setDsName(e.target.value)}
              />
            </div>
            <div className="field">
              <label>{t("infra.dsType")}</label>
              <select
                value={dsType}
                onChange={(e) => setDsType(e.target.value as DataSourceType)}
              >
                {DATA_SOURCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t("infra.dsDsn")}</label>
              <input
                value={dsDsn}
                placeholder="DATABASE_URL"
                onChange={(e) => setDsDsn(e.target.value)}
              />
            </div>
            <div className="infra-form-actions">
              <button
                type="button"
                className="list-item"
                onClick={handleCreateDs}
                disabled={!dsName.trim()}
              >
                {t("sidebar.add")}
              </button>
              <button
                type="button"
                className="list-item"
                onClick={() => setShowAddDs(false)}
              >
                {t("start.discardDraft")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="list-item card-action"
            onClick={() => setShowAddDs(true)}
          >
            {t("infra.addDataSource")}
          </button>
        )}
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection title={t("infra.mcpConnectors")} defaultOpen>
        <div className="infra-list">
          {mcpConnectors.map((c) => (
            <div key={c.name} className="infra-item-card">
              <div className="infra-item-head">
                <span className="infra-item-name">{c.name}</span>
                <button
                  type="button"
                  className="infra-delete-btn"
                  title={t("common.delete")}
                  onClick={() => removeMcpConnector(c.name)}
                >
                  ✕
                </button>
              </div>
              <div className="infra-item-meta">{c.url}</div>
            </div>
          ))}
        </div>

        {showAddMcp ? (
          <div className="infra-add-form card-block">
            <div className="field">
              <label>{t("infra.mcpName")}</label>
              <input
                value={mcpName}
                placeholder="e.g. passport_tool"
                onChange={(e) => setMcpName(e.target.value)}
              />
            </div>
            <div className="field">
              <label>{t("infra.mcpUrl")}</label>
              <input
                value={mcpUrl}
                placeholder="mcp://service:8080"
                onChange={(e) => setMcpUrl(e.target.value)}
              />
            </div>
            <div className="infra-form-actions">
              <button
                type="button"
                className="list-item"
                onClick={handleCreateMcp}
                disabled={!mcpName.trim() || !mcpUrl.trim()}
              >
                {t("sidebar.add")}
              </button>
              <button
                type="button"
                className="list-item"
                onClick={() => setShowAddMcp(false)}
              >
                {t("start.discardDraft")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="list-item card-action"
            onClick={() => setShowAddMcp(true)}
          >
            {t("infra.addMcpConnector")}
          </button>
        )}
      </CollapsibleSidebarSection>
    </div>
  );
}

