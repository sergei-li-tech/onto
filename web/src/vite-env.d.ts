/// <reference types="vite/client" />

declare module "*.yaml?raw" {
  const content: string;
  export default content;
}

interface Window {
  showOpenFilePicker?: (
    options?: OpenFilePickerOptions,
  ) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemFileHandle>;
}
