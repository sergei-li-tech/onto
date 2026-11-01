import { useState, type ReactNode } from "react";

export function CollapsibleSidebarSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="sidebar-section">
      <button
        type="button"
        className="sidebar-section-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sidebar-section-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        {title}
      </button>
      {open ? <div className="sidebar-section-body">{children}</div> : null}
    </section>
  );
}
