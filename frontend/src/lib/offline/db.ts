/**
 * GROTEC FarmerOS Delivery Offline Database (IndexedDB)
 * High-reliability client persistence for rural field operations.
 * Stores:
 * - cached_trips: Assigned trips, farmer records, orders & stops
 * - delivery_drafts: In-progress POD drafts (saved across app reloads)
 * - sync_queue: Offline mutations awaiting synchronization
 */

const DB_NAME = 'grotec_delivery_db';
const DB_VERSION = 1;

export interface QueuedOperation {
  id: string;
  idempotencyKey: string;
  action: 'COMPLETE_DELIVERY' | 'SUBMIT_PAYMENT' | 'RECORD_CALL' | 'UPDATE_STATUS' | 'CREATE_FIELD_LEAD';
  stopId?: string;
  tripId?: string;
  payload: any;
  evidenceBlobs?: string[]; // base64 encoded photos
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';
  createdAt: string;
  retryCount: number;
  error?: string | null;
}

export interface DeliveryDraft {
  stopId: string;
  recipientName: string;
  recipientPhone: string;
  signatureText: string;
  podNotes: string;
  deliveredItems: Array<{ orderItemId: string; deliveredQty: number }>;
  paymentCollected: boolean;
  collectedAmount?: number;
  paymentMethod?: string;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  photoUrl?: string | null;
  updatedAt: string;
}

let dbInstance: IDBDatabase | null = null;

export async function getDb(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('cached_trips')) {
        db.createObjectStore('cached_trips', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('delivery_drafts')) {
        db.createObjectStore('delivery_drafts', { keyPath: 'stopId' });
      }

      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// ---------------------------------------------------------------------------
// Cached Trips
// ---------------------------------------------------------------------------
export async function cacheActiveTrip(trip: any): Promise<void> {
  if (!trip?.id) return;
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cached_trips', 'readwrite');
    const store = tx.objectStore('cached_trips');
    store.put(trip);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedActiveTrip(): Promise<any | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cached_trips', 'readonly');
    const store = tx.objectStore('cached_trips');
    const req = store.getAll();
    req.onsuccess = () => {
      const trips = req.result || [];
      // Return the most recent trip
      resolve(trips.length > 0 ? trips[trips.length - 1] : null);
    };
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Delivery Drafts
// ---------------------------------------------------------------------------
export async function saveDeliveryDraft(draft: DeliveryDraft): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('delivery_drafts', 'readwrite');
    const store = tx.objectStore('delivery_drafts');
    store.put({ ...draft, updatedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDeliveryDraft(stopId: string): Promise<DeliveryDraft | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('delivery_drafts', 'readonly');
    const store = tx.objectStore('delivery_drafts');
    const req = store.get(stopId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearDeliveryDraft(stopId: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('delivery_drafts', 'readwrite');
    const store = tx.objectStore('delivery_drafts');
    store.delete(stopId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Sync Queue
// ---------------------------------------------------------------------------
export async function enqueueOperation(
  op: Omit<QueuedOperation, 'id' | 'idempotencyKey' | 'status' | 'createdAt' | 'retryCount'>
): Promise<QueuedOperation> {
  const db = await getDb();
  const id = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const idempotencyKey = `idemp_${id}`;

  const queued: QueuedOperation = {
    ...op,
    id,
    idempotencyKey,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    retryCount: 0,
    error: null,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.add(queued);
    tx.oncomplete = () => resolve(queued);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []) as QueuedOperation[];
      // Return items sorted by creation time
      items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateQueueItem(item: QueuedOperation): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeQueueItem(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllQueue(): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
