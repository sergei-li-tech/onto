import { confirmDiscardChanges } from "../lib/unsavedChanges";
import { saveYamlAs, saveYamlToHandle } from "../lib/fileAccess";
import { formatValidationIssues } from "../lib/validationMessages";
import { useT } from "../i18n";
import { useOntologyStore } from "../store";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function TopBar() {
  const doc = useOntologyStore((s) => s.doc);
  const fileName = useOntologyStore((s) => s.fileName);
  const fileHandle = useOntologyStore((s) => s.fileHandle);
  const validationErrors = useOntologyStore((s) => s.validationErrors);
  const undo = useOntologyStore((s) => s.undo);
  const redo = useOntologyStore((s) => s.redo);
  const runAutoLayout = useOntologyStore((s) => s.runAutoLayout);
  const backToStart = useOntologyStore((s) => s.backToStart);
  const markSaved = useOntologyStore((s) => s.markSaved);
  const setFileHandle = useOntologyStore((s) => s.setFileHandle);
  const t = useT();

  const canSave = validationErrors.length === 0;
  const errorMessages = formatValidationIssues(validationErrors, t);

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

  function goToStart() {
    if (confirmDiscardChanges()) backToStart();
  }

  return (
    <>
      <header className="topbar">
        <h1>{doc?.domain ?? t("app.title")}</h1>
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
        <span className="spacer" />
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
      </header>
      {validationErrors.length > 0 && (
        <div className="errors tech-only">
          {errorMessages.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      )}
    </>
  );
}
