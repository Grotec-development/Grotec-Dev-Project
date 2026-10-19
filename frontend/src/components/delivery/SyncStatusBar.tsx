import React, { useEffect, useState } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  X,
} from 'lucide-react';
import { syncEngine, SyncEngineStatus } from '../../lib/offline/syncEngine';
import { getPendingOperations, QueuedOperation, removeQueueItem } from '../../lib/offline/db';

export function SyncStatusBar() {
  const [status, setStatus] = useState<SyncEngineStatus>(syncEngine.getStatus());
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [queuedItems, setQueuedItems] = useState<QueuedOperation[]>([]);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const handleOpenQueue = async () => {
    const items = await getPendingOperations();
    setQueuedItems(items);
    setIsQueueModalOpen(true);
  };

  const handleDiscard = async (id: string) => {
    if (confirm('Discard this offline change?')) {
      await removeQueueItem(id);
      const items = await getPendingOperations();
      setQueuedItems(items);
      void syncEngine.sync();
    }
  };

  // Determine styling based on sync state
  const config = {
    ONLINE_SYNCED: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
      label: 'Online — All records synchronized with server',
    },
    ONLINE_PENDING: {
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      dot: 'bg-amber-500 animate-pulse',
      icon: Clock,
      label: `${status.pendingCount} change${status.pendingCount > 1 ? 's' : ''} pending synchronization`,
    },
    OFFLINE_SAVED: {
      bg: 'bg-slate-900 border-slate-800 text-slate-100',
      dot: 'bg-amber-400',
      icon: WifiOff,
      label: `Offline — Working from saved data (${status.pendingCount} local changes queued)`,
    },
    SYNCING: {
      bg: 'bg-blue-50 border-blue-200 text-blue-900',
      dot: 'bg-blue-500',
      icon: RefreshCw,
      label: status.currentAction || 'Synchronizing with server…',
    },
    SYNC_FAILED: {
      bg: 'bg-rose-50 border-rose-200 text-rose-900',
      dot: 'bg-rose-500',
      icon: AlertTriangle,
      label: `Sync failed for ${status.pendingCount} item(s) — Tap to retry`,
    },
    CONFLICT_REVIEW: {
      bg: 'bg-purple-50 border-purple-200 text-purple-900',
      dot: 'bg-purple-500',
      icon: AlertTriangle,
      label: `${status.conflictCount} conflict(s) require review`,
    },
  }[status.state];

  const Icon = config.icon;

  return (
    <>
      <div
        className={`px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 shadow-xs transition-all duration-300 ${config.bg}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center">
            <span className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <Icon
              className={`h-4 w-4 shrink-0 ${
                status.state === 'SYNCING' ? 'animate-spin' : ''
              }`}
            />
            <span className="text-xs font-bold truncate">{config.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status.lastSyncTime && (
            <span className="text-[10px] opacity-75 hidden sm:inline">
              Last synced: {status.lastSyncTime}
            </span>
          )}

          {(status.pendingCount > 0 || status.conflictCount > 0) && (
            <button
              type="button"
              onClick={handleOpenQueue}
              className="px-2 py-1 rounded bg-black/5 hover:bg-black/10 text-[11px] font-bold flex items-center gap-1 transition"
            >
              <Layers className="h-3 w-3" />
              <span>Queue ({status.pendingCount + status.conflictCount})</span>
            </button>
          )}

          <button
            type="button"
            disabled={status.state === 'SYNCING'}
            onClick={() => void syncEngine.sync()}
            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${status.state === 'SYNCING' ? 'animate-spin' : ''}`}
            />
            <span>{status.state === 'SYNCING' ? 'Syncing' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Local Queue & Conflict Inspector Modal */}
      {isQueueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Offline Sync Queue &amp; Conflicts
                </h3>
                <p className="text-xs text-slate-500">
                  Operations stored locally on this device awaiting server acknowledgment
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQueueModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto py-3 space-y-2.5 flex-1 divide-y divide-slate-100">
              {queuedItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No pending operations in local queue.
                </div>
              ) : (
                queuedItems.map((item) => (
                  <div key={item.id} className="pt-2.5 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-800">
                        {item.action}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'CONFLICT'
                            ? 'bg-purple-100 text-purple-800'
                            : item.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : item.status === 'SYNCING'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 font-mono">
                      Stop ID: {item.stopId || '—'} • Created:{' '}
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </p>

                    {item.error && (
                      <p className="text-[11px] text-rose-600 font-medium">
                        {item.error}
                      </p>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDiscard(item.id)}
                        className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                {queuedItems.length} item(s) in queue
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsQueueModalOpen(false);
                  void syncEngine.sync();
                }}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Sync All Pending
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
