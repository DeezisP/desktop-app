import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  QrCode, CheckCircle2, AlertCircle, AlertTriangle, Loader2,
  Search, X, WifiOff, Plus, RefreshCw, Package,
} from 'lucide-react';
import WarehouseService, { ScanQueueEntry, WarehouseProduct } from '../service/WarehouseService';
import { ProductGroup, groupProducts, getVariantLabel } from '../service/packingShared';
import { sounds, sendDesktopNotification } from '../service/sounds';

const CARRIERS = [
  { key: 'Lazada',  label: 'LAZADA',  style: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-600' },
  { key: 'SPX',     label: 'SPX',     style: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-600' },
  { key: 'Flash',   label: 'FLASH',   style: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-300 dark:border-red-600' },
  { key: 'TikTok',  label: 'TIKTOK',  style: 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 border-pink-300 dark:border-pink-600' },
  { key: 'Key',     label: 'KEY',     style: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600' },
];

export interface PackingSidebarProps {
  connected: boolean;
  queueLoading: boolean;
  onLoadQueue: () => void;
  onEntryUpserted: (entry: ScanQueueEntry) => void;
  onSearchActive?: (active: boolean) => void;
}

export default function PackingSidebar({
  connected, queueLoading, onLoadQueue, onEntryUpserted, onSearchActive,
}: PackingSidebarProps) {

  // ── Scanner state ──────────────────────────────────────────────────────────
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError]     = useState<{ msg: string; type: 'error' | 'packed' } | null>(null);
  const [scanInput, setScanInput]     = useState('');
  const [scanFlash, setScanFlash]     = useState<'success' | 'error' | null>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const isScrollingRef = useRef(false);

  // Auto-focus hidden input on mount so the scanner is always ready
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);

  // ── Quick-add state ────────────────────────────────────────────────────────
  const [qaQuery, setQaQuery]         = useState('');
  const [qaResults, setQaResults]     = useState<WarehouseProduct[]>([]);
  const [qaSearching, setQaSearching] = useState(false);
  const [qaGroup, setQaGroup]         = useState<ProductGroup | null>(null);
  const [qaProduct, setQaProduct]     = useState<WarehouseProduct | null>(null);
  const [qaQty, setQaQty]             = useState('1');
  const [qaCarrier, setQaCarrier]     = useState('');
  const [qaLoading, setQaLoading]     = useState(false);
  const [qaError, setQaError]         = useState<string | null>(null);
  const qaInputRef = useRef<HTMLInputElement>(null);

  // Track scrolling so focus never interrupts a gesture
  useEffect(() => {
    const onTouchStart = () => { isScrollingRef.current = false; };
    const onTouchMove  = () => { isScrollingRef.current = true; };
    const onTouchEnd   = () => { setTimeout(() => { isScrollingRef.current = false; }, 400); };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove',  onTouchMove,  { passive: true });
    document.addEventListener('touchend',   onTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove',  onTouchMove);
      document.removeEventListener('touchend',   onTouchEnd);
    };
  }, []);

  // Quick-add product search
  useEffect(() => {
    if (!qaQuery.trim() || qaProduct) { setQaResults([]); return; }
    const t = setTimeout(async () => {
      setQaSearching(true);
      try {
        const res = await WarehouseService.searchProducts(qaQuery);
        setQaResults(res.data.data);
      } catch { setQaResults([]); }
      finally { setQaSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [qaQuery, qaProduct]);

  const handleScannerBlur = useCallback(() => {
    requestAnimationFrame(() => {
      if (isScrollingRef.current) return;
      const tag = document.activeElement?.tagName?.toUpperCase() ?? '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        inputRef.current?.focus({ preventScroll: true });
      }
    });
  }, []);

  const resetQa = useCallback(() => {
    setQaQuery('');
    setQaResults([]);
    setQaGroup(null);
    setQaProduct(null);
    setQaQty('1');
    setQaCarrier('');
    onSearchActive?.(false);
    setQaError(null);
  }, [onSearchActive]);

  // ── Flash feedback helper ─────────────────────────────────────────────────

  const flashCard = useCallback((type: 'success' | 'error') => {
    setScanFlash(type);
    setTimeout(() => setScanFlash(null), 550);
  }, []);

  // ── Scan handler ──────────────────────────────────────────────────────────

  const handleScan = useCallback(async () => {
    const trimmed = scanInput.trim();
    if (!trimmed || scanLoading) return;
    setScanLoading(true);
    setScanError(null);
    try {
      const res = await WarehouseService.scan(trimmed);
      onEntryUpserted(res.data.data);
      sounds.scanSuccess();
      flashCard('success');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; code?: string } } };
      const code = e.response?.data?.code;
      const msg  = e.response?.data?.message ?? 'เกิดข้อผิดพลาด';
      const isSuccessLike = code === 'ALREADY_PACKED' || code === 'CONFLICT';
      setScanError({ msg, type: isSuccessLike ? 'packed' : 'error' });

      if (isSuccessLike) {
        sounds.scanDuplicate();
        flashCard('success');
      } else {
        sounds.scanError();
        flashCard('error');
        sendDesktopNotification('พบบาร์โค้ดที่ถูกระงับ', msg);
      }
    } finally {
      setScanInput('');
      setScanLoading(false);
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [scanInput, scanLoading, onEntryUpserted, flashCard]);

  const handleQuickAdd = useCallback(async () => {
    if (!qaProduct) return;
    const qty = parseInt(qaQty, 10);
    if (isNaN(qty) || qty < 1) { setQaError('จำนวนต้องมากกว่า 0'); return; }
    setQaLoading(true);
    setQaError(null);
    const orderNo = `MANUAL-${Date.now()}`;
    try {
      await WarehouseService.importOrders([{
        order_no: orderNo,
        tracking_no: '',
        platform: 'Manual',
        customer_name: '',
        items: [{ sku: '', product_name: qaProduct.title, qty, price: 0 }],
        status: '',
        shipping_method: qaCarrier,
        created_at: '',
      }]);
      const res = await WarehouseService.scan(orderNo);
      onEntryUpserted(res.data.data);
      sounds.scanSuccess();
      resetQa();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setQaError(e.response?.data?.message ?? 'เพิ่มเข้าคิวไม่สำเร็จ');
      sounds.scanError();
    } finally {
      setQaLoading(false);
    }
  }, [qaProduct, qaQty, qaCarrier, onEntryUpserted, resetQa]);

  return (
    <div className="order-2 lg:order-1 w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-3 lg:sticky lg:top-4">

      {/* Hidden barcode scanner input — fixed so focusing never scrolls the page */}
      <input
        ref={inputRef}
        type="text"
        inputMode="none"
        value={scanInput}
        onChange={e => { setScanInput(e.target.value); setScanError(null); }}
        onKeyDown={e => e.key === 'Enter' && handleScan()}
        onBlur={handleScannerBlur}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* ── Scanner card ── */}
      <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">

        {/* Scan flash overlay */}
        <AnimatePresence>
          {scanFlash && (
            <motion.div
              key={scanFlash}
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className={`absolute inset-0 z-10 pointer-events-none rounded-2xl ${
                scanFlash === 'success'
                  ? 'bg-green-400/25 dark:bg-green-400/20'
                  : 'bg-red-400/25 dark:bg-red-400/20'
              }`}
            />
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2">
            <QrCode size={13} className="text-zinc-400" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">สแกนเนอร์</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${
              connected
                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-700'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700'
            }`}>
              {connected
                ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />Live</>
                : <><WifiOff size={9} />Offline</>}
            </span>
            <button
              onClick={onLoadQueue}
              title="โหลดคิวใหม่"
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              <RefreshCw size={12} className={queueLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 space-y-2.5">
          <AnimatePresence mode="wait">
            {scanLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
              >
                <Loader2 size={13} className="animate-spin text-blue-500 flex-shrink-0" />
                <span className="text-xs text-blue-700 dark:text-blue-400">กำลังประมวลผล...</span>
              </motion.div>
            ) : (
              <motion.div
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0 inline-block" />
                <span className="text-xs text-blue-700 dark:text-blue-400">พร้อมรับการสแกน</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {scanError && (
              <motion.div
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.18 }}
              >
                {scanError.type === 'packed'
                  ? <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                      <CheckCircle2 size={13} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-xs text-green-700 dark:text-green-400 truncate">{scanError.msg}</span>
                    </div>
                  : <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
                      <AlertCircle size={13} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                      <span className="text-xs text-red-600 dark:text-red-400 truncate">{scanError.msg}</span>
                    </div>
                }
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Quick-add card ── */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40">
          <Plus size={11} className="text-zinc-400" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">เพิ่มสินค้าเข้าคิว</span>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Carrier selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CARRIERS.map(c => (
              <button
                key={c.key}
                onClick={() => setQaCarrier(prev => prev === c.key ? '' : c.key)}
                className={`flex-none px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                  qaCarrier === c.key
                    ? c.style + ' ring-2 ring-offset-1 ring-current'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                }`}>
                {c.label}
              </button>
            ))}
            {qaCarrier && (
              <button onClick={() => setQaCarrier('')} className="flex-none text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Product search → group picker → selected */}
          {!qaProduct ? (
            <div className="space-y-2">
              {!qaGroup ? (
                <>
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    <input
                      ref={qaInputRef}
                      type="text"
                      value={qaQuery}
                      onChange={e => setQaQuery(e.target.value)}
                      onFocus={() => onSearchActive?.(true)}
                      onBlur={() => { if (!qaQuery.trim()) onSearchActive?.(false); }}
                      placeholder="ค้นหาชื่อสินค้าในคลัง..."
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-zinc-900 transition-all min-h-[44px] sm:min-h-0"
                    />
                  </div>
                  {qaSearching && (
                    <div className="flex items-center gap-2 px-1 text-xs text-zinc-400">
                      <Loader2 size={11} className="animate-spin" /> ค้นหา...
                    </div>
                  )}
                  <AnimatePresence>
                    {!qaSearching && qaResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-700/60 max-h-48 overflow-y-auto shadow-sm"
                      >
                        {groupProducts(qaResults).slice(0, 10).map(g => {
                          const totalStock = g.items.reduce((s, p) => s + p.availableStock, 0);
                          return (
                            <button
                              key={g.base}
                              onClick={() => {
                                if (g.items.length === 1) { setQaProduct(g.items[0]); setQaResults([]); }
                                else { setQaGroup(g); setQaResults([]); }
                              }}
                              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                              <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate flex-1">{g.base}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {g.items.length > 1 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                    {g.items.length} ตัวเลือก
                                  </span>
                                )}
                                <span className={`text-[11px] tabular-nums ${totalStock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-400 dark:text-red-500'}`}>
                                  {totalStock.toLocaleString()}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!qaSearching && qaQuery.trim() && qaResults.length === 0 && (
                    <p className="text-xs text-zinc-400 px-1">ไม่พบสินค้าที่ตรงกับ &ldquo;{qaQuery}&rdquo;</p>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-end">
                    <button onClick={() => setQaGroup(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
                    {qaGroup.items.map(p => {
                      const label = getVariantLabel(p.title, qaGroup.base);
                      if (!label) return null;
                      return (
                        <button
                          key={p.id}
                          onClick={() => { setQaProduct(p); setQaGroup(null); }}
                          className="px-2 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-center truncate">
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <Package size={14} className="text-blue-500 flex-shrink-0" />
                <span className="text-sm text-zinc-800 dark:text-zinc-200 flex-1 truncate">{qaProduct.title}</span>
                <span className={`text-[11px] flex-shrink-0 tabular-nums ${qaProduct.availableStock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-400'}`}>
                  {qaProduct.availableStock.toLocaleString()}
                </span>
                <button onClick={() => { setQaProduct(null); setQaQuery(''); }} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
                  <X size={12} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">จำนวน</span>
                <div className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 overflow-hidden">
                  <button type="button" onClick={() => setQaQty(v => String(Math.max(1, (parseInt(v) || 1) - 1)))} className="px-2.5 py-2 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors select-none leading-none">−</button>
                  <span className="w-8 text-center text-sm text-zinc-700 dark:text-zinc-200 tabular-nums">{qaQty}</span>
                  <button type="button" onClick={() => setQaQty(v => String((parseInt(v) || 0) + 1))} className="px-2.5 py-2 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors select-none leading-none">+</button>
                </div>
                <button
                  onClick={handleQuickAdd}
                  disabled={qaLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors active:scale-95">
                  {qaLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  เพิ่มเข้าคิว
                </button>
              </div>
            </div>
          )}

          {qaError && (
            <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle size={12} className="flex-shrink-0" />{qaError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
