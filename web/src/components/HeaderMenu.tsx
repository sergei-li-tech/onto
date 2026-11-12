import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  pickYamlFile,
  saveMappingYamlAs,
  saveMappingYamlToHandle,
  saveYamlAs,
  saveYamlToHandle,
} from "../lib/fileAccess";
import { parseTechnicalMappingYaml } from "../lib/technicalMapping";
import { exportMermaid, type MermaidExportType } from "../lib/mermaid";
import { downloadGraphPng } from "../lib/exportPng";
import { useT } from "../i18n";
import { useOntologyStore } from "../store";
import { stepIndex } from "../lib/langMenu";

/** Waits for a couple of render passes; setTimeout keeps working in a hidden tab. */
function settleDom(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 60);
  });
}

function downloadTextFile(fileName: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function ChevronIcon() {
  return (
    <span className="header-menu-chevron" aria-hidden="true">
      ▾
    </span>
  );
}

/**
 * Single header dropdown holding every save and export action: "Save" first,
 * then the Mermaid formats and the PNG picture of the whole graph.
 */
export function HeaderMenu({ onOpenMermaid }: { onOpenMermaid?: () => void }) {
  const t = useT();
  const doc = useOntologyStore((s) => s.doc);
  const fileHandle = useOntologyStore((s) => s.fileHandle);
  const validationErrors = useOntologyStore((s) => s.validationErrors);
  const viewMode = useOntologyStore((s) => s.viewMode);
  const markSaved = useOntologyStore((s) => s.markSaved);
  const setFileHandle = useOntologyStore((s) => s.setFileHandle);
  const mappingDoc = useOntologyStore((s) => s.mappingDoc);
  const mappingFileHandle = useOntologyStore((s) => s.mappingFileHandle);
  const loadMappingDocument = useOntologyStore((s) => s.loadMappingDocument);

  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [pngBusy, setPngBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

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

  function downloadMermaid(type: MermaidExportType) {
    if (!doc) return;
    downloadTextFile(`${doc.domain || "ontology"}-${type}.mmd`, exportMermaid(doc, type));
  }

  async function exportPng() {
    if (!doc) return;
    setPngBusy(true);
    const store = useOntologyStore.getState();
    const previousSelection = store.selection;
    // Export the whole graph with every field list open, without selection or hover marks.
    store.setSelection(null);
    store.setCaptureMode(true);
    try {
      await document.fonts?.ready;
      await settleDom();
      await settleDom();
      await downloadGraphPng(doc);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(t("menu.pngFailed", { error: message }));
    } finally {
      store.setCaptureMode(false);
      store.setSelection(previousSelection);
      setPngBusy(false);
    }
  }

  type Item = {
    key: string;
    label: string;
    hint?: string;
    disabled?: boolean;
    run: () => void;
  };

  const fileItems: Item[] =
    viewMode === "business"
      ? [
          { key: "save", label: t("topbar.save"), disabled: !canSave || !fileHandle, run: () => void saveExisting() },
          { key: "saveAs", label: t("topbar.saveAs"), disabled: !canSave, run: () => void saveAsClient() },
        ]
      : [
          {
            key: "saveMapping",
            label: t("topbar.saveMapping"),
            disabled: !mappingFileHandle,
            run: () => void saveMappingExisting(),
          },
          { key: "saveMappingAs", label: t("topbar.saveMappingAs"), run: () => void saveMappingAsClient() },
          { key: "loadMapping", label: t("topbar.loadMapping"), run: () => void loadMappingFile() },
        ];

  const exportItems: Item[] = [
    { key: "er", label: t("menu.mermaidER"), run: () => downloadMermaid("er") },
    { key: "flowchart", label: t("menu.mermaidFlowchart"), run: () => downloadMermaid("flowchart") },
    { key: "states", label: t("menu.mermaidStates"), run: () => downloadMermaid("states") },
    {
      key: "mermaidOpen",
      label: t("menu.mermaidOpen"),
      run: () => {
        onOpenMermaid?.();
      },
    },
    { key: "png", label: t("menu.png"), hint: t("menu.pngHint"), run: () => void exportPng() },
  ];

  const items = [...fileItems, ...exportItems];

  useEffect(() => {
    if (open) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openMenu(index: number) {
    setFocusIndex(index);
    setOpen(true);
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    openMenu(0);
  }

  function activate(item: Item) {
    if (item.disabled) return;
    setOpen(false);
    item.run();
  }

  function onButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(stepIndex(0, -1, items.length));
    }
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusIndex((index) => stepIndex(index, 1, items.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusIndex((index) => stepIndex(index, -1, items.length));
    } else if (event.key === "Home") {
      event.preventDefault();
      setFocusIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setFocusIndex(items.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  function renderItem(item: Item) {
    const index = items.findIndex((candidate) => candidate.key === item.key);
    return (
      <button
        key={item.key}
        ref={(element) => {
          itemRefs.current[index] = element;
        }}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="header-menu-item"
        disabled={item.disabled}
        onClick={() => activate(item)}
      >
        <span className="header-menu-item-label">{item.label}</span>
        {item.hint ? <span className="header-menu-item-hint">{item.hint}</span> : null}
      </button>
    );
  }

  return (
    <div className="header-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="header-menu-button primary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t("menu.label")}
        disabled={!doc}
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
      >
        <span>{pngBusy ? t("menu.pngBusy") : t("menu.label")}</span>
        <ChevronIcon />
      </button>
      {open && doc ? (
        <div
          id={menuId}
          className="header-menu-list"
          role="menu"
          aria-label={t("menu.label")}
          onKeyDown={onMenuKeyDown}
        >
          <div className="header-menu-group" role="presentation">
            {t("menu.fileGroup")}
          </div>
          {fileItems.map(renderItem)}
          <div className="header-menu-separator" role="separator" />
          <div className="header-menu-group" role="presentation">
            {t("menu.exportGroup")}
          </div>
          {exportItems.map(renderItem)}
        </div>
      ) : null}
    </div>
  );
}
