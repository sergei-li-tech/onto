import { useEffect } from "react";
import { useOntologyStore } from "../store";

export const LEAVE_CONFIRM =
  "You have unsaved changes. Discard and leave?";

export function hasUnsavedChanges(): boolean {
  return useOntologyStore.getState().undoStack.length > 0;
}

export function confirmDiscardChanges(): boolean {
  if (!hasUnsavedChanges()) return true;
  return window.confirm(LEAVE_CONFIRM);
}

export function useUnsavedLeaveGuard(): void {
  const dirty = useOntologyStore((s) => s.undoStack.length > 0);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
