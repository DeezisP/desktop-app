

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import WarehouseService, {
  type BackendOrder,
  type BackendOrderItem,
  type BackendMatchConfidence,
  type BackendImportStatus,
  type BackendQueueStatus,
  type WarehouseProduct,
} from '../service/WarehouseService';

type StatusFilter = 'ALL' | BackendImportStatus;
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL',       label: 'ทั้งหมด' },
  { value: 'IMPORTED',  label: 'ยังไม่แพ็ค' },
  { value: 'PACKED',    label: 'แพ็คแล้ว' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
];

type SourceFilter = 'ALL' | 'lazada' | 'spx' | 'tiktok' | 'flash' | 'key' | 'sonduan' | 'sontantee';
const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'ALL',       label: 'ทุกแหล่ง' },
  { value: 'lazada',    label: 'Lazada' },
  { value: 'spx',       label: 'SPX' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'flash',     label: 'Flash' },
  { value: 'key',       label: 'KEY' },
  { value: 'sonduan',   label: 'ส่งด่วน' },
  { value: 'sontantee', label: 'ส่งทันที' },
];

function matchesSource(source: SourceFilter, shippingMethod: string | null): boolean {
  if (source === 'ALL') return true;
  const sm = shippingMethod ?? '';
  switch (source) {
    case 'lazada':    return /lazada/i.test(sm);
    case 'spx':       return /spx/i.test(sm);
    case 'tiktok':    return /tiktok/i.test(sm);
    case 'flash':     return /flash/i.test(sm);
    case 'key':       return /\bkey\b/i.test(sm);
    case 'sonduan':   return sm.includes('ส่งด่วน');
    case 'sontantee': return sm.includes('ส่งทันที');
    default:          return false;
  }
}

