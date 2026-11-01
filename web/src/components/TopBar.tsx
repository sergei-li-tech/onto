import { confirmDiscardChanges } from "../lib/unsavedChanges";
import { saveYamlAs, saveYamlToHandle } from "../lib/fileAccess";
import { useOntologyStore } from "../store";

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

  const canSave = validationErrors.length === 0;

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
        <h1>{doc?.domain ?? "Editor"}</h1>
        <button type="button" onClick={goToStart}>
          Templates
        </button>
        <button type="button" onClick={undo}>
          Undo
        </button>
        <button type="button" onClick={redo}>
          Redo
        </button>
        <button type="button" onClick={() => void runAutoLayout()}>
          Auto layout
        </button>
        <span className="spacer" />
        <span className="meta tech-only">
          {fileName ?? "unsaved"} · {doc?.domain} v{doc?.version}
          {doc?.based_on ? ` · from ${doc.based_on.id} ${doc.based_on.version}` : ""}
        </span>
        <button type="button" className="primary" disabled={!canSave} onClick={() => void saveAsClient()}>
          Save as…
        </button>
        <button type="button" disabled={!canSave || !fileHandle} onClick={() => void saveExisting()}>
          Save
        </button>
      </header>
      {validationErrors.length > 0 && (
        <div className="errors tech-only">
          {validationErrors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
    </>
  );
}
