import { useEffect, useId, useRef, useState } from "react";
import { useT } from "../i18n";

const POP_WIDTH = 240;

export function InfoTip({ text }: { text: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  function place() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    let left = rect.left;
    if (left + POP_WIDTH > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - POP_WIDTH - 8);
    }
    setPos({ top: rect.bottom + 6, left });
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function close() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <span className="info-tip" ref={rootRef}>
      <button
        type="button"
        className="info-tip-btn"
        aria-label={t("info.label")}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (open) {
            setOpen(false);
            return;
          }
          place();
          setOpen(true);
        }}
      >
        i
      </button>
      {open && (
        <span
          id={tipId}
          className="info-tip-pop"
          role="note"
          style={{ top: pos.top, left: pos.left, width: POP_WIDTH }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
