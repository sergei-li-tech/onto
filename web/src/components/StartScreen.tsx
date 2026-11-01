import { useState } from "react";
import { TEMPLATE_LABEL } from "../lib/templates";
import { useOntologyStore } from "../store";
import { parseOntologyYaml } from "../lib/yaml";
import { pickYamlFile } from "../lib/fileAccess";
import { InfoTip } from "./InfoTip";

export function StartScreen() {
  const openTemplate = useOntologyStore((s) => s.openTemplate);
  const loadDocument = useOntologyStore((s) => s.loadDocument);
  const [domain, setDomain] = useState("");

  async function openExisting() {
    const picked = await pickYamlFile();
    if (!picked) return;
    const doc = parseOntologyYaml(picked.text);
    loadDocument(doc, picked.handle, picked.handle.name);
  }

  return (
    <div className="start-screen">
      <h2 className="heading-with-info">
        Editor
        <InfoTip text="Start from a template entity or open a saved file. Templates are not overwritten." />
      </h2>

      <div className="field">
        <div className="heading-with-info">
          <label htmlFor="client-domain">Domain</label>
          <InfoTip text="Latin characters, will be used in the filename." />
        </div>
        <input
          id="client-domain"
          placeholder="e.g. salon-gangnam"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
      </div>

      <div className="template-grid">
        <div className="template-card">
          <button type="button" onClick={() => openTemplate("generic", domain)}>
            <strong>{TEMPLATE_LABEL}</strong>
          </button>
          <InfoTip text="Starting entity — “Client”." />
        </div>
      </div>

      <button type="button" className="list-item" onClick={() => void openExisting()}>
        Open file…
      </button>
    </div>
  );
}
