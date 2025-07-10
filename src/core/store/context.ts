import type { StoreApi } from "zustand/vanilla";

import type { FinderError } from "../errors.js";
import type { FileSystemAdapter, Location, Unsubscribe } from "../types.js";
import type { FinderState, LocationCache, OperationType } from "./state.js";

export interface OperationResult {
  ok: string[];
  failed: { path: string; error: FinderError }[];
}

export interface OperationEvent {
  type: OperationType;
  locationId: string;
  targets: string[];
  result: OperationResult;
}

export interface StoreCallbacks {
  onError?: (error: FinderError) => void;
  onOperation?: (event: OperationEvent) => void;
}

export interface ResolvedOptions extends StoreCallbacks {
  concurrency: number;
  searchDebounceMs: number;
}

interface Inflight {
  controller: AbortController;
  seq: number;
  promise: Promise<void>;
}

/** Mutable, closure-private bookkeeping that must never live in React-visible state. */
export interface StoreContext {
  inflight: Map<string, Inflight>;
  seq: number;
  opSeq: number;
  search: {
    timer?: ReturnType<typeof setTimeout>;
    controller?: AbortController;
  };
  watchUnsub?: Unsubscribe;
  /** Watch events received while an operation is pending; flushed when it settles. */
  deferredInvalidations: Set<string>;
  options: ResolvedOptions;
}

export function createStoreContext(options: ResolvedOptions): StoreContext {
  return {
    inflight: new Map(),
    seq: 0,
    opSeq: 0,
    search: {},
    deferredInvalidations: new Set(),
    options,
  };
}

export type SetState = StoreApi<FinderState>["setState"];
export type GetState = StoreApi<FinderState>["getState"];

export function inflightKey(locationId: string, path: string): string {
  return `${locationId}:${path}`;
}

export function locationOf(
  state: FinderState,
  locationId: string = state.currentLocationId,
): Location {
  const location = state.locations.find((l) => l.id === locationId);
  if (!location) {
    throw new Error(`Unknown location: ${locationId}`);
  }
  return location;
}

export function adapterFor(state: FinderState, locationId?: string): FileSystemAdapter {
  return locationOf(state, locationId).adapter;
}

export function cacheFor(
  state: FinderState,
  locationId: string = state.currentLocationId,
): LocationCache {
  return state.cache[locationId] ?? { entries: {}, directories: {} };
}
