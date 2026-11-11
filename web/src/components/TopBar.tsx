import { confirmDiscardChanges } from "../lib/unsavedChanges";
import { pickYamlFile, saveMappingYamlAs, saveMappingYamlToHandle, saveYamlAs, saveYamlToHandle } from "../lib/fileAccess";
import { parseTechnicalMappingYaml } from "../lib/technicalMapping";
import { formatValidationIssues } from "../lib/validationMessages";
import { useT } from "../i18n";
import { useOntologyStore } from "../store";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface TopBarProps {
  onOpenMermaid?: () => void;
}

export function TopBar({ onOpenMermaid }: TopBarProps) {
  const doc = useOntologyStore((s) => s.doc);
  const fileName = useOntologyStore((s) => s.fileName);
  const fileHandle = useOntologyStore((s) => s.fileHandle);
  const validationErrors = useOntologyStore((s) => s.validationErrors);
  const invariantIssues = useOntologyStore((s) => s.invariantViolations);
  const undo = useOntologyStore((s) => s.undo);
  const redo = useOntologyStore((s) => s.redo);
  const runAutoLayout = useOntologyStore((s) => s.runAutoLayout);
  const backToStart = useOntologyStore((s) => s.backToStart);
  const markSaved = useOntologyStore((s) => s.markSaved);
  const setFileHandle = useOntologyStore((s) => s.setFileHandle);
  const autosaveStatus = useOntologyStore((s) => s.autosaveStatus);

  const viewMode = useOntologyStore((s) => s.viewMode);
  const setViewMode = useOntologyStore((s) => s.setViewMode);
  const mappingDoc = useOntologyStore((s) => s.mappingDoc);
  const mappingFileName = useOntologyStore((s) => s.mappingFileName);
  const mappingFileHandle = useOntologyStore((s) => s.mappingFileHandle);
  const mappingValidationErrors = useOntologyStore((s) => s.mappingValidationErrors);
  const loadMappingDocument = useOntologyStore((s) => s.loadMappingDocument);
  const t = useT();

  const canSave = validationErrors.length === 0;
  const errorMessages = formatValidationIssues(validationErrors, t);
  const invariantMessages = formatValidationIssues(invariantIssues, t);
  const mappingErrorMessages = formatValidationIssues(mappingValidationErrors, t);

  async function saveAsClient() {
    if (!doc) return;
    const handle = await saveYamlAs(doc);
    if (handle) {
      setFileHandle(handle, handle.name);
      markSaved();
    }
  }

  async function saveExisting() {
    if (!doc || !fileHandle) return;
    const ok = await saveYamlToHandle(fileHandle, doc);
    if (ok) markSaved();
  }

  async function loadMappingFile() {
    const picked = await pickYamlFile();
    if (!picked) return;
    try {
      const mapping = parseTechnicalMappingYaml(picked.text);
      loadMappingDocument(mapping, picked.handle, picked.handle.name);
    } catch (err) {
      alert(`Error loading technical mapping: ${String(err)}`);
    }
  }

  async function saveMappingAsClient() {
    if (!mappingDoc) return;
    const defaultName = `${doc?.domain ?? "domain"}.technical_mapping.yaml`;
    const handle = await saveMappingYamlAs(mappingDoc, defaultName);
    if (handle) {
      loadMappingDocument(mappingDoc, handle, handle.name);
    }
  }

  async function saveMappingExisting() {
    if (!mappingDoc || !mappingFileHandle) return;
    await saveMappingYamlToHandle(mappingFileHandle, mappingDoc);
  }

  function goToStart() {
    if (confirmDiscardChanges()) backToStart();
  }

  return (
    <>
      <header className="topbar">
        <h1>{doc?.domain ?? t("app.title")}</h1>
        <div className="view-mode-toggle" role="group" aria-label={t("topbar.viewMode")}>
          <button
            type="button"
            className={`mode-btn ${viewMode === "business" ? "active" : ""}`}
            onClick={() => setViewMode("business")}
          >
            {t("topbar.modeBusiness")}
          </button>
          <button
            type="button"
            className={`mode-btn ${viewMode === "technical" ? "active" : ""}`}
            onClick={() => setViewMode("technical")}
          >
            {t("topbar.modeTechnical")}
          </button>
        </div>
        <button type="button" onClick={goToStart}>
          {t("topbar.templates")}
        </button>
        <button type="button" onClick={undo}>
          {t("topbar.undo")}
        </button>
        <button type="button" onClick={redo}>
          {t("topbar.redo")}
        </button>
        <button type="button" onClick={() => void runAutoLayout()}>
          {t("topbar.autoLayout")}
        </button>
        <button type="button" onClick={onOpenMermaid}>
          {t("topbar.mermaid")}
        </button>
        <LanguageSwitcher />
        <span className="spacer" />

        {viewMode === "business" ? (
          <>
            {autosaveStatus !== "idle" && (
              <span className={`autosave-status ${autosaveStatus}`}>
                <span className="dot" />
                {autosaveStatus === "saving" ? t("topbar.saving") : t("topbar.autosaved")}
              </span>
            )}
            <span className="meta tech-only">
              {fileName ?? t("topbar.unsaved")} · {doc?.domain} v{doc?.version}
              {doc?.based_on
                ? ` · ${t("topbar.basedOn", { id: doc.based_on.id, version: doc.based_on.version })}`
                : ""}
            </span>
            <button type="button" className="primary" disabled={!canSave} onClick={() => void saveAsClient()}>
              {t("topbar.saveAs")}
            </button>
            <button type="button" disabled={!canSave || !fileHandle} onClick={() => void saveExisting()}>
              {t("topbar.save")}
            </button>
          </>
        ) : (
          <>
            <span className="meta tech-only">
              {mappingFileName ?? `${doc?.domain ?? "domain"}.technical_mapping.yaml`}
            </span>
            <button type="button" onClick={() => void loadMappingFile()}>
              {t("topbar.loadMapping")}
            </button>
            <button type="button" className="primary" onClick={() => void saveMappingAsClient()}>
              {t("topbar.saveMappingAs")}
            </button>
            {mappingFileHandle && (
              <button type="button" onClick={() => void saveMappingExisting()}>
                {t("topbar.saveMapping")}
              </button>
            )}
          </>
        )}
      </header>
      {viewMode === "business" && validationErrors.length > 0 && (
        <div className="errors tech-only">
          {errorMessages.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      )}
      {viewMode === "business" && invariantIssues.length > 0 && (
        <div className="errors invariant-errors">
          {invariantMessages.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      )}
      {viewMode === "technical" && mappingValidationErrors.length > 0 && (
        <div className="errors tech-only">
          {mappingErrorMessages.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      )}
    </>
  );
}
