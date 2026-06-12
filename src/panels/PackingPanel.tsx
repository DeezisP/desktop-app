

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import WarehouseService, {
  ScanQueueEntry, BackendOrderItem,
} from '../service/WarehouseService';
import { useStompContext as useStomp } from '../hooks/useStompContext';
import { useWarehouseStore } from '../store/warehouseStore';
import type { ScanQueueResponse, WarehouseOrderItemResponse } from '../types/warehouse';
import PackingSidebar from './PackingSidebar';
import PackingQueueList from './PackingQueueList';

export default function PackingPanel() {
  const { connected, subscribe } = useStomp();

  // ── Queue from store (load once, cached across navigation) ────────────────
  const storeQueue       = useWarehouseStore(s => s.queue)
  const queueLoading     = useWarehouseStore(s => s.queueLoading)
  const storeQueueLoaded = useWarehouseStore(s => s.queueLoaded)
  const storeLoadQueue   = useWarehouseStore(s => s.loadQueue)
  const applyQueueEvent  = useWarehouseStore(s => s.applyQueueEvent)
  const upsertQueueEntry = useWarehouseStore(s => s.upsertQueueEntry)
  const removeQueueEntry = useWarehouseStore(s => s.removeQueueEntry)
  const storeUpdateItem  = useWarehouseStore(s => s.updateQueueItem)
  const storeRemoveItem  = useWarehouseStore(s => s.removeQueueItem)
  const storeAddItem     = useWarehouseStore(s => s.addQueueItem)

  // Cast to ScanQueueEntry[] for child components (structurally identical at runtime)
  const queue = storeQueue as unknown as ScanQueueEntry[]

  // ── Confirm / cancel state ─────────────────────────────────────────────────
  const [confirmingIds, setConfirmingIds] = useState<Set<number>>(new Set());
  const [confirmErrors, setConfirmErrors] = useState<Record<number, string>>({});
  const [cancellingIds, setCancellingIds] = useState<Set<number>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);

  // ── Load queue once (cached across navigation) ────────────────────────────
  const loadQueue = useCallback(() => storeLoadQueue(), [storeLoadQueue]);

  useEffect(() => {
    if (!storeQueueLoaded) storeLoadQueue();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── STOMP — live queue updates ────────────────────────────────────────────
  useEffect(() => {
    return subscribe('/topic/admin/warehouse/queue', (msg) => {
      try {
        const event = JSON.parse(msg.body) as {
          type: 'SCANNED' | 'CONFIRMED' | 'CANCELLED' | 'ITEM_ADDED';
          entry?: ScanQueueEntry;
          queueId?: number;
          orderId?: number;
          item?: BackendOrderItem;
        };
        applyQueueEvent(event as Parameters<typeof applyQueueEvent>[0]);
      } catch {}
    });
  }, [subscribe, applyQueueEvent]);

  // ── Sidebar callback — upsert a scanned / quick-added entry ──────────────
  const handleEntryUpserted = useCallback((entry: ScanQueueEntry) => {
    upsertQueueEntry(entry as unknown as ScanQueueResponse);
  }, [upsertQueueEntry]);

  // ── Queue operations ──────────────────────────────────────────────────────
  const handleConfirm = useCallback(async (queueId: number) => {
    setConfirmingIds(prev => new Set(prev).add(queueId));
    setConfirmErrors(prev => { const n = { ...prev }; delete n[queueId]; return n; });
    try {
      const res = await WarehouseService.confirmPack(queueId);
      upsertQueueEntry(res.data.data as unknown as ScanQueueResponse);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setConfirmErrors(prev => ({ ...prev, [queueId]: e.response?.data?.message ?? 'ยืนยันไม่สำเร็จ' }));
    } finally {
      setConfirmingIds(prev => { const n = new Set(prev); n.delete(queueId); return n; });
    }
  }, [upsertQueueEntry]);

  const handleCancelQueue = useCallback(async (queueId: number) => {
    setCancellingIds(prev => new Set(prev).add(queueId));
    try {
      await WarehouseService.cancelScan(queueId);
      removeQueueEntry(queueId);
    } catch { /* silent */ }
    finally {
      setCancellingIds(prev => { const n = new Set(prev); n.delete(queueId); return n; });
    }
  }, [removeQueueEntry]);

  const handleBulkConfirm = useCallback(async () => {
    const pending = queue.filter(q => q.status === 'WAITING' || q.status === 'PACKING');
    if (pending.length === 0 || bulkConfirming) return;

    const carriers: Record<string, number> = {};
    for (const q of pending) {
      const sm = q.order?.shippingMethod ?? '';
      const key = sm || q.order?.platform || 'Other';
      carriers[key] = (carriers[key] ?? 0) + 1;
    }

    setBulkConfirming(true);
    try {
      await Promise.allSettled(
        pending.map(async (q) => {
          setConfirmingIds(prev => new Set(prev).add(q.id));
          try {
            const res = await WarehouseService.confirmPack(q.id);
            upsertQueueEntry(res.data.data as unknown as ScanQueueResponse);
          } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            setConfirmErrors(prev => ({ ...prev, [q.id]: e.response?.data?.message ?? 'ยืนยันไม่สำเร็จ' }));
          } finally {
            setConfirmingIds(prev => { const n = new Set(prev); n.delete(q.id); return n; });
          }
        })
      );
      WarehouseService.notifyPackingQueue(pending.length, carriers);
    } catch (err) {
      console.error('Bulk confirm unexpected error:', err);
    } finally {
      setBulkConfirming(false);
    }
  }, [queue, bulkConfirming, upsertQueueEntry]);

  const handleUpdateItem = useCallback(async (
    queueId: number,
    itemId: number,
    req: { qty?: number; matchedProductId?: number | null },
  ) => {
    const res = await WarehouseService.updateOrderItem(itemId, req);
    storeUpdateItem(queueId, itemId, res.data.data as unknown as WarehouseOrderItemResponse);
  }, [storeUpdateItem]);

  const handleRemoveItem = useCallback(async (queueId: number, itemId: number) => {
    await WarehouseService.deleteOrderItem(itemId);
    storeRemoveItem(queueId, itemId);
  }, [storeRemoveItem]);

  const handleAddItem = useCallback(async (
    queueId: number,
    orderId: number,
    req: { matchedProductId: number; qty: number; productName: string },
  ) => {
    const res = await WarehouseService.addOrderItem(orderId, req);
    storeAddItem(queueId, res.data.data as unknown as WarehouseOrderItemResponse);
  }, [storeAddItem]);

  const activeQueue = queue.filter(q => q.status === 'WAITING' || q.status === 'PACKING');

  const [searchActive, setSearchActive] = useState(false);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="pt-4 pb-24 lg:pb-4 flex flex-col lg:flex-row gap-5 items-start">

        <PackingSidebar
          connected={connected}
          queueLoading={queueLoading}
          onLoadQueue={loadQueue}
          onEntryUpserted={handleEntryUpserted}
          onSearchActive={setSearchActive}
        />

        <PackingQueueList
          queue={queue}
          queueLoading={queueLoading}
          confirmingIds={confirmingIds}
          confirmErrors={confirmErrors}
          cancellingIds={cancellingIds}
          bulkConfirming={bulkConfirming}
          onConfirm={handleConfirm}
          onCancel={handleCancelQueue}
          onBulkConfirm={handleBulkConfirm}
          onUpdateItem={handleUpdateItem}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
        />

      </div>

      {/* Mobile sticky bulk-confirm bar */}
      {activeQueue.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 px-4 py-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
          <button
            onClick={handleBulkConfirm}
            disabled={bulkConfirming}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 active:scale-[0.98] disabled:opacity-60 transition-all">
            {bulkConfirming ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {bulkConfirming ? 'กำลังยืนยัน...' : `ยืนยันแพ็คทั้งหมด (${activeQueue.length})`}
          </button>
        </div>
      )}
    </>
  );
}
