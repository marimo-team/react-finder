import type { Capabilities, FileSystemAdapter } from "./types.js";

export function getCapabilities(adapter: FileSystemAdapter): Capabilities {
  return {
    stat: typeof adapter.stat === "function",
    createFile: typeof adapter.createFile === "function",
    createDirectory: typeof adapter.createDirectory === "function",
    delete: typeof adapter.delete === "function",
    move: typeof adapter.move === "function",
    copy: typeof adapter.copy === "function",
    readFile: typeof adapter.readFile === "function",
    writeFile: typeof adapter.writeFile === "function",
    download: typeof adapter.getDownloadUrl === "function",
    search: typeof adapter.search === "function",
    watch: typeof adapter.watch === "function",
  };
}

export const NO_CAPABILITIES: Capabilities = {
  stat: false,
  createFile: false,
  createDirectory: false,
  delete: false,
  move: false,
  copy: false,
  readFile: false,
  writeFile: false,
  download: false,
  search: false,
  watch: false,
};
