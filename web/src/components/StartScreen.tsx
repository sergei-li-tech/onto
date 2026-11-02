import { useState } from "react";
import { useT } from "../i18n";
import { useOntologyStore } from "../store";
import { parseOntologyYaml } from "../lib/yaml";
import { pickYamlFile } from "../lib/fileAccess";
import { InfoTip } from "./InfoTip";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function StartScreen() {
  const openTemplate = useOntologyStore((s) => s.openTemplate);
  const loadDocument = useOntologyStore((s) => s.loadDocument);
  const t = useT();
  const [domain, setDomain] = useState("");

  async function openExisting() {
    const picked = await pickYamlFile();
    if (!picked) return;
    const doc = parseOntologyYaml(picked.text);
    loadDocument(doc, picked.handle, picked.handle.name);
  }

  return (
    <div className="start-screen">
      <div className="start-head">
        <h2 className="heading-with-info">
          {t("start.title")}
          <InfoTip text={t("start.info")} />
        </h2>
        <LanguageSwitcher variant="screen" />
      </div>

      <div className="field">
        <div className="heading-with-info">
          <label htmlFor="client-domain">{t("start.domain")}</label>
          <InfoTip text={t("start.domainInfo")} />
        </div>
        <input
          id="client-domain"
          placeholder={t("start.domainPlaceholder")}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
      </div>

      <div className="template-grid">
        <div className="template-card">
          <button type="button" onClick={() => openTemplate("generic", domain)}>
            <strong>{t("start.templateGeneric")}</strong>
          </button>
          <InfoTip text={t("start.templateInfo")} />
        </div>
      </div>

      <button type="button" className="list-item" onClick={() => void openExisting()}>
        {t("start.openFile")}
      </button>
    </div>
  );
}
