

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Search } from 'lucide-react';
import WarehouseService, { type WarehouseProduct } from '../service/WarehouseService';
import { saveImportSession } from './ImportHistoryPanel';
import { useAdminGuard } from '../hooks/useAdminGuard';

interface ItemRow {
  _id: string;
  product_name: string;
  variant: string;
  qty: number;
}

function splitPV(title: string) {
  const idx = title.lastIndexOf(' - ');
  return idx !== -1
    ? { name: title.slice(0, idx).trim(), variant: title.slice(idx + 3).trim() }
    : { name: title.trim(), variant: '' };
}

const mkId = () => Math.random().toString(36).slice(2);
const emptyItem = (): ItemRow => ({ _id: mkId(), product_name: '', variant: '', qty: 1 });

const CARRIERS = ['SPX', 'Flash', 'Lazada', 'TikTok', 'Key'] as const;

// ── Per-row product search ────────────────────────────────────────────────────

interface ProductItemRowProps {
  item: ItemRow;
  index: number;
  allProducts: WarehouseProduct[];
  productsLoading: boolean;
  canRemove: boolean;
  onChange: (i: number, updates: Partial<ItemRow>) => void;
  onRemove: (i: number) => void;
}

function ProductItemRow({ item, index, allProducts, productsLoading, canRemove, onChange, onRemove }: ProductItemRowProps) {
  const initialQuery = item.product_name
    ? item.variant ? `${item.product_name} - ${item.variant}` : item.product_name
    : '';
  const [query, setQuery] = useState(initialQuery);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchResults = useMemo(() => {
    if (!query.trim() || !showDropdown) return [];
    const q = query.toLowerCase();
    return allProducts.filter(p => p.title.toLowerCase().includes(q)).slice(0, 20);
  }, [query, showDropdown, allProducts]);

  // All sibling products with the same parent name (shows variant pills)
  const variantSiblings = useMemo(() => {
    if (!item.product_name) return [];
    const parent = item.product_name.toLowerCase();
    const siblings = allProducts.filter(p => splitPV(p.title).name.toLowerCase() === parent);
    return siblings.length > 1 ? siblings : [];
  }, [item.product_name, allProducts]);

  const selectProduct = (p: WarehouseProduct) => {
    const { name, variant } = splitPV(p.title);
    setQuery(p.title);
    setShowDropdown(false);
    onChange(index, { product_name: name, variant });
  };

  const handleBlur = () => {
    // Delay so onMouseDown on dropdown items fires first
    setTimeout(() => {
      setShowDropdown(false);
      if (!item.product_name && query.trim()) {
        onChange(index, { product_name: query.trim(), variant: '' });
      }
    }, 150);
  };

  const fieldCls = "w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[44px] sm:min-h-0";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-2">

        {/* Product search input */}
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {productsLoading
              ? <Loader2 size={12} className="text-zinc-400 animate-spin" />
              : <Search size={12} className="text-zinc-400" />}
          </div>
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setShowDropdown(true);
              if (item.product_name) onChange(index, { product_name: '', variant: '' });
            }}
            onFocus={() => { if (query.trim()) setShowDropdown(true); }}
            onBlur={handleBlur}
            placeholder="ค้นหาสินค้า..."
            className={`${fieldCls} pl-8`}
          />

          {/* Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl max-h-52 overflow-y-auto">
              {searchResults.map(p => {
                const { name, variant } = splitPV(p.title);
                return (
                  <button
                    key={p.id}
                    onMouseDown={e => { e.preventDefault(); selectProduct(p); }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{name}</p>
                    {variant && <p className="text-[10px] text-zinc-500 mt-0.5">{variant}</p>}
                    <p className="text-[10px] text-zinc-400">คงเหลือ: {p.availableStock}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Qty + remove */}
        <div className="flex gap-2 flex-shrink-0">
          <input
            type="number"
            min={1}
            value={item.qty}
            onChange={e => onChange(index, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
            className={`${fieldCls} w-16 text-center tabular-nums`}
          />
          <button
            onClick={() => onRemove(index)}
            disabled={!canRemove}
            className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30 flex-shrink-0 min-h-[44px] sm:min-h-0 flex items-center">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Variant pills — shown when selected product has siblings */}
      {variantSiblings.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {variantSiblings.map(p => {
            const { variant } = splitPV(p.title);
            const selected = item.variant === variant;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setQuery(item.product_name + (variant ? ` - ${variant}` : ''));
                  onChange(index, { variant });
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                  selected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}>
                {variant || '(ไม่มีตัวเลือก)'}
                {p.availableStock <= 0 && <span className="ml-1 opacity-50 text-[9px]">หมด</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function ManualOrderForm() {
  const { requireAdmin } = useAdminGuard();
  const [open, setOpen]                       = useState(false);
  const [orderNo, setOrderNo]                 = useState('');
  const [customerName, setCustomerName]       = useState('');
  const [carrier, setCarrier]                 = useState('');
  const [items, setItems]                     = useState<ItemRow[]>([emptyItem()]);
  const [saving, setSaving]                   = useState(false);
  const [result, setResult]                   = useState<{ ok: boolean; text: string } | null>(null);
  const [allProducts, setAllProducts]         = useState<WarehouseProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const loadedRef = useRef(false);

  // Load products once when form is first opened
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    setProductsLoading(true);
    WarehouseService.getAllProducts()
      .then(res => setAllProducts(res.data.data ?? []))
      .finally(() => setProductsLoading(false));
  }, [open]);

  const addItem    = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = useCallback((i: number, updates: Partial<ItemRow>) =>
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, ...updates } : row)), []);

  const reset = () => {
    setOrderNo('');
    setCustomerName('');
    setCarrier('');
    setItems([emptyItem()]);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!requireAdmin()) return;
    if (!orderNo.trim()) return;
    const valid = items.filter(i => i.product_name.trim());
    if (valid.length === 0) return;

    setSaving(true);
    setResult(null);
    try {
      const res = await WarehouseService.importOrders([{
        order_no:        orderNo.trim(),
        tracking_no:     '',
        platform:        'Manual',
        customer_name:   customerName.trim(),
        items:           valid.map(i => ({
          sku:          '',
          product_name: i.product_name.trim(),
          variant:      i.variant.trim() || undefined,
          qty:          i.qty,
          price:        0,
        })),
        status:          '',
        shipping_method: carrier,
        created_at:      '',
      }]);
      const data = res.data.data;
      saveImportSession({ platform: 'Manual', tried: 1, newCount: data.newCount, skippedCount: data.skippedCount });
      setResult({ ok: true, text: `บันทึกออเดอร์ ${orderNo.trim()} สำเร็จ` });
      reset();
    } catch {
      setResult({ ok: false, text: 'บันทึกไม่สำเร็จ' });
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = orderNo.trim() && items.some(i => i.product_name.trim());

  const fieldCls = "w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 min-h-[44px] sm:min-h-0";

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left">
        <Plus size={14} className="text-zinc-400" />
        เพิ่มออเดอร์ด้วยตนเอง
        {open ? <ChevronUp size={14} className="ml-auto text-zinc-400" /> : <ChevronDown size={14} className="ml-auto text-zinc-400" />}
      </button>

      {open && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 space-y-4">

          {/* Order number + customer + carrier */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">เลขออเดอร์ *</label>
              <input value={orderNo} onChange={e => setOrderNo(e.target.value)} placeholder="เช่น ORD-001" className={fieldCls} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">ชื่อลูกค้า</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="ชื่อผู้รับ (ไม่บังคับ)" className={fieldCls} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">ขนส่ง</label>
              <select value={carrier} onChange={e => setCarrier(e.target.value)} className={fieldCls}>
                <option value="">ไม่ระบุ</option>
                {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Item rows */}
          <div>
            <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">สินค้า *</label>
            <div className="space-y-3">
              {items.map((item, i) => (
                <ProductItemRow
                  key={item._id}
                  item={item}
                  index={i}
                  allProducts={allProducts}
                  productsLoading={productsLoading && i === 0}
                  canRemove={items.length > 1}
                  onChange={updateItem}
                  onRemove={removeItem}
                />
              ))}
            </div>
            <button onClick={addItem} className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline">
              <Plus size={12} /> เพิ่มสินค้า
            </button>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 motion-safe:active:scale-95">
              {saving && <Loader2 size={13} className="animate-spin" />}
              บันทึกออเดอร์
            </button>
            <button onClick={reset} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors min-h-[44px] sm:min-h-0 px-2">
              ล้างข้อมูล
            </button>
          </div>

          {result && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
              result.ok
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
            }`}>
              {result.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {result.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
