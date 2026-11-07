import { useEffect, useState } from "react";
import type { Ontology } from "../types";
import { exportMermaid, type MermaidExportType } from "../lib/mermaid";
import { useT } from "../i18n";

interface MermaidModalProps {
  doc: Ontology;
  isOpen: boolean;
  onClose: () => void;
}

export function MermaidModal({ doc, isOpen, onClose }: MermaidModalProps) {
  const t = useT();
  const [tab, setTab] = useState<MermaidExportType>("er");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = exportMermaid(doc, tab);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  function handleDownload() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.domain || "ontology"}-${tab}.mmd`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("mermaid.title")}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={tab === "er" ? "active" : ""}
            onClick={() => setTab("er")}
          >
            {t("mermaid.tabER")}
          </button>
          <button
            type="button"
            className={tab === "flowchart" ? "active" : ""}
            onClick={() => setTab("flowchart")}
          >
            {t("mermaid.tabFlowchart")}
          </button>
          <button
            type="button"
            className={tab === "states" ? "active" : ""}
            onClick={() => setTab("states")}
          >
            {t("mermaid.tabStates")}
          </button>
        </div>

        <div className="modal-body">
          <textarea
            className="mermaid-code-preview"
            value={content}
            readOnly
            rows={14}
            spellCheck={false}
          />
        </div>

        <div className="modal-footer">
          <button type="button" onClick={handleDownload}>
            {t("mermaid.download")}
          </button>
          <button type="button" className="primary" onClick={handleCopy}>
            {copied ? t("mermaid.copied") : t("mermaid.copy")}
          </button>
        </div>
      </div>
    </div>
  );
}

