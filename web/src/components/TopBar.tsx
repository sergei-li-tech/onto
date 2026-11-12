import { confirmDiscardChanges } from "../lib/unsavedChanges";
import { formatValidationIssues } from "../lib/validationMessages";
import { useT } from "../i18n";
import { useOntologyStore } from "../store";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { HeaderMenu } from "./HeaderMenu";

interface TopBarProps {
  onOpenMermaid?: () => void;
}

export function TopBar({ onOpenMermaid }: TopBarProps) {
  const doc = useOntologyStore((s) => s.doc);
  const fileName = useOntologyStore((s) => s.fileName);
  const validationErrors = useOntologyStore((s) => s.validationErrors);
  const invariantIssues = useOntologyStore((s) => s.invariantViolations);
  const undo = useOntologyStore((s) => s.undo);
  const redo = useOntologyStore((s) => s.redo);
  const runAutoLayout = useOntologyStore((s) => s.runAutoLayout);
  const backToStart = useOntologyStore((s) => s.backToStart);
  const autosaveStatus = useOntologyStore((s) => s.autosaveStatus);

  const viewMode = useOntologyStore((s) => s.viewMode);
  const setViewMode = useOntologyStore((s) => s.setViewMode);
  const mappingFileName = useOntologyStore((s) => s.mappingFileName);
  const mappingValidationErrors = useOntologyStore((s) => s.mappingValidationErrors);
  const t = useT();

  const errorMessages = formatValidationIssues(validationErrors, t);
  const invariantMessages = formatValidationIssues(invariantIssues, t);
  const mappingErrorMessages = formatValidationIssues(mappingValidationErrors, t);

  function goToStart() {
    if (confirmDiscardChanges()) backToStart();
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-main">
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
          <LanguageSwitcher />
        </div>

        <div className="topbar-actions">
          {autosaveStatus !== "idle" && (
            <span className={`autosave-status ${autosaveStatus}`}>
              <span className="dot" />
              {autosaveStatus === "saving" ? t("topbar.saving") : t("topbar.autosaved")}
            </span>
          )}
          <span className="meta tech-only">
            {viewMode === "business"
              ? `${fileName ?? t("topbar.unsaved")} · ${doc?.domain} v${doc?.version}${
                  doc?.based_on
                    ? ` · ${t("topbar.basedOn", { id: doc.based_on.id, version: doc.based_on.version })}`
                    : ""
                }`
              : (mappingFileName ?? `${doc?.domain ?? "domain"}.technical_mapping.yaml`)}
          </span>
          <HeaderMenu onOpenMermaid={onOpenMermaid} />
        </div>
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
