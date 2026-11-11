import type { Ontology, TechnicalMapping } from "../types";
import { serializeOntology } from "./yaml";
import { serializeTechnicalMapping } from "./technicalMapping";
import { blockingIssues, validateOntology } from "./validate";
import { formatValidationIssues } from "./validationMessages";
import { t } from "../i18n";

export type FileHandleState = {
  handle: FileSystemFileHandle | null;
  name: string | null;
};

export async function pickYamlFile(): Promise<{ text: string; handle: FileSystemFileHandle } | null> {
  if (!("showOpenFilePicker" in window)) {
    alert(t("file.chromeOpen"));
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
  const errors = blockingIssues(validateOntology(doc));
  if (errors.length) {
    alert(t("file.saveBlocked", { errors: formatValidationIssues(errors).slice(0, 8).join("\n") }));
    return null;
  }
  if (!("showSaveFilePicker" in window)) {
    alert(t("file.chromeSave"));
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
  const errors = blockingIssues(validateOntology(doc));
  if (errors.length) {
    alert(t("file.saveBlocked", { errors: formatValidationIssues(errors).slice(0, 8).join("\n") }));
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

export async function saveMappingYamlAs(
  mapping: TechnicalMapping,
  suggestedName: string,
): Promise<FileSystemFileHandle | null> {
  if (!("showSaveFilePicker" in window)) {
    alert(t("file.chromeSave"));
    return null;
  }
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: "Technical Mapping YAML",
        accept: { "text/yaml": [".yaml", ".yml"] },
      },
    ],
  });
  await writeMappingHandle(handle, mapping);
  return handle;
}

export async function saveMappingYamlToHandle(
  handle: FileSystemFileHandle,
  mapping: TechnicalMapping,
): Promise<boolean> {
  await writeMappingHandle(handle, mapping);
  return true;
}

async function writeMappingHandle(
  handle: FileSystemFileHandle,
  mapping: TechnicalMapping,
): Promise<void> {
  const writable = await handle.createWritable();
  const body = serializeTechnicalMapping(mapping);
  await writable.write(body);
  await writable.close();
}

