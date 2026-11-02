import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { LANGS, setLang, useLang, useT } from "../i18n";
import { langCode, stepIndex } from "../lib/langMenu";

function GlobeIcon() {
  return (
    <svg className="lang-switch-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <ellipse cx="8" cy="8" rx="2.6" ry="6.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M1.8 8h12.4M2.9 4.7h10.2M2.9 11.3h10.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

/**
 * Compact language dropdown: the button shows a globe, the current language code
 * (`EN` / `RU` / `KO`) and a chevron; the menu lists native names and marks the
 * active one. Labels are never translated and the choice applies instantly.
 */
export function LanguageSwitcher({ variant = "bar" }: { variant?: "bar" | "screen" }) {
  const lang = useLang();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const selectedIndex = Math.max(
    0,
    LANGS.findIndex((item) => item.id === lang),
  );
  const current = LANGS[selectedIndex];

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
    openMenu(selectedIndex);
  }

  function choose(id: typeof lang) {
    setLang(id);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(selectedIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(stepIndex(selectedIndex, -1, LANGS.length));
    }
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusIndex((index) => stepIndex(index, 1, LANGS.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusIndex((index) => stepIndex(index, -1, LANGS.length));
    } else if (event.key === "Home") {
      event.preventDefault();
      setFocusIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setFocusIndex(LANGS.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className={`lang-switch lang-switch-${variant}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="lang-switch-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${t("lang.label")}: ${current.label}`}
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
      >
        <GlobeIcon />
        <span className="lang-switch-code" aria-hidden="true">
          {langCode(lang)}
        </span>
        <span className="lang-switch-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          className="lang-menu"
          role="menu"
          aria-label={t("lang.label")}
          onKeyDown={onMenuKeyDown}
        >
          {LANGS.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === lang}
              lang={item.id}
              tabIndex={-1}
              className="lang-menu-item"
              onClick={() => choose(item.id)}
            >
              <span className="lang-menu-check" aria-hidden="true">
                {item.id === lang ? "✓" : ""}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