const IMPORT_STATUS_META: Record<BackendImportStatus, {
  bg: string; text: string; border: string; dot: string; label: string;
}> = {
  IMPORTED:  { bg: 'bg-blue-50 dark:bg-blue-900/20',  text: 'text-blue-700 dark:text-blue-400',  border: 'border-blue-200 dark:border-blue-700',  dot: 'bg-blue-500',  label: 'ยังไม่แพ็ค' },
  PACKED:    { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-700', dot: 'bg-green-500', label: 'แพ็คแล้ว' },
  CANCELLED: { bg: 'bg-zinc-100 dark:bg-zinc-800',     text: 'text-zinc-500 dark:text-zinc-400',   border: 'border-zinc-200 dark:border-zinc-700',   dot: 'bg-zinc-400',  label: 'ยกเลิก' },
};

const MATCH_META: Record<BackendMatchConfidence, { dot: string; label: string; text: string }> = {
  EXACT:     { dot: 'bg-green-500',  label: 'ตรง',       text: 'text-green-600 dark:text-green-400' },
  CONTAINS:  { dot: 'bg-blue-500',   label: 'ใกล้เคียง', text: 'text-blue-600 dark:text-blue-400' },
  TOKEN:     { dot: 'bg-amber-500',  label: 'Token',     text: 'text-amber-600 dark:text-amber-400' },
  UNMATCHED: { dot: 'bg-red-400',    label: 'ไม่พบ',     text: 'text-red-500 dark:text-red-400' },
};

const PLATFORM_META: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  shopee: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-700', dot: 'bg-orange-500' },
  lazada: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-700', dot: 'bg-purple-500' },
  spx:    { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-700', dot: 'bg-orange-600' },
  tiktok: { bg: 'bg-pink-50 dark:bg-pink-900/20',     text: 'text-pink-600 dark:text-pink-400',     border: 'border-pink-200 dark:border-pink-700',     dot: 'bg-pink-500' },
  flash:  { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-700', dot: 'bg-yellow-500' },
};

function getPlatformMeta(platform: string | null) {
  if (!platform) return null;
  return PLATFORM_META[platform.toLowerCase()] ?? null;
}

const PAGE_SIZE = 30;

const TODAY_STR = new Date().toISOString().slice(0, 10);

function toDateKey(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function formatDateLabel(dateKey: string): string {
  if (dateKey === TODAY_STR) return 'วันนี้';
  return String(parseInt(dateKey.slice(8, 10), 10));
}

type MergedItem = {
  key: string;
  ids: number[];
  productName: string | null;
  variant: string | null;
  sku: string | null;
  qty: number;
  price: number;
  matchedProductId: number | null;
  matchConfidence: BackendMatchConfidence | null;
  productStock: number | null;
};

function mergeOrderItems(items: BackendOrderItem[]): MergedItem[] {
  const map = new Map<string, MergedItem>();
  for (const item of items) {
    const key = [item.productName?.trim() ?? '', item.variant?.trim() ?? '', item.sku?.trim() ?? ''].join('||');
    const ex = map.get(key);
    if (ex) { ex.ids.push(item.id); ex.qty += item.qty; }
    else map.set(key, { key, ids: [item.id], productName: item.productName, variant: item.variant, sku: item.sku, qty: item.qty, price: item.price, matchedProductId: item.matchedProductId, matchConfidence: item.matchConfidence, productStock: item.productStock });
  }
  return Array.from(map.values());
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3" />
        <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2" />
      </div>
      <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
    </div>
  );
}

interface OrderListPanelProps {
  fixedStatus?: BackendImportStatus;
}

export default function OrderListPanel({ fixedStatus }: OrderListPanelProps = {}) {
  const [orders, setOrders]             = useState<BackendOrder[]>([]);
  const [page, setPage]                 = useState(0);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [search, setSearch]                   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deletingIds, setDeletingIds]   = useState<Set<number>>(new Set());
  const [rematching, setRematching]     = useState(false);
  const [rematchMsg, setRematchMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedId, setCopiedId]         = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(fixedStatus ?? 'ALL');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [togglingIds, setTogglingIds]   = useState<Set<number>>(new Set());
  const [editingShipping, setEditingShipping] = useState<number | null>(null);
  const [shippingDraft, setShippingDraft]     = useState('');
  const [savingShipping, setSavingShipping]   = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [matchSearch, setMatchSearch]   = useState<{
    groupKey: string; itemIds: number[]; query: string; results: WarehouseProduct[]; loading: boolean;
  } | null>(null);
  const [matchedProductNames, setMatchedProductNames] = useState<Map<number, string>>(new Map());
  const [matchAnchor, setMatchAnchor]   = useState<{ top: number; left: number } | null>(null);
  const matchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queueMap, setQueueMap]         = useState<Map<string, BackendQueueStatus>>(new Map());
  const [dateFilter, setDateFilter]     = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const loadOrders = useCallback(async (
    filter: StatusFilter = statusFilter,
    date: string | null = dateFilter,
  ) => {
    setLoading(true);
    setError('');
    try {
      const [ordersRes, queueRes] = await Promise.all([
        WarehouseService.getOrders(0, 9999, filter === 'ALL' ? undefined : filter, date ?? undefined),
        WarehouseService.getQueue(0, 500),
      ]);
      const pg = ordersRes.data.data;
      setOrders(pg.content);
      if (date == null) {
        const seen = new Set<string>();
        for (const o of pg.content) seen.add(toDateKey(o.createdAt));
        setAvailableDates(Array.from(seen).sort((a, b) => b.localeCompare(a)));
      }
      const map = new Map<string, BackendQueueStatus>();
      for (const entry of queueRes.data.data.content) {
        if (entry.status === 'WAITING' || entry.status === 'PACKING') {
          map.set(entry.orderNumber, entry.status);
        }
      }
      setQueueMap(map);
    } catch {
      setError('โหลดคำสั่งซื้อไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => { setPage(0); }, [sourceFilter, search]);

  const handleFilterChange = useCallback((f: StatusFilter) => {
    setStatusFilter(f);
    loadOrders(f, dateFilter);
  }, [loadOrders, dateFilter]);

  const handleDateFilterChange = useCallback((d: string | null) => {
    setDateFilter(d);
    loadOrders(statusFilter, d);
  }, [loadOrders, statusFilter]);

  const handleSourceFilterChange = useCallback((f: SourceFilter) => {
    setSourceFilter(f);
  }, []);

  const handleDeleteOrder = useCallback(async (orderNumber: string, orderId: number) => {
    setDeletingIds(prev => new Set(prev).add(orderId));
    try {
      await WarehouseService.deleteOrder(orderNumber);
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch {
      /* silent */
    } finally {
      setDeletingIds(prev => { const n = new Set(prev); n.delete(orderId); return n; });
    }
  }, []);

  const handleRematchAll = useCallback(async () => {
    setRematching(true);
    setRematchMsg(null);
    try {
      const res = await WarehouseService.rematchAll();
      const count = res.data.data ?? 0;
      setRematchMsg({ ok: true, text: count > 0 ? `จับคู่ใหม่สำเร็จ ${count} รายการ` : 'ทุกรายการจับคู่แล้ว' });
      if (count > 0) loadOrders();
    } catch {
      setRematchMsg({ ok: false, text: 'จับคู่ใหม่ไม่สำเร็จ' });
    } finally {
      setRematching(false);
    }
  }, [loadOrders]);

  const handleToggleStatus = useCallback(async (order: BackendOrder) => {
    if (order.importStatus === 'CANCELLED') return;
    const next: BackendImportStatus = order.importStatus === 'IMPORTED' ? 'PACKED' : 'IMPORTED';
    setTogglingIds(prev => new Set(prev).add(order.id));
    try {
      await WarehouseService.updateOrderStatus(order.orderNumber, next);
      if (fixedStatus) {
        setOrders(prev => prev.filter(o => o.id !== order.id));
      } else {
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, importStatus: next } : o));
      }
    } catch {
      /* silent */
    } finally {
      setTogglingIds(prev => { const n = new Set(prev); n.delete(order.id); return n; });
    }
  }, [fixedStatus]);

  const handleCopy = useCallback((orderNumber: string, orderId: number) => {
    navigator.clipboard.writeText(orderNumber);
    setCopiedId(orderId);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const handleSaveShipping = useCallback(async (order: BackendOrder) => {
    const val = shippingDraft.trim();
    setSavingShipping(prev => new Set(prev).add(order.id));
    try {
      await WarehouseService.updateOrderShipping(order.orderNumber, val);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, shippingMethod: val || null } : o));
      setEditingShipping(null);
    } catch { /* silent */ }
    finally { setSavingShipping(prev => { const n = new Set(prev); n.delete(order.id); return n; }); }
  }, [shippingDraft]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const targets = orders.filter(o => selectedIds.has(o.id));
    await Promise.allSettled(targets.map(o => WarehouseService.deleteOrder(o.orderNumber)));
    setOrders(prev => prev.filter(o => !selectedIds.has(o.id)));
    setSelectedIds(new Set());
    setBulkDeleting(false);
  }, [orders, selectedIds]);

  const runMatchSearch = useCallback((groupKey: string, query: string) => {
    if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
    if (!query.trim()) { setMatchSearch(prev => prev?.groupKey === groupKey ? { ...prev, results: [], loading: false } : prev); return; }
    setMatchSearch(prev => prev?.groupKey === groupKey ? { ...prev, loading: true } : prev);
    matchTimerRef.current = setTimeout(async () => {
      try {
        const res = await WarehouseService.searchProducts(query);
        setMatchSearch(prev => prev?.groupKey === groupKey ? { ...prev, results: res.data.data, loading: false } : prev);
      } catch {
        setMatchSearch(prev => prev?.groupKey === groupKey ? { ...prev, loading: false } : prev);
      }
    }, 280);
  }, []);

  const handleMatchSearch = useCallback((groupKey: string, itemIds: number[], query: string) => {
    setMatchSearch(prev => prev?.groupKey === groupKey
      ? { ...prev, query }
      : { groupKey, itemIds, query, results: [], loading: false });
    runMatchSearch(groupKey, query);
  }, [runMatchSearch]);

  const handleOpenMatch = useCallback((merged: MergedItem, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - 260);
    setMatchAnchor({ top: rect.bottom + 4, left });
    const initial = merged.productName?.trim() ?? '';
    setMatchSearch({ groupKey: merged.key, itemIds: merged.ids, query: initial, results: [], loading: !!initial });
    if (initial) runMatchSearch(merged.key, initial);
  }, [runMatchSearch]);

  const handleCloseMatch = useCallback(() => {
    setMatchSearch(null);
    setMatchAnchor(null);
  }, []);

  const handleClearMatch = useCallback(async (merged: MergedItem) => {
    try {
      const settled = await Promise.allSettled(
        merged.ids.map(id => WarehouseService.updateOrderItem(id, { matchedProductId: null }))
      );
      const cleared: BackendOrderItem[] = settled
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof WarehouseService.updateOrderItem>>> => r.status === 'fulfilled')
        .map(r => r.value.data.data);
      if (cleared.length > 0) {
        setOrders(prev => prev.map(o => ({ ...o, items: o.items.map(i => cleared.find(x => x.id === i.id) ?? i) })));
      }
      setMatchedProductNames(prev => { const n = new Map(prev); merged.ids.forEach(id => n.delete(id)); return n; });
    } catch { /* silent */ }
  }, []);

  const handleSelectMatch = useCallback(async (merged: MergedItem, product: WarehouseProduct) => {
    handleCloseMatch();
    try {
      const settled = await Promise.allSettled(
        merged.ids.map(id => WarehouseService.updateOrderItem(id, { matchedProductId: product.id }))
      );
      const matched: BackendOrderItem[] = settled
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof WarehouseService.updateOrderItem>>> => r.status === 'fulfilled')
        .map(r => r.value.data.data);
      if (matched.length > 0) {
        setOrders(prev => prev.map(o => ({ ...o, items: o.items.map(i => matched.find(x => x.id === i.id) ?? i) })));
      }
      setMatchedProductNames(prev => { const n = new Map(prev); merged.ids.forEach(id => n.set(id, product.title)); return n; });
    } catch { /* silent */ }
  }, [handleCloseMatch]);

  // ── Derived state ─────────────────────────────────────────────────────────────

  const searchTokens = useMemo(
    () => debouncedSearch.toLowerCase().trim().split(/\s+/).filter(Boolean),
    [debouncedSearch],
  );

  const sourceCounts = useMemo(() =>
    SOURCE_FILTERS.reduce((acc, f) => {
      acc[f.value] = f.value === 'ALL'
        ? orders.length
        : orders.filter(o => matchesSource(f.value, o.shippingMethod)).length;
      return acc;
    }, {} as Record<SourceFilter, number>),
  [orders]);

  const filtered = useMemo(() =>
    orders
      .filter(o => matchesSource(sourceFilter, o.shippingMethod))
      .filter(o => {
        if (searchTokens.length === 0) return true;
        const haystack = [
          o.orderNumber,
          o.trackingNumber ?? '',
          o.customerName ?? '',
          ...o.items.map(i => i.productName ?? ''),
          ...o.items.map(i => i.sku ?? ''),
          ...o.items.map(i => i.variant ?? ''),
        ].join(' ').toLowerCase();
        return searchTokens.every(t => haystack.includes(t));
      }),
  [orders, sourceFilter, searchTokens]);

  const pageCount    = Math.ceil(filtered.length / PAGE_SIZE);
  const displayOrders = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const allSelected  = filtered.length > 0 && filtered.every(o => selectedIds.has(o.id));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ── Toolbar ── */}
      <div className="space-y-1.5">

        {/* Row 1: checkbox · search · count · actions */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelectedIds(allSelected ? new Set() : new Set(filtered.map(o => o.id)))}
            title={allSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
            className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer flex-shrink-0"
          />
          <input
            type="text"
            value={search}
            onChange={e => {
              const v = e.target.value;
              setSearch(v);
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => setDebouncedSearch(v), 250);
            }}
            placeholder="ค้นหา เลขออเดอร์ / พัสดุ / ชื่อ / สินค้า"
            className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[36px] sm:min-h-0"
          />
          <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap flex-shrink-0 hidden sm:block tabular-nums">
            {filtered.length < orders.length
              ? `${filtered.length.toLocaleString()} / ${orders.length.toLocaleString()}`
              : `${orders.length.toLocaleString()} รายการ`}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex-shrink-0 whitespace-nowrap">
              {bulkDeleting ? 'กำลังลบ...' : `ลบ (${selectedIds.size})`}
            </button>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleRematchAll}
              disabled={rematching}
              title="จับคู่สินค้าใหม่สำหรับรายการที่ยังไม่จับคู่"
              className="px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50 whitespace-nowrap">
              {rematching ? 'กำลังจับคู่...' : 'จับคู่ใหม่'}
            </button>
            <button
              onClick={() => loadOrders()}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap">
              {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
            </button>
          </div>
        </div>

        {/* Row 2: status chips */}
        {!fixedStatus && (
          <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => handleFilterChange(f.value)}
                className={`flex-none px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  statusFilter === f.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Row 3: source chips */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
          {SOURCE_FILTERS.map(f => {
            const count = sourceCounts[f.value] ?? 0;
            const showCount = f.value !== 'ALL' && count > 0;
            return (
              <button
                key={f.value}
                onClick={() => handleSourceFilterChange(f.value)}
                className={`flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  sourceFilter === f.value
                    ? 'bg-zinc-700 text-white border-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:border-zinc-200'
                    : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}>
                {f.label}
                {showCount && (
                  <span className={`text-[10px] tabular-nums px-1 rounded-full leading-tight ${
                    sourceFilter === f.value
                      ? 'bg-white/25 text-white dark:bg-black/20 dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Row 4: date chips */}
        {availableDates.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
            <button
              onClick={() => handleDateFilterChange(null)}
              className={`flex-none px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                dateFilter === null
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}>
              ทุกวัน
            </button>
            {availableDates.map(d => {
              const isActive = dateFilter === d;
              const isToday  = d === TODAY_STR;
              return (
                <button
                  key={d}
                  onClick={() => handleDateFilterChange(d)}
                  className={`flex-none px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isActive
                      ? isToday
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-zinc-700 text-white border-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:border-zinc-200'
                      : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}>
                  {formatDateLabel(d)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Feedback banners */}
      {rematchMsg && (
        <div className={`px-4 py-2.5 rounded-xl border text-xs font-medium ${
          rematchMsg.ok
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
        }`}>
          {rematchMsg.text}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && orders.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && orders.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-400 dark:text-zinc-500">
          <p className="text-sm font-medium">ยังไม่มีคำสั่งซื้อในคลัง</p>
          <p className="text-xs">นำเข้าจากแท็บ &ldquo;นำเข้า&rdquo; แล้วกด &ldquo;ส่งไปคลัง&rdquo;</p>
        </div>
      )}

      {/* ── Order rows ── */}
      {displayOrders.map(order => {
        const sm           = IMPORT_STATUS_META[order.importStatus];
        const isExpanded   = expandedId === order.id;
        const mergedItems  = mergeOrderItems(order.items);
        const totalQty     = order.items.reduce((s, i) => s + i.qty, 0);
        const matchedCount = mergedItems.filter(m => m.matchConfidence && m.matchConfidence !== 'UNMATCHED').length;

        return (
          <div key={order.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">

            {/* Compact header row */}
            <div className="flex items-stretch">

              {/* Checkbox */}
              <label className="flex items-center px-3 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(order.id)}
                  onChange={() => setSelectedIds(prev => {
                    const n = new Set(prev);
                    n.has(order.id) ? n.delete(order.id) : n.add(order.id);
                    return n;
                  })}
                  className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                />
              </label>

              {/* Main clickable area */}
              <button
                className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors min-w-0 overflow-hidden"
                onClick={() => setExpandedId(isExpanded ? null : order.id)}>

                {/* Status dot */}
                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${sm.dot}`} />

                {/* Order number + copy */}
                <span
                  onClick={e => { e.stopPropagation(); handleCopy(order.orderNumber, order.id); }}
                  title="คลิกเพื่อคัดลอก"
                  className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[140px] flex-shrink-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none">
                  {copiedId === order.id ? <span className="text-green-600 dark:text-green-400">✓ copied</span> : order.orderNumber}
                </span>

                {/* Queue badge */}
                {queueMap.has(order.orderNumber) && (
                  <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    queueMap.get(order.orderNumber) === 'PACKING'
                      ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600'
                      : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600'
                  }`}>
                    {queueMap.get(order.orderNumber) === 'PACKING' ? 'กำลังแพ็ค' : 'ในคิว'}
                  </span>
                )}

                {/* Status badge */}
                {order.importStatus !== 'CANCELLED' ? (
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleStatus(order); }}
                    disabled={togglingIds.has(order.id)}
                    title="คลิกเพื่อเปลี่ยนสถานะ"
                    className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border transition-opacity hover:opacity-70 disabled:opacity-50 flex-shrink-0 ${sm.bg} ${sm.text} ${sm.border}`}>
                    {togglingIds.has(order.id) ? '...' : sm.label}
                  </button>
                ) : (
                  <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${sm.bg} ${sm.text} ${sm.border}`}>
                    {sm.label}
                  </span>
                )}

                {/* Platform badge */}
                {order.platform && (() => {
                  const pm = getPlatformMeta(order.platform);
                  return pm ? (
                    <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${pm.bg} ${pm.text} ${pm.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pm.dot}`} />
                      {order.platform}
                    </span>
                  ) : (
                    <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 font-medium flex-shrink-0">
                      {order.platform}
                    </span>
                  );
                })()}

                {/* Shop */}
                {order.shop && (
                  <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 font-medium flex-shrink-0 truncate max-w-[120px]">
                    {order.shop}
                  </span>
                )}

                {/* Customer */}
                <span className="flex-1 text-xs text-zinc-600 dark:text-zinc-400 truncate min-w-0">
                  {order.customerName || '—'}
                </span>

                {/* Items summary */}
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex-shrink-0 whitespace-nowrap">
                  {mergedItems.length} รายการ · {totalQty} ชิ้น
                  {mergedItems.length > 0 && (
                    <span className={`ml-1 font-semibold ${matchedCount === mergedItems.length ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      ({matchedCount}/{mergedItems.length})
                    </span>
                  )}
                </span>

                {/* Tracking */}
                <span className="hidden lg:block font-mono text-[10px] text-zinc-400 dark:text-zinc-500 max-w-[120px] truncate flex-shrink-0">
                  {order.trackingNumber || '—'}
                </span>

                {/* Date chip */}
                {(() => {
                  const dateKey  = toDateKey(order.createdAt);
                  const label    = formatDateLabel(dateKey);
                  const isToday  = dateKey === TODAY_STR;
                  const isActive = dateFilter === dateKey;
                  return (
                    <button
                      onClick={e => { e.stopPropagation(); handleDateFilterChange(isActive ? null : dateKey); }}
                      title={isActive ? 'ยกเลิกกรองวันนี้' : `กรองวันที่ ${dateKey}`}
                      className={`flex-shrink-0 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : isToday
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/60'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}>
                      {label}
                    </button>
                  );
                })()}

                {/* Expand indicator */}
                <span className="flex-shrink-0 text-zinc-400 text-[11px] w-4 text-right">
                  {isExpanded ? '▴' : '▾'}
                </span>
              </button>

              {/* Delete */}
              <button
                onClick={() => handleDeleteOrder(order.orderNumber, order.id)}
                disabled={deletingIds.has(order.id)}
                title="ลบคำสั่งซื้อ"
                className="px-3 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 flex-shrink-0 text-sm font-medium">
                {deletingIds.has(order.id) ? '...' : '×'}
              </button>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 space-y-3 bg-zinc-50/50 dark:bg-zinc-800/30">

                {/* Order metadata grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {order.shop && (
                    <div>
                      <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">ร้านค้าเพลตฟอร์ม</p>
                      <p className="text-zinc-700 dark:text-zinc-300 font-medium">{order.shop}</p>
                    </div>
                  )}
                  {order.trackingNumber && (
                    <div>
                      <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">เลขพัสดุ</p>
                      <p className="font-mono text-zinc-700 dark:text-zinc-300">{order.trackingNumber}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">ขนส่ง</p>
                    {editingShipping === order.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={shippingDraft}
                          onChange={e => setShippingDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveShipping(order);
                            if (e.key === 'Escape') setEditingShipping(null);
                          }}
                          className="w-28 px-2 py-0.5 text-xs rounded border border-blue-400 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button onClick={() => handleSaveShipping(order)} disabled={savingShipping.has(order.id)} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-600 text-white disabled:opacity-50">
                          {savingShipping.has(order.id) ? '...' : '✓'}
                        </button>
                        <button onClick={() => setEditingShipping(null)} className="px-1.5 py-0.5 rounded text-[10px] text-zinc-400 hover:text-zinc-600">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setShippingDraft(order.shippingMethod ?? ''); setEditingShipping(order.id); }}
                        className="text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left">
                        {order.shippingMethod || <span className="text-zinc-400 italic text-[11px]">คลิกเพื่อระบุ</span>}
                      </button>
                    )}
                  </div>
                  {order.createdAtPlatform && (
                    <div>
                      <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">วันที่</p>
                      <p className="text-zinc-700 dark:text-zinc-300">{order.createdAtPlatform}</p>
                    </div>
                  )}
                  {order.phone && (
                    <div>
                      <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">โทร</p>
                      <p className="font-mono text-zinc-700 dark:text-zinc-300">{order.phone}</p>
                    </div>
                  )}
                  {order.address && (
                    <div className="col-span-1 sm:col-span-2">
                      <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">ที่อยู่</p>
                      <p className="text-zinc-700 dark:text-zinc-300">{order.address}{order.province ? ` · ${order.province}` : ''}</p>
                    </div>
                  )}
                  {order.buyerNote && (
                    <div className="col-span-1 sm:col-span-2">
                      <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">หมายเหตุ</p>
                      <p className="text-zinc-700 dark:text-zinc-300 italic">&ldquo;{order.buyerNote}&rdquo;</p>
                    </div>
                  )}
                </div>

                {/* Items table */}
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <table className="w-full text-xs min-w-[480px]">
                    <thead className="bg-zinc-100 dark:bg-zinc-800">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-zinc-400 uppercase tracking-wider">สินค้า</th>
                        <th className="text-left px-3 py-2 font-semibold text-zinc-400 uppercase tracking-wider hidden sm:table-cell">SKU</th>
                        <th className="text-left px-3 py-2 font-semibold text-zinc-400 uppercase tracking-wider w-16">จำนวน</th>
                        <th className="text-left px-3 py-2 font-semibold text-zinc-400 uppercase tracking-wider w-24">ราคา</th>
                        <th className="text-left px-3 py-2 font-semibold text-zinc-400 uppercase tracking-wider w-28">จับคู่</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {mergedItems.map(merged => {
                        const mc         = merged.matchConfidence ? MATCH_META[merged.matchConfidence] : null;
                        const isOpen     = matchSearch?.groupKey === merged.key;
                        const cachedName = matchedProductNames.get(merged.ids[0]);
                        const totalPrice = merged.price * merged.qty;
                        return (
                          <tr key={merged.key} className="bg-white dark:bg-zinc-900">

                            {/* Product name */}
                            <td className="px-3 py-2">
                              <p className="text-zinc-800 dark:text-zinc-200 font-medium leading-snug">{merged.productName || '—'}</p>
                              {merged.variant && <p className="text-zinc-400 text-[10px] mt-0.5">{merged.variant}</p>}
                              {cachedName && (
                                <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5 truncate max-w-xs" title={cachedName}>→ {cachedName}</p>
                              )}
                            </td>

                            {/* SKU */}
                            <td className="px-3 py-2 hidden sm:table-cell">
                              <code className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">{merged.sku || '—'}</code>
                            </td>

                            {/* Qty */}
                            <td className="px-3 py-2 text-left font-bold text-zinc-700 dark:text-zinc-200 tabular-nums">
                              {merged.qty}
                              {merged.ids.length > 1 && (
                                <span className="block text-[9px] font-normal text-zinc-400">{merged.ids.length} แถว</span>
                              )}
                            </td>

                            {/* Price */}
                            <td className="px-3 py-2 text-left tabular-nums text-zinc-600 dark:text-zinc-400">
                              {totalPrice > 0 ? `฿${totalPrice.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                              {merged.ids.length > 1 && merged.price > 0 && (
                                <span className="block text-[9px] text-zinc-400">฿{merged.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })} × {merged.qty}</span>
                              )}
                            </td>

                            {/* Match */}
                            <td className="px-3 py-2 text-left">
                              {isOpen ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    autoFocus
                                    type="text"
                                    value={matchSearch!.query}
                                    onChange={e => handleMatchSearch(merged.key, merged.ids, e.target.value)}
                                    onKeyDown={e => e.key === 'Escape' && handleCloseMatch()}
                                    placeholder="ค้นหาสินค้า..."
                                    className="w-32 px-2 py-1 text-[11px] rounded-lg border border-blue-400 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  />
                                  <button onClick={handleCloseMatch} className="text-zinc-400 hover:text-zinc-600 flex-shrink-0 text-sm leading-none">
                                    ×
                                  </button>
                                  {matchAnchor && (matchSearch!.loading || matchSearch!.results.length > 0) && (
                                    <div
                                      className="fixed z-[9999] w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-y-auto"
                                      style={{ top: matchAnchor.top, left: matchAnchor.left, maxHeight: 220 }}>
                                      {matchSearch!.loading ? (
                                        <div className="px-3 py-3 text-xs text-zinc-400">ค้นหา...</div>
                                      ) : matchSearch!.results.map(prod => (
                                        <button
                                          key={prod.id}
                                          onClick={() => handleSelectMatch(merged, prod)}
                                          className="w-full text-left px-3 py-2.5 text-xs hover:bg-blue-50 dark:hover:bg-zinc-700 transition-colors border-b border-zinc-100 dark:border-zinc-700 last:border-0">
                                          <p className="font-medium text-zinc-800 dark:text-zinc-200 leading-snug">{prod.title}</p>
                                          <p className={`text-[10px] mt-0.5 ${prod.availableStock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                            สต็อก {prod.availableStock}
                                          </p>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : merged.matchConfidence === 'UNMATCHED' || !merged.matchedProductId ? (
                                <button
                                  onClick={e => handleOpenMatch(merged, e)}
                                  className="px-2 py-1 rounded-lg border border-dashed border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
                                  เลือกสินค้า
                                </button>
                              ) : (
                                <div className="inline-flex items-center gap-1.5">
                                  {mc && (
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${mc.text}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${mc.dot}`} />
                                      {mc.label}
                                    </span>
                                  )}
                                  <button
                                    onClick={e => handleOpenMatch(merged, e)}
                                    title="เปลี่ยนสินค้า"
                                    className="text-[10px] text-zinc-400 hover:text-blue-500 transition-colors px-1">
                                    แก้
                                  </button>
                                  <button
                                    onClick={() => handleClearMatch(merged)}
                                    title="ล้างการจับคู่"
                                    className="text-[10px] text-zinc-400 hover:text-red-500 transition-colors leading-none">
                                    ×
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Match summary */}
                {matchedCount < mergedItems.length && (
                  <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-400">
                    สินค้า {mergedItems.length - matchedCount} รายการยังไม่จับคู่ — จะไม่ตัดสต็อกเมื่อแพ็ค
                  </div>
                )}
                {matchedCount === mergedItems.length && mergedItems.length > 0 && (
                  <div className="px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-xs text-green-700 dark:text-green-400">
                    จับคู่สินค้าครบทุกรายการ — พร้อมตัดสต็อก
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
          <span className="text-xs text-zinc-500">หน้า {page + 1} / {pageCount}</span>
          <div className="flex gap-1">
            {[
              { label: '«', action: () => setPage(0),             disabled: page === 0 },
              { label: '‹', action: () => setPage(page - 1),      disabled: page === 0 },
              { label: '›', action: () => setPage(page + 1),      disabled: page === pageCount - 1 },
              { label: '»', action: () => setPage(pageCount - 1), disabled: page === pageCount - 1 },
            ].map((btn, i) => (
              <button key={i} onClick={btn.action} disabled={btn.disabled || loading}
                className="px-2.5 py-1 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors tabular-nums">
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
