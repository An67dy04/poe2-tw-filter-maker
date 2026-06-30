import type { FilterSection, FilterSettings, StrictnessProfileData } from "../types";

const DB_NAME = "poe2-tw-filter-maker";
const STORE_NAME = "state";
const KEY = "latest";

export interface PersistedState {
  sections: FilterSection[];
  settings: FilterSettings;
  manualEnabledRuleIds?: Record<string, boolean>;
  strictnessProfileData?: StrictnessProfileData;
  updatedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveState(state: Omit<PersistedState, "updatedAt">) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({ ...state, updatedAt: new Date().toISOString() }, KEY);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadState(): Promise<PersistedState | undefined> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const request = tx.objectStore(STORE_NAME).get(KEY);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as PersistedState | undefined);
    request.onerror = () => reject(request.error);
  });
}
