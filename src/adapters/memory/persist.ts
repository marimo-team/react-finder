import { MemoryAdapter } from "./memoryAdapter.js";
import type { MemoryAdapterOptions, MemoryPersistence } from "./memoryAdapter.js";

/** Persist a `MemoryAdapter` snapshot in any `Storage` (localStorage, sessionStorage). */
export function storagePersist(storage: Storage, key: string): MemoryPersistence {
  return {
    load: () => storage.getItem(key),
    save: (json) => {
      storage.setItem(key, json);
    },
  };
}

export interface StorageAdapterOptions extends Omit<MemoryAdapterOptions, "persist" | "fs"> {
  /** Storage key. Default "react-finder". */
  key?: string;
  /** Storage to use; defaults to the browser storage named by the factory. */
  storage?: Storage;
}

/** A `MemoryAdapter` persisted in the given `Storage` (falls back to plain memory when unavailable). */
export function createStorageAdapter(
  storage: Storage | undefined,
  options: StorageAdapterOptions = {},
): MemoryAdapter {
  const { key = "react-finder", storage: override, ...rest } = options;
  const target = override ?? storage;
  return new MemoryAdapter({
    ...rest,
    persist: target ? storagePersist(target, key) : undefined,
  });
}

const globalStorage = (name: "sessionStorage" | "localStorage") =>
  typeof globalThis === "undefined"
    ? undefined
    : (globalThis as unknown as Record<string, Storage | undefined>)[name];

/** A `MemoryAdapter` that survives reloads by saving into `sessionStorage`. */
export function createSessionStorageAdapter(options: StorageAdapterOptions = {}): MemoryAdapter {
  return createStorageAdapter(globalStorage("sessionStorage"), options);
}

/** A `MemoryAdapter` that survives reloads by saving into `localStorage`. */
export function createLocalStorageAdapter(options: StorageAdapterOptions = {}): MemoryAdapter {
  return createStorageAdapter(globalStorage("localStorage"), options);
}
