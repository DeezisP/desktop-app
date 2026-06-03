

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Search, Printer, Plus, Minus, X, Package, Loader2,
  User, QrCode, Save, Trash2, Truck, FileDown, Clock,
  CheckCircle2, AlertCircle, FileText,
} from 'lucide-react';
import WarehouseService, { type WarehouseProduct, type OrderImport, type BackendOrder } from '../service/WarehouseService';
import { encodeCode128B, totalModules } from '../service/code128';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const SENDER_NAME = 'Perfect Electronic';
const SENDER_PHONE = '088-683-7697';

interface LabelItem { product: WarehouseProduct; qty: number; }

interface SavedLabel {
  id: number;
  carrier: string;
  barcodeValue: string;
  savedAt: string;
  items: LabelItem[];
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function p2(n: number) { return String(n).padStart(2, '0'); }

/** Split product title into main name and variation */
function splitProductAndVariant(title: string): { name: string; variant: string } {
  if (!title) return { name: '', variant: '' };

  const idx = title.lastIndexOf(' - ');
  if (idx !== -1) {
    return { name: title.slice(0, idx).trim(), variant: title.slice(idx + 3).trim() };
  }

  const bracketMatch = title.match(/^(.*?)\s*\((.+?)\)$/);
  if (bracketMatch) {
    return { name: bracketMatch[1].trim(), variant: bracketMatch[2].trim() };
  }

  return { name: title, variant: '' };
}

/** Group products by base name */
function groupProducts(products: WarehouseProduct[]) {
  const map = new Map<string, WarehouseProduct[]>();
  for (const p of products) {
    const base = splitProductAndVariant(p.title).name;
    if (!map.has(base)) map.set(base, []);
    map.get(base)!.push(p);
  }
  return Array.from(map.entries()).map(([base, items]) => ({ base, items }));
}

function makeBarcodeValue(id: number): string {
  const n = new Date();
  const ts = `${n.getFullYear()}${p2(n.getMonth() + 1)}${p2(n.getDate())}${p2(n.getHours())}${p2(n.getMinutes())}${p2(n.getSeconds())}`;
  return `${ts}${String(id).padStart(6, '0')}`;
}

function backendOrderToSavedLabel(order: BackendOrder): SavedLabel {
  return {
    id: order.id,
    carrier: order.shippingMethod ?? 'KEY',
    barcodeValue: order.orderNumber,
    savedAt: order.importedAt ?? order.createdAt,
    recipientName: order.customerName ?? '',
    recipientPhone: order.phone ?? '',
    recipientAddress: order.address ?? '',
    items: order.items.map(item => ({
      product: {
        id: item.matchedProductId ?? 0,
        title: item.productName ?? '',
        wordpressProductId: null,
        normalizedTitle: '',
        stock: 0,
        reservedStock: 0,
        availableStock: item.productStock ?? 0,
        syncedAt: null,
        createdAt: '',
        updatedAt: '',
        stockChecked: false,
        generated: false,
      },
      qty: item.qty,
    })),
  };
}

async function captureAndPrint(element: HTMLElement, mode: 'label' | 'bill' = 'label') {
  const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false });
  const imgData = canvas.toDataURL('image/png');
  const [w, h, pw, ph] = [450, 720, '100mm', '150mm'];
  const win = window.open('', '_blank', `width=${w},height=${h}`);
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${mode === 'bill' ? 'บิล' : 'ป้ายพัสดุ'}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#fff; }
img { width:${pw}; height:auto; display:block; }
@media print { @page { size:${pw} ${ph}; margin:0; } }
</style></head><body>
<img src="${imgData}" onload="window.print();window.close();" />
</body></html>`);
  win.document.close();
}

// ── Code 128B barcode ─────────────────────────────────────────────────────────

function Code128SVG({ value, width = 348, height = 60 }: { value: string; width?: number; height?: number }) {
  if (!value) return null;
  const widths = encodeCode128B(value);
  const QUIET = 10;
  const total = totalModules(widths) + QUIET * 2;
  const mw = width / total;
  const rects: { x: number; w: number }[] = [];
  let x = QUIET * mw;
  for (let i = 0; i < widths.length; i++) {
    if (i % 2 === 0) rects.push({ x, w: widths[i] * mw });
    x += widths[i] * mw;
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', margin: '0 auto' }}>
      <rect x={0} y={0} width={width} height={height} fill="#fff" />
      {rects.map((r, i) => <rect key={i} x={r.x} y={0} width={Math.max(0.5, r.w - 0.1)} height={height} fill="#000" />)}
    </svg>
  );
}

// ── Shipping Label ────────────────────────────────────────────────────────────

function ShippingLabel({
  items, recipientName, recipientPhone, recipientAddress, barcodeValue, mode = 'label',
}: {
  items: LabelItem[];
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  barcodeValue: string;
  mode?: 'label' | 'bill';
}) {
  const LABEL_W = 375;
  const BARCODE_W = LABEL_W - 32;

  return (
    <div style={{
      width: `${LABEL_W}px`,
      backgroundColor: '#ffffff',
      fontFamily: '"Sarabun","Noto Sans Thai",Arial,sans-serif',
      color: '#111111',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
      border: '1px solid #e5e7eb',
    }}>
      {/* Brand header */}
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontWeight: 800, fontSize: '13px', letterSpacing: '0.04em', color: '#000000' }}>PERFECT ELECTRONIC</div>
        <div style={{ fontSize: '7px', fontWeight: 700, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.14em', borderRadius: '4px', padding: '3px 7px' }}>
          {mode === 'bill' ? 'บิล' : 'ป้ายพัสดุ'}
        </div>
      </div>

      {/* Barcode */}
      <div style={{ padding: '14px 18px 10px', borderBottom: '1px dashed #d1d5db', backgroundColor: '#fafafa', textAlign: 'center' }}>
        {barcodeValue ? (
          <>
            <Code128SVG value={barcodeValue} width={BARCODE_W} height={54} />
            <div style={{ fontFamily: 'monospace', fontSize: '8px', color: '#000000', marginTop: '5px', letterSpacing: '2px' }}>
              {barcodeValue}
            </div>
          </>
        ) : (
          <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000000', fontSize: '10px' }}>
            เพิ่มสินค้าเพื่อแสดงบาร์โค้ด
          </div>
        )}
      </div>

      {/* Sender / Recipient */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ flex: 1, padding: '10px 14px', borderRight: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '7px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>ผู้ส่ง</div>
          <div style={{ fontWeight: 700, fontSize: '9px' }}>{SENDER_NAME}</div>
          <div style={{ fontSize: '8px', marginTop: '2px' }}>โทร. {SENDER_PHONE}</div>
        </div>
        <div style={{ flex: 2, padding: '10px 14px' }}>
          <div style={{ fontSize: '7px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>ผู้รับ</div>
          {recipientName ? (
            <div style={{ fontWeight: 800, fontSize: '12px' }}>{recipientName}</div>
          ) : (
            <div style={{ fontSize: '9px', fontStyle: 'italic' }}>ยังไม่ได้กรอกชื่อผู้รับ</div>
          )}
          {recipientPhone && <div style={{ fontSize: '13px', marginTop: '4px' }}>โทร. {recipientPhone}</div>}
          {recipientAddress && <div style={{ fontSize: '13px', marginTop: '5px', lineHeight: '1.6' }}>{recipientAddress}</div>}
        </div>
      </div>

      {mode !== 'bill' && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f4f4f5' }}>
                <th style={{ padding: '6px 14px', textAlign: 'left', fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #e5e7eb' }}>รายการสินค้า</th>
                <th style={{ padding: '6px 14px', textAlign: 'left', width: '130px', fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #e5e7eb' }}>ตัวเลือก</th>
                <th style={{ padding: '6px 14px', textAlign: 'center', width: '50px', fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #e5e7eb' }}>จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '10px 14px', fontStyle: 'italic' }}>ยังไม่ได้เลือกสินค้า</td>
                </tr>
              ) : (
                items.map(({ product, qty }, idx) => {
                  const { name, variant } = splitProductAndVariant(product.title);
                  return (
                    <tr key={product.id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '7px 14px', fontWeight: 600, borderTop: '1px solid #f3f4f6' }}>{name}</td>
                      <td style={{ padding: '7px 14px', fontSize: '8.5px', borderTop: '1px solid #f3f4f6' }}>{variant || '-'}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'center', fontWeight: 800, borderTop: '1px solid #f3f4f6' }}>{qty}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div style={{ padding: '8px 14px', borderTop: '1px dashed #e5e7eb', backgroundColor: '#fafafa', textAlign: 'center', fontSize: '7px', fontStyle: 'italic' }}>
            เฉพาะใช้ภายใน Perfect Electronic Warehouse เท่านั้น
          </div>
        </>
      )}
    </div>
  );
}

// ── Bill Label (barcode-only, compact) ───────────────────────────────────────

// ── Main Component ────────────────────────────────────────────────────────────

export default function BarcodeLabelPanel() {
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [allProducts, setAllProducts] = useState<WarehouseProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allProducts.filter(p => p.title.toLowerCase().includes(q));
  }, [allProducts, searchQuery]);

  // Form
  const [items, setItems] = useState<LabelItem[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');

  // Variation Modal
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [modalVariants, setModalVariants] = useState<WarehouseProduct[]>([]);
  const [selectedInModal, setSelectedInModal] = useState<Set<number>>(new Set());

  // Label mode
  const [labelMode, setLabelMode] = useState<'label' | 'bill'>('label');

  // Bill intro (one-time)
  const [showBillIntro, setShowBillIntro] = useState(() =>
    typeof window !== 'undefined' && !localStorage.getItem('bill_intro_seen')
  );
  const dismissBillIntro = () => {
    localStorage.setItem('bill_intro_seen', '1');
    setShowBillIntro(false);
  };

  // Actions
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);

  const [generating, setGenerating] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);

  // Saved labels
  const [savedLabels, setSavedLabels] = useState<SavedLabel[]>([]);
  const [savedLabelsLoading, setSavedLabelsLoading] = useState(true);
  const [nextId, setNextId] = useState(1);

  const [showDupModal, setShowDupModal] = useState(false);
  const [pendingPrint, setPendingPrint] = useState<SavedLabel | null>(null);
  const hiddenRef = useRef<HTMLDivElement>(null);

  const [hasSavedCurrent, setHasSavedCurrent] = useState(false);
  const [showPrintPrompt, setShowPrintPrompt] = useState(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<SavedLabel | null>(null);

  // Load products
  useEffect(() => {
    WarehouseService.getAllProducts()
      .then(res => setAllProducts(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setProductsLoading(false));
  }, []);

  // Close search dropdown
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setShowResults(false);
      return;
    }
    setShowResults(searchResults.length > 0);
  }, [searchQuery, searchResults]);

  // Load saved labels from DB
  useEffect(() => {
    WarehouseService.getOrders(0, 100)
      .then(res => {
        const keyOrders = (res.data.data?.content ?? []).filter(o => o.platform === 'KEY');
        setSavedLabels(keyOrders.map(backendOrderToSavedLabel));
        const maxId = keyOrders.reduce((m, o) => Math.max(m, o.id), 0);
        setNextId(maxId + 1);
      })
      .catch(() => {})
      .finally(() => setSavedLabelsLoading(false));
  }, []);

  // Reset saved state when form changes
  useEffect(() => { setHasSavedCurrent(false); }, [items, recipientName, recipientPhone, recipientAddress]);

  // Print saved label
  useEffect(() => {
    if (!pendingPrint) return;
    const t = setTimeout(async () => {
      if (!hiddenRef.current) return;
      try {
        await captureAndPrint(hiddenRef.current, pendingPrint.items.length === 0 ? 'bill' : 'label');
      } finally {
        setPendingPrint(null);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [pendingPrint]);

  const openVariationModal = (variants: WarehouseProduct[]) => {
    setModalVariants(variants);
    setSelectedInModal(new Set());
    setShowVariationModal(true);
  };

  const addProduct = useCallback((product: WarehouseProduct) => {
    setItems(prev => {
      const ex = prev.find(i => i.product.id === product.id);
      if (ex) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
    setSearchQuery('');
    setShowResults(false);
  }, []);

  const confirmAddFromModal = () => {
    if (selectedInModal.size === 0) return;
    for (const id of selectedInModal) {
      const p = modalVariants.find(v => v.id === id);
      if (p) addProduct(p);
    }
    setShowVariationModal(false);
    setSelectedInModal(new Set());
    setModalVariants([]);
  };

  const updateQty = useCallback((id: number, delta: number) => {
    setItems(prev => prev.flatMap(i => {
      if (i.product.id !== id) return [i];
      const q = i.qty + delta;
      return q <= 0 ? [] : [{ ...i, qty: q }];
    }));
  }, []);

  const setQtyDirect = useCallback((id: number, qty: number) => {
    if (isNaN(qty) || qty < 1) return;
    setItems(prev => prev.map(i => i.product.id === id ? { ...i, qty } : i));
  }, []);

  const removeItem = useCallback((id: number) => {
    setItems(prev => prev.filter(i => i.product.id !== id));
  }, []);

  const canGenerate = labelMode === 'bill' || items.length > 0;

  const previewBarcode = useMemo(() => {
    const n = new Date();
    const ts = `${n.getFullYear()}${p2(n.getMonth() + 1)}${p2(n.getDate())}${p2(n.getHours())}${p2(n.getMinutes())}${p2(n.getSeconds())}`;
    if (labelMode === 'bill') return `${ts}${String(nextId).padStart(6, '0')}`;
    if (items.length === 0) return '';
    const suffix = String(items.reduce((s, i) => (s * 31 + i.product.id + i.qty) % 1000000, 1)).padStart(6, '0');
    return `${ts}${suffix}`;
  }, [items, labelMode, nextId]);

  const doSave = useCallback(async () => {
    setSaving(true);
    setSaveResult(null);
    const barcodeValue = makeBarcodeValue(nextId);
    const payload: OrderImport[] = [{
      order_no: barcodeValue,
      tracking_no: barcodeValue,
      platform: 'KEY',
      customer_name: recipientName || 'ไม่ระบุ',
      items: items.map(({ product, qty }) => ({
        sku: String(product.id),
        product_name: product.title,
        qty,
        price: 0,
      })),
      status: 'IMPORTED',
      shipping_method: 'KEY',
      created_at: new Date().toISOString(),
      phone: recipientPhone || undefined,
      address: recipientAddress || undefined,
    }];

    try {
      const res = await WarehouseService.importOrders(payload);
      const savedOrder = res.data.data?.orders?.[0];
      const newLabel: SavedLabel = {
        id: savedOrder?.id ?? nextId,
        carrier: 'KEY',
        barcodeValue,
        savedAt: new Date().toISOString(),
        items: [...items],
        recipientName,
        recipientPhone,
        recipientAddress,
      };
      setSavedLabels(prev => [newLabel, ...prev]);
      setNextId(prev => prev + 1);
      setSaveResult('success');
      setLastSavedLabel(newLabel);
      setHasSavedCurrent(true);
      setShowPrintPrompt(true);
    } catch {
      setSaveResult('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveResult(null), 3500);
    }
  }, [items, recipientName, recipientPhone, recipientAddress, nextId]);

  const saveLabel = useCallback(() => {
    if (!canGenerate) return;
    if (labelMode !== 'bill') {
      const itemKey = items.map(i => `${i.product.id}:${i.qty}`).sort().join(',');
      const isDuplicate = savedLabels.some(l => {
        const lKey = l.items.map(i => `${i.product.id}:${i.qty}`).sort().join(',');
        return lKey === itemKey && l.recipientName === recipientName;
      });
      if (isDuplicate) { setShowDupModal(true); return; }
    }
    doSave();
  }, [canGenerate, labelMode, items, savedLabels, recipientName, doSave]);


  const savePDF = useCallback(async () => {
    if (!labelRef.current || !canGenerate) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(labelRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false });
      const imgData = canvas.toDataURL('image/png');
      const [pw, ph] = [100, 150];
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pw, ph] });
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      const name = labelMode === 'bill' ? 'bill' : (recipientName ? recipientName.replace(/\s+/g, '_') : 'label');
      pdf.save(`${name}-${Date.now()}.pdf`);
    } catch (err) { console.error('PDF error:', err); }
    finally { setGenerating(false); }
  }, [canGenerate, recipientName, labelMode]);

  const printSaved = useCallback((label: SavedLabel) => { setPendingPrint(label); }, []);
  const deleteSaved = useCallback(async (id: number) => {
    const label = savedLabels.find(l => l.id === id);
    setSavedLabels(prev => prev.filter(l => l.id !== id));
    if (label?.barcodeValue) {
      try { await WarehouseService.deleteOrder(label.barcodeValue); } catch { }
    }
  }, [savedLabels]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Column - Form */}
        <div className="space-y-4">

          {/* Product search */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3 flex items-center gap-2">
              <QrCode size={14} className="text-blue-500" />
              ค้นหาสินค้า
            </h3>
            <div className="relative" ref={searchRef}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  placeholder="สแกน / พิมพ์ชื่อสินค้า หรือ SKU…"
                  className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {productsLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 animate-spin pointer-events-none" />}
              </div>

              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                  {groupProducts(searchResults).map(g => {
                    const totalStock = g.items.reduce((s, p) => s + p.availableStock, 0);
                    return (
                      <button
                        key={g.base}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (g.items.length === 1) {
                            addProduct(g.items[0]);
                          } else {
                            openVariationModal(g.items);
                          }
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0 flex items-center justify-between"
                      >
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate flex-1">{g.base}</p>
                        <div className="flex items-center gap-2">
                          {g.items.length > 1 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                              {g.items.length} ตัวเลือก
                            </span>
                          )}
                          <span className={`text-[11px] font-semibold ${totalStock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            สต็อก {totalStock}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Selected items */}
          {items.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                  <Package size={14} className="text-blue-500" />
                  สินค้าที่เลือก ({items.length})
                </h3>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map(({ product, qty }) => {
                  const { name, variant } = splitProductAndVariant(product.title);
                  return (
                    <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{name}</p>
                        {variant && <p className="text-xs text-zinc-500 mt-0.5">{variant}</p>}
                        <p className="text-[11px] text-zinc-400 mt-0.5">คงเหลือ {product.availableStock}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => updateQty(product.id, -1)} className="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                          <Minus size={12} />
                        </button>
                        <input type="number" value={qty} min={1} onChange={e => setQtyDirect(product.id, parseInt(e.target.value))} className="w-12 text-center text-sm font-bold border border-zinc-200 dark:border-zinc-700 rounded-lg py-1 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <button onClick={() => updateQty(product.id, 1)} className="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                          <Plus size={12} />
                        </button>
                        <button onClick={() => removeItem(product.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-1">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Address form */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
            <div className="px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">ผู้ส่ง (คงที่)</p>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{SENDER_NAME}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">โทร. {SENDER_PHONE}</p>
            </div>

            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 !mt-3">
              <User size={14} className="text-blue-500" />
              ผู้รับ
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">ชื่อผู้รับ</label>
                <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="ชื่อ-นามสกุลผู้รับ" className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">เบอร์โทร</label>
                <input type="text" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} placeholder="0XX-XXX-XXXX" className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">ที่อยู่จัดส่ง</label>
                <textarea value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Label Preview */}
        <div className="space-y-4">
          {/* Mode tabs */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 w-fit">
            <button
              onClick={() => setLabelMode('label')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${labelMode === 'label' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}
            >
              <FileText size={12} /> ป้ายพัสดุ
            </button>
            <div className="relative">
              <button
                onClick={() => { setLabelMode('bill'); if (showBillIntro) dismissBillIntro(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${labelMode === 'bill' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}
              >
                <QrCode size={12} /> บิล
              </button>

              {showBillIntro && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 w-72">
                  <div className="mx-auto w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[7px] border-b-zinc-800 dark:border-b-zinc-200" />
                  <div className="bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl px-4 py-3 shadow-xl">
                    <p className="text-xs font-semibold mb-1">โหมด บิล คืออะไร?</p>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      สร้างสลิปบาร์โค้ด (100×150 มม.) สำหรับแนบพัสดุ KEY
                      โดยไม่แสดงรายการสินค้า — เหมาะสำหรับพิมพ์ติดกล่องเพื่อสแกนเข้าระบบ
                    </p>
                    <button
                      onClick={dismissBillIntro}
                      className="mt-2.5 w-full py-1.5 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      เข้าใจแล้ว
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mr-auto">
              {labelMode === 'bill' ? 'บาร์โค้ดบิล (100×150 mm)' : 'ตัวอย่างป้าย (100×150 mm)'}
            </h3>
            <button onClick={savePDF} disabled={!canGenerate || generating} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors">
              {generating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} PDF
            </button>
            <button
              onClick={() => lastSavedLabel && setPendingPrint(lastSavedLabel)}
              disabled={!hasSavedCurrent}
              title={!hasSavedCurrent ? 'บันทึกก่อนพิมพ์' : undefined}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              <Printer size={14} /> พิมพ์
            </button>
            <button onClick={saveLabel} disabled={!canGenerate || saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white hover:bg-zinc-700 dark:hover:bg-zinc-100 disabled:opacity-40 text-white dark:text-zinc-900 text-sm font-semibold transition-colors shadow-sm">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึก
            </button>
          </div>

          <div className="flex justify-center">
            <div ref={labelRef}>
              <ShippingLabel
                items={items}
                recipientName={recipientName}
                recipientPhone={recipientPhone}
                recipientAddress={recipientAddress}
                barcodeValue={previewBarcode}
                mode={labelMode}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Saved Labels */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <Clock size={14} className="text-zinc-400" />
            รายการที่บันทึก
          </h3>
          {savedLabelsLoading
            ? <Loader2 size={12} className="animate-spin text-zinc-400" />
            : <span className="text-xs text-zinc-400">({savedLabels.length})</span>
          }
        </div>

        {!savedLabelsLoading && savedLabels.length === 0 && (
          <p className="text-sm text-zinc-400 italic py-4 text-center">ยังไม่มีรายการที่บันทึก</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {savedLabels.map(label => (
            <div key={label.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border-2 border-zinc-800 dark:border-zinc-300 text-zinc-800 dark:text-zinc-200 tracking-wide">
                  <Truck size={10} />{label.carrier}
                </span>
                <span className="text-[10px] text-zinc-400 ml-auto">#{label.id}</span>
              </div>
              <div className="px-4 py-3 space-y-1.5">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {label.recipientName || <span className="text-zinc-400 italic font-normal">ไม่ระบุผู้รับ</span>}
                </p>
                {label.recipientPhone && <p className="text-xs text-zinc-500">{label.recipientPhone}</p>}
                <div className="mt-1 space-y-0.5">
                  {label.items.map(({ product, qty }) => {
                    const { name, variant } = splitProductAndVariant(product.title);
                    return (
                      <p key={product.id} className="text-[11px] text-zinc-500">
                        {name} {variant && <span className="text-zinc-400">({variant})</span>} <span className="font-bold text-zinc-700 dark:text-zinc-300">×{qty}</span>
                      </p>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 pb-3">
                <button onClick={() => printSaved(label)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <Printer size={11} /> พิมพ์
                </button>
                <button onClick={() => deleteSaved(label.id)} className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 size={11} /> ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Variation Selection Modal */}
      {showVariationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="text-lg font-semibold">เลือกตัวเลือกสินค้า</h3>
              <p className="text-sm text-zinc-500 mt-1">เลือกได้หลายตัวเลือก</p>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-2">
                {modalVariants.map(variant => {
                  const { variant: varName } = splitProductAndVariant(variant.title);
                  const isSelected = selectedInModal.has(variant.id);

                  return (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedInModal(prev => {
                        const next = new Set(prev);
                        if (next.has(variant.id)) next.delete(variant.id);
                        else next.add(variant.id);
                        return next;
                      })}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}
                    >
                      <div className="text-left">
                        <p className="font-medium">{varName || variant.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">สต็อก: {variant.availableStock}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-zinc-300 dark:border-zinc-600'}`}>
                        {isSelected && <CheckCircle2 className="text-white" size={13} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-700 flex gap-3">
              <button
                onClick={() => setShowVariationModal(false)}
                className="flex-1 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 font-medium text-zinc-700 dark:text-zinc-300"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmAddFromModal}
                disabled={selectedInModal.size === 0}
                className="flex-1 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold disabled:opacity-50"
              >
                เพิ่มสินค้า{selectedInModal.size > 0 ? ` (${selectedInModal.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print After Save Prompt */}
      {showPrintPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPrintPrompt(false)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-green-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">บันทึกสำเร็จ!</h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    ต้องการพิมพ์ป้ายพัสดุตอนนี้เลยหรือไม่?
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-6 pb-5">
              <button onClick={() => setShowPrintPrompt(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">ไว้ก่อน</button>
              <button
                onClick={() => { setShowPrintPrompt(false); if (lastSavedLabel) setPendingPrint(lastSavedLabel); }}
                className="flex-1 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Printer size={14} /> พิมพ์เลย
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {showDupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDupModal(false)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertCircle size={20} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">พบป้ายซ้ำ</h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    มีป้ายที่บันทึกแล้วด้วยรายการสินค้าและผู้รับเดียวกัน<br />ต้องการบันทึกซ้ำหรือไม่?
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-6 pb-5">
              <button onClick={() => setShowDupModal(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">ยกเลิก</button>
              <button onClick={() => { setShowDupModal(false); doSave(); }} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-sm font-semibold text-white">บันทึกซ้ำ</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden label for printing saved entries */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
        {pendingPrint && (
          <div ref={hiddenRef}>
            <ShippingLabel
              items={pendingPrint.items}
              recipientName={pendingPrint.recipientName}
              recipientPhone={pendingPrint.recipientPhone}
              recipientAddress={pendingPrint.recipientAddress}
              barcodeValue={pendingPrint.barcodeValue}
              mode={pendingPrint.items.length === 0 ? 'bill' : 'label'}
            />
          </div>
        )}
      </div>
    </div>
  );
}