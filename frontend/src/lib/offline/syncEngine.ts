/**
 * GROTEC FarmerOS Offline-to-Online Synchronization Engine
 * Automatically detects real network + server availability, processes
 * queued actions in order, enforces idempotency, handles conflicts, and notifies the UI.
 */

import { api } from '../api';
import {
  getPendingOperations,
  updateQueueItem,
  removeQueueItem,
  QueuedOperation,
  cacheActiveTrip,
} from './db';

export type SyncStatusState =
  | 'ONLINE_SYNCED'
  | 'ONLINE_PENDING'
  | 'OFFLINE_SAVED'
  | 'SYNCING'
  | 'SYNC_FAILED'
  | 'CONFLICT_REVIEW';

export interface SyncEngineStatus {
  isOnline: boolean;
  state: SyncStatusState;
  pendingCount: number;
  conflictCount: number;
  lastSyncTime: string | null;
  currentAction: string | null;
  errorMessage: string | null;
}

type Listener = (status: SyncEngineStatus) => void;

class SyncEngine {
  private listeners: Set<Listener> = new Set();
  private isProcessing = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastSyncTime: string | null = null;
  private currentAction: string | null = null;
  private errorMessage: string | null = null;
  private heartbeatInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));

      // Periodic heartbeat and sync check every 15s
      this.heartbeatInterval = setInterval(() => {
        void this.checkServerConnectivityAndSync();
      }, 15_000);

      // Initial check
      setTimeout(() => {
        void this.checkServerConnectivityAndSync();
      }, 1_000);
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  public getStatus(): SyncEngineStatus {
    let state: SyncStatusState = 'ONLINE_SYNCED';

    if (!this.isOnline) {
      state = 'OFFLINE_SAVED';
    } else if (this.isProcessing) {
      state = 'SYNCING';
    }

    return {
      isOnline: this.isOnline,
      state,
      pendingCount: 0,
      conflictCount: 0,
      lastSyncTime: this.lastSyncTime,
      currentAction: this.currentAction,
      errorMessage: this.errorMessage,
    };
  }

  private notify() {
    void this.getComputedStatus().then((status) => {
      this.listeners.forEach((fn) => fn(status));
    });
  }

  public async getComputedStatus(): Promise<SyncEngineStatus> {
    const queue = await getPendingOperations();
    const pending = queue.filter((i) => i.status === 'PENDING' || i.status === 'FAILED');
    const conflicts = queue.filter((i) => i.status === 'CONFLICT');

    let state: SyncStatusState = 'ONLINE_SYNCED';
    if (!this.isOnline) {
      state = 'OFFLINE_SAVED';
    } else if (this.isProcessing) {
      state = 'SYNCING';
    } else if (conflicts.length > 0) {
      state = 'CONFLICT_REVIEW';
    } else if (pending.length > 0) {
      const hasFailed = pending.some((i) => i.status === 'FAILED');
      state = hasFailed ? 'SYNC_FAILED' : 'ONLINE_PENDING';
    }

    return {
      isOnline: this.isOnline,
      state,
      pendingCount: pending.length,
      conflictCount: conflicts.length,
      lastSyncTime: this.lastSyncTime,
      currentAction: this.currentAction,
      errorMessage: this.errorMessage,
    };
  }

  private handleNetworkChange(online: boolean) {
    this.isOnline = online;
    this.notify();
    if (online) {
      void this.sync();
    }
  }

  public async checkServerConnectivityAndSync(): Promise<boolean> {
    try {
      // Test real HTTP reachability
      const res = await fetch('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });

      const serverReachable = res.status < 500;
      this.isOnline = serverReachable;
      this.notify();

      if (serverReachable) {
        await this.sync();
        return true;
      }
      return false;
    } catch {
      this.isOnline = false;
      this.notify();
      return false;
    }
  }

  /**
   * Main synchronization loop
   */
  public async sync(): Promise<void> {
    if (this.isProcessing) return;
    if (!this.isOnline) return;

    this.isProcessing = true;
    this.errorMessage = null;
    this.notify();

    try {
      const queue = await getPendingOperations();
      const eligible = queue.filter(
        (item) => item.status === 'PENDING' || item.status === 'FAILED'
      );

      for (const op of eligible) {
        this.currentAction = `Syncing ${op.action} (stop #${op.stopId?.slice(0, 6) || ''})`;
        op.status = 'SYNCING';
        await updateQueueItem(op);
        this.notify();

        try {
          await this.executeOperation(op);
          // Acknowledged by server — safely remove from local queue
          await removeQueueItem(op.id);
          this.lastSyncTime = new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        } catch (err: any) {
          const status = err?.response?.status;
          const msg = err?.response?.data?.error?.message || err?.message || 'Synchronization error';

          if (status === 409 || status === 400 && msg.toLowerCase().includes('already')) {
            // Conflict requiring manager review
            op.status = 'CONFLICT';
            op.error = `Conflict: ${msg}`;
            await updateQueueItem(op);
          } else {
            // Transient network or retryable failure
            op.status = 'FAILED';
            op.retryCount += 1;
            op.error = msg;
            await updateQueueItem(op);
          }
          this.errorMessage = msg;
        }
      }

      // Refresh authoritative active trip in cache after successful sync
      try {
        const tripRes = await api.get('/delivery/active-trip');
        if (tripRes.data) {
          await cacheActiveTrip(tripRes.data);
        }
      } catch {}
    } finally {
      this.isProcessing = false;
      this.currentAction = null;
      this.notify();
    }
  }

  private async executeOperation(op: QueuedOperation): Promise<any> {
    switch (op.action) {
      case 'COMPLETE_DELIVERY':
        return (
          await api.post(`/delivery/stops/${op.stopId}/complete`, {
            ...op.payload,
            idempotencyKey: op.idempotencyKey,
          })
        ).data;

      case 'SUBMIT_PAYMENT':
        return (
          await api.post(`/delivery/stops/${op.stopId}/payments`, {
            ...op.payload,
            idempotencyKey: op.idempotencyKey,
          })
        ).data;

      case 'RECORD_CALL':
        return (
          await api.post(`/delivery/stops/${op.stopId}/call-outcome`, {
            ...op.payload,
          })
        ).data;

      case 'UPDATE_STATUS':
        return (
          await api.patch(`/delivery/stops/${op.stopId}/status`, {
            ...op.payload,
          })
        ).data;

      case 'CREATE_FIELD_LEAD':
        return (
          await api.post(`/delivery/field-lead`, {
            ...op.payload,
            idempotencyKey: op.idempotencyKey,
          })
        ).data;

      default:
        throw new Error(`Unknown queued action: ${op.action}`);
    }
  }
}

export const syncEngine = new SyncEngine();
