

import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, AlertTriangle, AlertCircle, Loader2,
  Package, Trash2, Search, X, Plus, Smartphone, Clock,
} from 'lucide-react';
import WarehouseService, {
  ScanQueueEntry, BackendOrderItem, BackendQueueStatus, WarehouseProduct,
} from '../service/WarehouseService';
import {
  STATUS_META, STATUS_BAR,
  getCarrierKey, getCarrierStyle, getSectionStyle,
  ProductGroup, groupProducts, getVariantLabel,
} from '../service/packingShared';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function QueueSkeletonRow() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 border-l-4 border-l-zinc-300 dark:border-l-zinc-600 bg-white dark:bg-zinc-900 overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 space-y-1.5">
          <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-2/5" />
          <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/4" />
        </div>
        <div className="h-6 w-14 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
        <div className="h-7 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PackingQueueListProps {
  queue: ScanQueueEntry[];
  queueLoading: boolean;
  confirmingIds: Set<number>;
  confirmErrors: Record<number, string>;
  cancellingIds: Set<number>;
  bulkConfirming: boolean;
  onConfirm: (id: number) => void;
  onCancel: (id: number) => void;
  onBulkConfirm: () => void;
  onUpdateItem: (queueId: number, itemId: number, req: { qty?: number; matchedProductId?: number | null }) => Promise<void>;
  onAddItem: (queueId: number, orderId: number, req: { matchedProductId: number; qty: number; productName: string }) => Promise<void>;
  onRemoveItem: (queueId: number, itemId: number) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PackingQueueList({
  queue, queueLoading,
  confirmingIds, confirmErrors, cancellingIds, bulkConfirming,
  onConfirm, onCancel, onBulkConfirm,
  onUpdateItem, onAddItem, onRemoveItem,
}: PackingQueueListProps) {

  const activeQueue = queue.filter(q => q.status === 'WAITING' || q.status === 'PACKING');

  const carrierGroups: [string, ScanQueueEntry[]][] = (() => {
    const map = new Map<string, ScanQueueEntry[]>();
    for (const q of activeQueue) {
      const key = getCarrierKey(q.order?.shippingMethod ?? '', q.order?.platform ?? '');
      const list = map.get(key) ?? [];
      list.push(q);
      map.set(key, list);
    }
    const priority = ['Shopee', 'SPX', 'Flash', 'Lazada', 'TikTok', 'Key'];
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = priority.indexOf(a), bi = priority.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b, 'th');
    });
  })();

  return (
    <div className="order-1 lg:order-2 w-full lg:flex-1 min-w-0 flex flex-col lg:sticky lg:top-4 h-[60vh] lg:h-[calc(100vh-2rem)]">

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0 min-w-0">
        <Clock size={14} className="text-zinc-400 flex-shrink-0" />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex-shrink-0">คิวรอแพ็ค</span>
        {activeQueue.length > 0 && (
          <span className="flex-none px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            {activeQueue.length}
          </span>
        )}
        {carrierGroups.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 [scrollbar-width:none]">
            {carrierGroups.map(([carrier, entries]) => (
              <span key={carrier} className={`flex-none inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${getCarrierStyle(carrier)}`}>
                {carrier} · {entries.length}
              </span>
            ))}
          </div>
        )}
        {activeQueue.length > 0 && (
          <button
            onClick={onBulkConfirm}
            disabled={bulkConfirming}
            className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-medium hover:bg-green-700 active:scale-95 disabled:opacity-60 transition-all ml-auto flex-shrink-0">
            {bulkConfirming ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            {bulkConfirming ? 'กำลังยืนยัน...' : `ยืนยันทั้งหมด (${activeQueue.length})`}
          </button>
        )}
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {queueLoading ? (
          <div className="space-y-2">
            <QueueSkeletonRow />
            <QueueSkeletonRow />
            <QueueSkeletonRow />
          </div>
        ) : activeQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700/60 text-zinc-400 dark:text-zinc-500 gap-3">
            <Package size={28} strokeWidth={1.5} />
            <p className="text-sm">ยังไม่มีคิว — สแกนเลขคำสั่งซื้อเพื่อเริ่ม</p>
          </div>
        ) : (
          <div className="space-y-5 pb-4">
            {carrierGroups.map(([carrier, entries]) => (
              <div key={carrier}>
                {carrierGroups.length > 1 && (
                  <div className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-xl border text-xs font-medium ${getSectionStyle(carrier)}`}>
                    <Package size={12} />
                    {carrier}
                    <span className="font-normal opacity-60">({entries.length} ออเดอร์)</span>
                  </div>
                )}
                <div className="space-y-2">
                  {entries.map(entry => (
                    <QueueCard
                      key={entry.id}
                      entry={entry}
                      confirming={confirmingIds.has(entry.id)}
                      error={confirmErrors[entry.id] ?? null}
                      cancelling={cancellingIds.has(entry.id)}
                      onConfirm={onConfirm}
                      onCancel={onCancel}
                      onUpdateItem={(itemId, req) => onUpdateItem(entry.id, itemId, req)}
                      onAddItem={(orderId, req) => onAddItem(entry.id, orderId, req)}
                      onRemoveItem={(itemId) => onRemoveItem(entry.id, itemId)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── QueueCard ─────────────────────────────────────────────────────────────────

function QueueCard({
  entry, confirming, error, cancelling, onConfirm, onCancel,
  onUpdateItem, onAddItem, onRemoveItem,
}: {
  entry: ScanQueueEntry;
  confirming: boolean;
  error: string | null;
  cancelling: boolean;
  onConfirm: (id: number) => void;
  onCancel: (id: number) => void;
  onUpdateItem: (itemId: number, req: { qty?: number; matchedProductId?: number | null }) => Promise<void>;
  onAddItem: (orderId: number, req: { matchedProductId: number; qty: number; productName: string }) => Promise<void>;
  onRemoveItem: (itemId: number) => Promise<void>;
}) {
  const m = STATUS_META[entry.status];
  const items = entry.order?.items ?? [];
  const unmatchedCount = items.filter(i => !i.matchedProductId).length;
  const totalQty = items.reduce((s, i) => s + (i.qty ?? 0), 0);

  const scannerParts = entry.stationId?.includes(':')
    ? entry.stationId.split(':', 2) as [string, string]
    : null;
  const scannerUser = scannerParts?.[1] ?? entry.stationId ?? null;

  const [qtyEditId, setQtyEditId]     = useState<number | null>(null);
  const [qtyEditVal, setQtyEditVal]   = useState('');
  const [qtyLoading, setQtyLoading]   = useState<Set<number>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());

  const [searchItemId, setSearchItemId]   = useState<number | null>(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<WarehouseProduct[]>([]);
  const [searchGroup, setSearchGroup]     = useState<ProductGroup | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [linkLoading, setLinkLoading]     = useState<Set<number>>(new Set());
  const [itemErrors, setItemErrors]       = useState<Record<number, string>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isManualOpen, setIsManualOpen]               = useState(false);
  const [manualQuery, setManualQuery]                 = useState('');
  const [manualResults, setManualResults]             = useState<WarehouseProduct[]>([]);
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const [manualGroup, setManualGroup]                 = useState<ProductGroup | null>(null);
  const [manualProduct, setManualProduct]             = useState<WarehouseProduct | null>(null);
  const [manualQty, setManualQty]                     = useState('1');
  const [manualLoading, setManualLoading]             = useState(false);
  const [manualError, setManualError]                 = useState<string | null>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (searchItemId == null || !searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await WarehouseService.searchProducts(searchQuery);
        setSearchResults(res.data.data);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchItemId]);

  useEffect(() => {
    if (!isManualOpen) { setManualResults([]); return; }
  }, [isManualOpen]);

  useEffect(() => {
    if (!manualQuery.trim() || manualProduct) { setManualResults([]); return; }
    const timer = setTimeout(async () => {
      setManualSearchLoading(true);
      try {
        const res = await WarehouseService.searchProducts(manualQuery);
        setManualResults(res.data.data);
      } catch { setManualResults([]); }
      finally { setManualSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [manualQuery, manualProduct]);

  const resetManual = () => {
    setIsManualOpen(false);
    setManualQuery('');
    setManualResults([]);
    setManualGroup(null);
    setManualProduct(null);
    setManualQty('1');
    setManualError(null);
  };

  const commitManual = async () => {
    if (!manualProduct || !entry.order) return;
    const qty = parseInt(manualQty, 10);
    if (isNaN(qty) || qty < 1) { setManualError('จำนวนต้องมากกว่า 0'); return; }
    setManualLoading(true);
    setManualError(null);
    try {
      await onAddItem(entry.order.id, { matchedProductId: manualProduct.id, qty, productName: manualProduct.title });
      resetManual();
    } catch {
      setManualError('เพิ่มสินค้าไม่สำเร็จ');
    } finally {
      setManualLoading(false);
    }
  };

  const commitQty = async (item: BackendOrderItem) => {
    const newQty = parseInt(qtyEditVal, 10);
    setQtyEditId(null);
    if (!isNaN(newQty) && newQty > 0 && newQty !== item.qty) {
      setQtyLoading(prev => new Set(prev).add(item.id));
      setItemErrors(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      try {
        await onUpdateItem(item.id, { qty: newQty });
      } catch {
        setItemErrors(prev => ({ ...prev, [item.id]: 'อัปเดตจำนวนไม่สำเร็จ' }));
      } finally {
        setQtyLoading(prev => { const n = new Set(prev); n.delete(item.id); return n; });
      }
    }
  };

  const linkProduct = async (item: BackendOrderItem, product: WarehouseProduct) => {
    setSearchItemId(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchGroup(null);
    setLinkLoading(prev => new Set(prev).add(item.id));
    setItemErrors(prev => { const n = { ...prev }; delete n[item.id]; return n; });
    try {
      await onUpdateItem(item.id, { matchedProductId: product.id });
    } catch {
      setItemErrors(prev => ({ ...prev, [item.id]: 'เชื่อมสินค้าไม่สำเร็จ' }));
    } finally {
      setLinkLoading(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  };

  return (
    <div className={`rounded-xl border border-zinc-200 dark:border-zinc-700 border-l-4 ${STATUS_BAR[entry.status]} bg-white dark:bg-zinc-900 overflow-hidden shadow-sm`}>

      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-1 min-w-0 text-left py-0.5">
          <p className="font-mono text-sm text-zinc-900 dark:text-zinc-100 leading-tight truncate">
            {entry.orderNumber}
          </p>
          {entry.order?.customerName && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate leading-tight mt-0.5">
              {entry.order.customerName}
            </p>
          )}
        </button>

        <div className="flex items-center gap-1 flex-shrink-0 flex-nowrap">
          <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
            {items.length}×{totalQty}
          </span>
          {unmatchedCount > 0 && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
              <AlertTriangle size={9} />{unmatchedCount}
            </span>
          )}
          {scannerUser && (
            <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700">
              <Smartphone size={8} />{scannerUser}
            </span>
          )}
          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full border whitespace-nowrap ${m.bg} ${m.text} ${m.border}`}>
            {m.label}
          </span>
        </div>
        
        <button
          onClick={() => onCancel(entry.id)}
          disabled={cancelling}
          title="ลบออกจากคิว"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 flex-shrink-0">
          {cancelling ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      </div>

      {error && (
        <div className="mx-3 mb-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <AlertCircle size={11} className="flex-shrink-0" />{error}
          </p>
        </div>
      )}

      {expanded && (
        <div className="px-4 pt-2.5 pb-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          {items.length === 0 ? (
            <p className="text-xs text-zinc-400 italic py-1">ไม่มีรายการสินค้า</p>
          ) : (
            <div className="space-y-3">
              {items.map(item => {
                const matched       = !!item.matchedProductId;
                const isQtyEditing  = qtyEditId === item.id;
                const isSearchOpen  = searchItemId === item.id;
                const isQtyLoading  = qtyLoading.has(item.id);
                const isLinkLoading = linkLoading.has(item.id);
                const isRemoving    = removingIds.has(item.id);
                const itemErr       = itemErrors[item.id];
                return (
                  <div key={item.id}>
                    <div className="flex items-start gap-3">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 ${matched ? 'bg-green-500' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-snug">
                          {item.productName || <span className="text-zinc-400 italic">ไม่มีชื่อสินค้า</span>}
                        </p>
                        {item.variant && <p className="text-[11px] text-zinc-400 mt-0.5">{item.variant}</p>}
                        {item.sku && <p className="text-[10px] font-mono text-zinc-400">{item.sku}</p>}
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {isQtyEditing ? (
                          <div className="flex items-center rounded-lg border-2 border-blue-400 bg-white dark:bg-zinc-800 overflow-hidden">
                            <button type="button" onMouseDown={e => { e.preventDefault(); setQtyEditVal(v => String(Math.max(1, (parseInt(v) || 1) - 1))); }} className="px-1.5 py-0.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors select-none text-sm">−</button>
                            <input
                              type="number"
                              min="1"
                              value={qtyEditVal}
                              onChange={e => setQtyEditVal(e.target.value)}
                              onBlur={() => commitQty(item)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitQty(item);
                                if (e.key === 'Escape') setQtyEditId(null);
                              }}
                              className="w-10 text-center text-sm bg-transparent text-zinc-700 dark:text-zinc-200 focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button type="button" onMouseDown={e => { e.preventDefault(); setQtyEditVal(v => String((parseInt(v) || 0) + 1)); }} className="px-1.5 py-0.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors select-none text-sm">+</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setQtyEditId(item.id); setQtyEditVal(String(item.qty)); }}
                            disabled={isQtyLoading}
                            title="คลิกเพื่อแก้ไขจำนวน"
                            className="text-base text-zinc-700 dark:text-zinc-200 tabular-nums leading-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50">
                            {isQtyLoading ? <Loader2 size={14} className="animate-spin" /> : `×${item.qty}`}
                          </button>
                        )}

                        {matched && item.productStock != null ? (
                          <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-1.5 py-0.5 rounded-full whitespace-nowrap tabular-nums">
                            {item.productStock.toLocaleString()}
                          </span>
                        ) : !matched ? (
                          <button
                            onClick={() => { setSearchItemId(item.id); setSearchQuery(''); setSearchResults([]); }}
                            disabled={isLinkLoading}
                            className="text-[9px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 rounded-full whitespace-nowrap hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50">
                            {isLinkLoading ? <Loader2 size={10} className="animate-spin inline" /> : 'ไม่พบในคลัง'}
                          </button>
                        ) : null}

                        <button
                          onClick={async () => {
                            setRemovingIds(prev => new Set(prev).add(item.id));
                            try { await onRemoveItem(item.id); }
                            finally { setRemovingIds(prev => { const n = new Set(prev); n.delete(item.id); return n; }); }
                          }}
                          disabled={isRemoving}
                          title="ลบสินค้านี้ออกจากออเดอร์"
                          className="p-0.5 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40">
                          {isRemoving ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    </div>

                    {itemErr && (
                      <p className="mt-1 ml-4 text-[10px] text-red-500 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle size={9} />{itemErr}
                      </p>
                    )}

                    {isSearchOpen && (
                      <div className="mt-2 ml-4 space-y-1.5">
                        {!searchGroup ? (
                          <>
                            <div className="relative">
                              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                              <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Escape' && setSearchItemId(null)}
                                placeholder="ค้นหาชื่อสินค้าในคลัง..."
                                className="w-full pl-7 pr-8 py-1.5 text-xs rounded-lg border-2 border-amber-300 dark:border-amber-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:border-blue-400 transition-colors"
                              />
                              <button
                                onClick={() => setSearchItemId(null)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                                <X size={11} />
                              </button>
                            </div>
                            {searchLoading && (
                              <div className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-400">
                                <Loader2 size={11} className="animate-spin" /> ค้นหา...
                              </div>
                            )}
                            {!searchLoading && searchResults.length > 0 && (
                              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-700/60 max-h-40 overflow-y-auto">
                                {groupProducts(searchResults).slice(0, 8).map(g => {
                                  const totalStock = g.items.reduce((s, p) => s + p.availableStock, 0);
                                  return (
                                    <button
                                      key={g.base}
                                      onClick={() => {
                                        if (g.items.length === 1) { linkProduct(item, g.items[0]); }
                                        else { setSearchGroup(g); setSearchResults([]); }
                                      }}
                                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                      <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate flex-1">{g.base}</span>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {g.items.length > 1 && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                            {g.items.length} ตัวเลือก
                                          </span>
                                        )}
                                        <span className="text-[10px] text-zinc-400 tabular-nums">{totalStock.toLocaleString()}</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
                              <p className="text-[10px] text-zinc-400 px-2 py-1">ไม่พบสินค้าที่ตรงกับ &ldquo;{searchQuery}&rdquo;</p>
                            )}
                          </>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-end">
                              <button onClick={() => setSearchGroup(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                                <X size={12} />
                              </button>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
                              {searchGroup.items.map(p => {
                                const label = getVariantLabel(p.title, searchGroup.base);
                                if (!label) return null;
                                return (
                                  <button
                                    key={p.id}
                                    onClick={() => linkProduct(item, p)}
                                    className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-700 dark:text-zinc-300 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-center truncate">
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {entry.order && (
            <div>
              {!isManualOpen ? (
                <button
                  onClick={() => setIsManualOpen(true)}
                  className="flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                  <Plus size={12} />เพิ่มสินค้าด้วยตนเอง
                </button>
              ) : (
                <div className="rounded-xl border border-blue-200 dark:border-blue-700/60 bg-blue-50/60 dark:bg-blue-900/10 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide">เพิ่มสินค้าด้วยตนเอง</p>
                    <button onClick={resetManual} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><X size={13} /></button>
                  </div>

                  {!manualProduct ? (
                    <>
                      {!manualGroup ? (
                        <>
                          <div className="relative">
                            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                            <input
                              ref={manualInputRef}
                              type="text"
                              value={manualQuery}
                              onChange={e => setManualQuery(e.target.value)}
                              placeholder="ค้นหาชื่อสินค้าในคลัง..."
                              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:border-blue-400 transition-colors"
                            />
                          </div>
                          {manualSearchLoading && (
                            <div className="flex items-center gap-2 px-1 text-xs text-zinc-400">
                              <Loader2 size={11} className="animate-spin" /> ค้นหา...
                            </div>
                          )}
                          {!manualSearchLoading && manualResults.length > 0 && (
                            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-700/60 max-h-36 overflow-y-auto">
                              {groupProducts(manualResults).slice(0, 8).map(g => {
                                const totalStock = g.items.reduce((s, p) => s + p.availableStock, 0);
                                return (
                                  <button
                                    key={g.base}
                                    onClick={() => {
                                      if (g.items.length === 1) { setManualProduct(g.items[0]); setManualResults([]); }
                                      else { setManualGroup(g); setManualResults([]); }
                                    }}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                    <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate flex-1">{g.base}</span>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {g.items.length > 1 && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                          {g.items.length} ตัวเลือก
                                        </span>
                                      )}
                                      <span className="text-[10px] text-zinc-400 tabular-nums">{totalStock.toLocaleString()}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {!manualSearchLoading && manualQuery.trim() && manualResults.length === 0 && (
                            <p className="text-[10px] text-zinc-400 px-1">ไม่พบสินค้าที่ตรงกับ &ldquo;{manualQuery}&rdquo;</p>
                          )}
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-end">
                            <button onClick={() => setManualGroup(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                              <X size={12} />
                            </button>
                          </div>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
                            {manualGroup.items.map(p => {
                              const label = getVariantLabel(p.title, manualGroup.base);
                              if (!label) return null;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => { setManualProduct(p); setManualGroup(null); }}
                                  className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-700 dark:text-zinc-300 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-center truncate">
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs text-zinc-800 dark:text-zinc-200 truncate flex-1">{manualProduct.title}</p>
                        <span className="text-[10px] text-zinc-400 flex-shrink-0 tabular-nums">{manualProduct.stock.toLocaleString()}</span>
                        <button onClick={() => { setManualProduct(null); setManualQuery(''); }} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex-shrink-0"><X size={11} /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-400 flex-shrink-0">จำนวน</span>
                        <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden">
                          <button type="button" onClick={() => setManualQty(v => String(Math.max(1, (parseInt(v) || 1) - 1)))} className="px-2 py-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors select-none text-sm">−</button>
                          <span className="w-8 text-center text-xs text-zinc-700 dark:text-zinc-200 tabular-nums">{manualQty}</span>
                          <button type="button" onClick={() => setManualQty(v => String((parseInt(v) || 0) + 1))} className="px-2 py-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors select-none text-sm">+</button>
                        </div>
                        <button
                          onClick={commitManual}
                          disabled={manualLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors min-h-[44px] sm:min-h-0">
                          {manualLoading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                          เพิ่ม
                        </button>
                      </div>
                      {manualError && (
                        <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle size={9} />{manualError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{items.length} รายการ · {totalQty} ชิ้น</span>
            {unmatchedCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={10} />
                {unmatchedCount} รายการไม่จับคู่
              </span>
            )}
            {entry.order?.trackingNumber && (
              <span className="ml-auto font-mono text-[10px] text-zinc-400 truncate">
                {entry.order.trackingNumber}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
