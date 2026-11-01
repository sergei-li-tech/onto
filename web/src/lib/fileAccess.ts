import type { Ontology } from "../types";
import { serializeOntology } from "./yaml";
import { validateOntology } from "./validate";

export type FileHandleState = {
  handle: FileSystemFileHandle | null;
  name: string | null;
};

export async function pickYamlFile(): Promise<{ text: string; handle: FileSystemFileHandle } | null> {
  if (!("showOpenFilePicker" in window)) {
    alert("Please open the app in Chrome — disk file access is required.");
    return null;
  }
  const [handle] = await window.showOpenFilePicker({
    types: [
      {
        description: "YAML",
        accept: { "text/yaml": [".yaml", ".yml"] },
      },
    ],
  });
  const file = await handle.getFile();
  return { text: await file.text(), handle };
}

export async function saveYamlAs(doc: Ontology): Promise<FileSystemFileHandle | null> {
  const errors = validateOntology(doc);
  if (errors.length) {
    alert(`Save blocked:\n${errors.slice(0, 8).join("\n")}`);
    return null;
  }
  if (!("showSaveFilePicker" in window)) {
    alert("Saving is supported in Chrome.");
    return null;
  }
  const handle = await window.showSaveFilePicker({
    suggestedName: `${doc.domain}.yaml`,
    types: [
      {
        description: "YAML",
        accept: { "text/yaml": [".yaml"] },
      },
    ],
  });
  await writeHandle(handle, doc);
  return handle;
}

export async function saveYamlToHandle(
  handle: FileSystemFileHandle,
  doc: Ontology,
): Promise<boolean> {
  const errors = validateOntology(doc);
  if (errors.length) {
    alert(`Save blocked:\n${errors.slice(0, 8).join("\n")}`);
    return false;
  }
  await writeHandle(handle, doc);
  return true;
}

async function writeHandle(handle: FileSystemFileHandle, doc: Ontology): Promise<void> {
  const writable = await handle.createWritable();
  const body = serializeOntology({
    ...doc,
    updated_at: new Date().toISOString(),
  });
  await writable.write(body);
  await writable.close();
}
