// ──────────────────────────────────────────────────────────
// Variant DB — IndexedDB persistence for variants & waitlist
// ──────────────────────────────────────────────────────────

import { openDB, type IDBPDatabase } from "idb";
import type { VariantData, FeedbackItem } from "../store";

const DB_NAME = "designdead-variants";
const DB_VERSION = 1;
const VARIANT_STORE = "variants";
const WAITLIST_STORE = "waitlist";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in SSR"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(VARIANT_STORE)) {
          db.createObjectStore(VARIANT_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(WAITLIST_STORE)) {
          db.createObjectStore(WAITLIST_STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

// ── Variant operations ──────────────────────────────────────

export async function saveVariant(variant: VariantData): Promise<void> {
  const db = await getDB();
  await db.put(VARIANT_STORE, variant);
}

export async function getVariant(id: string): Promise<VariantData | undefined> {
  const db = await getDB();
  return db.get(VARIANT_STORE, id);
}

export async function getAllVariants(): Promise<VariantData[]> {
  const db = await getDB();
  return db.getAll(VARIANT_STORE);
}

export async function deleteVariant(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(VARIANT_STORE, id);
}

export async function clearVariants(): Promise<void> {
  const db = await getDB();
  await db.clear(VARIANT_STORE);
}

// ── Waitlist operations ─────────────────────────────────────

export async function saveFeedbackItem(item: FeedbackItem): Promise<void> {
  const db = await getDB();
  await db.put(WAITLIST_STORE, item);
}

export async function getAllFeedbackItems(): Promise<FeedbackItem[]> {
  const db = await getDB();
  return db.getAll(WAITLIST_STORE);
}

export async function deleteFeedbackItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(WAITLIST_STORE, id);
}

export async function clearWaitlist(): Promise<void> {
  const db = await getDB();
  await db.clear(WAITLIST_STORE);
}

// ── Cleanup: remove variants older than MAX_AGE ─────────────

export async function cleanupOldVariants(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll(VARIANT_STORE) as VariantData[];
  const now = Date.now();
  let removed = 0;

  const tx = db.transaction(VARIANT_STORE, "readwrite");
  for (const variant of all) {
    if (now - variant.createdAt > MAX_AGE_MS) {
      await tx.store.delete(variant.id);
      removed++;
    }
  }
  await tx.done;
  return removed;
}
