import { useEffect } from "react";
import { useOntologyStore } from "../store";
import { useT } from "../i18n";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable ||
    Boolean(target.closest(".monaco-editor, .cm-editor"))
  );
}

export function useEditorHotkeys() {
  const t = useT();
  const selection = useOntologyStore((s) => s.selection);
  const setSelection = useOntologyStore((s) => s.setSelection);
  const addEntity = useOntologyStore((s) => s.addEntity);
  const duplicateEntity = useOntologyStore((s) => s.duplicateEntity);
  const removeEntity = useOntologyStore((s) => s.removeEntity);
  const removeRelationship = useOntologyStore((s) => s.removeRelationship);
  const removeAction = useOntologyStore((s) => s.removeAction);
  const removeInvariant = useOntologyStore((s) => s.removeInvariant);
  const addAction = useOntologyStore((s) => s.addAction);
  const addRelationship = useOntologyStore((s) => s.addRelationship);
  const undo = useOntologyStore((s) => s.undo);
  const redo = useOntologyStore((s) => s.redo);
  const doc = useOntologyStore((s) => s.doc);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;

      // Handle Undo / Redo even if inside or outside (standard conventions)
      if (isMod && (e.key === "z" || e.key === "Z")) {
        if (!isEditableTarget(e.target)) {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
      }

      if (isMod && (e.key === "y" || e.key === "Y")) {
        if (!isEditableTarget(e.target)) {
          e.preventDefault();
          redo();
          return;
        }
      }

      // Cmd+D / Ctrl+D to duplicate entity
      if (isMod && (e.key === "d" || e.key === "D")) {
        if (!isEditableTarget(e.target)) {
          e.preventDefault();
          if (selection?.kind === "entity") {
            duplicateEntity(selection.id);
          }
          return;
        }
      }

      // Don't trigger letter hotkeys or delete when typing in input/textarea
      if (isEditableTarget(e.target)) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (isMod || e.altKey) return;

      if (e.key === "Escape") {
        setSelection(null);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selection) return;
        e.preventDefault();
        switch (selection.kind) {
          case "entity":
            removeEntity(selection.id);
            break;
          case "relationship":
            removeRelationship(selection.id);
            break;
          case "action":
            removeAction(selection.id);
            break;
          case "invariant":
            removeInvariant(selection.id);
            break;
        }
        return;
      }

      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        addEntity();
        return;
      }

      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        const actionName = t("graph.defaultActionName");
        if (selection?.kind === "entity") {
          addAction(actionName, selection.id);
        } else {
          addAction(actionName);
        }
        return;
      }

      if (e.key === "r" || e.key === "R") {
        if (selection?.kind === "entity" && doc && doc.entities.length > 1) {
          e.preventDefault();
          const targetEntity = doc.entities.find((ent) => ent.id !== selection.id);
          if (targetEntity) {
            addRelationship(
              selection.id,
              targetEntity.id,
              t("graph.defaultRelationship"),
            );
          }
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selection,
    setSelection,
    addEntity,
    duplicateEntity,
    removeEntity,
    removeRelationship,
    removeAction,
    removeInvariant,
    addAction,
    addRelationship,
    undo,
    redo,
    doc,
    t,
  ]);
}

