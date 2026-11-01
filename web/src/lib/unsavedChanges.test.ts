import { describe, expect, it, beforeEach } from "vitest";
import { useOntologyStore } from "../store";
import { hasUnsavedChanges } from "./unsavedChanges";

describe("unsavedChanges", () => {
  beforeEach(() => {
    useOntologyStore.setState({
      undoStack: [],
      redoStack: [],
    });
  });

  it("is dirty when undo stack is non-empty", () => {
    expect(hasUnsavedChanges()).toBe(false);
    useOntologyStore.setState({ undoStack: [{} as never] });
    expect(hasUnsavedChanges()).toBe(true);
    useOntologyStore.getState().markSaved();
    expect(hasUnsavedChanges()).toBe(false);
  });
});
