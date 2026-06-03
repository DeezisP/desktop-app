

import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import WarehouseService, { type OrderImport } from '../service/WarehouseService';
import ImportHistoryPanel, { saveImportSession } from './ImportHistoryPanel';
import ManualOrderForm from './ManualOrderForm';
import { useAdminGuard } from '../hooks/useAdminGuard';

// ── Types ─────────────────────────────────────────────────────────────────────

type QueueStatus = 'WAITING' | 'PACKED' | 'ERROR' | 'DUPLICATE';

type OrderItem = {
  sku: string;
  product_name: string;
  qty: number;
  price: number;
  variant?: string;
};

type ParsedOrder = {
  order_no: string;
  tracking_no: string;
  platform: string;
  customer_name: string;
  items: OrderItem[];
  status: string;
  shipping_method: string;
  created_at: string;
  // Shopee extended
  phone?: string;
  address?: string;
  province?: string;
  buyer_note?: string;
  shop?: string;
};

type QueueEntry = ParsedOrder & {
  _id: string;
  _row: number;
  _queue: QueueStatus;
  _errors: string[];
  _raw: Record<string, unknown>;
};

type FieldMap = Record<string, string[]>;
type PlatformId = 'shopee';

// ── Field maps ────────────────────────────────────────────────────────────────
// Exact column names from actual platform Excel exports.
// resolveField strips leading * from Excel headers before matching.

const SHOPEE_FIELD_MAP: FieldMap = {
  order_no:        ['หมายเลขคำสั่งซื้อ'],
  tracking_no:     ['หมายเลขติดตามพัสดุ'],  // * is stripped at runtime
  customer_name:   ['ชื่อผู้รับ', 'ชื่อผู้ใช้ (ผู้ซื้อ)'],
  sku:             ['เลขอ้างอิง SKU (SKU Reference No.)', 'เลขอ้างอิง Parent SKU'],
  product_name:    ['ชื่อสินค้า'],
  variant:         ['ชื่อตัวเลือก'],
  qty:             ['จำนวน'],
  price:           ['ราคาขาย', 'ราคาสินค้าที่ชำระโดยผู้ซื้อ (THB)', 'ราคาตั้งต้น'],
  status:          ['สถานะการสั่งซื้อ'],
  shipping_method: ['ตัวเลือกการจัดส่ง', 'วิธีการจัดส่ง'],
  created_at:      ['วันที่ทำการสั่งซื้อ', 'เวลาการชำระสินค้า'],
  phone:           ['หมายเลขโทรศัพท์'],
  address:         ['ที่อยู่ในการจัดส่ง'],
  province:        ['จังหวัด'],
  buyer_note:      ['หมายเหตุจากผู้ซื้อ'],
};

const MANUAL_FIELD_MAP: FieldMap = {
  order_no:        ['order_no', 'order_number', 'Order No', 'Order Number'],
  tracking_no:     ['tracking_no', 'tracking_number', 'Tracking No', 'Tracking Number'],
  customer_name:   ['customer_name', 'customer', 'Customer Name', 'Buyer'],
  sku:             ['sku', 'SKU', 'item_sku'],
  product_name:    ['product_name', 'product', 'Product Name', 'Item Name'],
  variant:         ['variant', 'variation', 'option', 'Variation'],
  qty:             ['qty', 'quantity', 'Qty', 'Quantity'],
  price:           ['price', 'Price', 'unit_price'],
  status:          ['status', 'order_status', 'Status', 'Order Status'],
  shipping_method: ['shipping_method', 'shipping', 'Shipping Method'],
  created_at:      ['created_at', 'created_date', 'Created Date', 'Order Date'],
  phone:           ['phone', 'phone_number', 'Phone'],
  address:         ['address', 'shipping_address', 'Address'],
  province:        ['province', 'Province', 'State'],
  buyer_note:      ['buyer_note', 'note', 'Note', 'Remark'],
};

const LAZADA_FIELD_MAP: FieldMap = {
  order_no:        ['orderNumber'],
  tracking_no:     ['trackingCode'],
  customer_name:   ['shippingName', 'customerName'],
  sku:             ['sellerSku'],
  product_name:    ['itemName'],
  variant:         ['variation'],
  qty:             [],  // Lazada: one row = one unit; merged after grouping
  price:           ['paidPrice', 'unitPrice'],
  status:          ['status'],
  shipping_method: ['shippingProvider', 'cdShippingProvider'],
  created_at:      ['createTime'],
  phone:           ['shippingPhone'],
  address:         ['shippingAddress'],
  province:        ['shippingRegion', 'shippingCity'],
  buyer_note:      ['sellerNote'],
};

const TIKTOK_FIELD_MAP: FieldMap = {
  order_no:        ['Order ID'],
  tracking_no:     ['Tracking ID'],
  customer_name:   ['Recipient'],
  sku:             ['Seller SKU'],
  product_name:    ['Product Name'],
  variant:         ['Variation'],
  qty:             ['Quantity'],
  price:           ['SKU Subtotal After Discount', 'Order Amount'],
  status:          ['Order Status'],
  shipping_method: ['Shipping Provider Name', 'Delivery Option'],
  created_at:      ['Created Time', 'Paid Time'],
  phone:           ['Phone #'],
  address:         ['Detail Address'],
  province:        ['Province'],
  buyer_note:      ['Buyer Message'],
};

// BigSeller multi-platform export (contains แพลตฟอร์ม + ร้านค้าเพลตฟอร์ม per row)
const BIGSELLER_FIELD_MAP: FieldMap = {
  order_no:        ['หมายเลขคำสั่งซื้อ'],
  tracking_no:     ['หมายเลขแทรคกิ้ง', 'หมายเลขพัสดุ'],
  customer_name:   ['ชื่อผู้รับ', 'ชื่อผู้ซื้อ'],
  sku:             ['SKU', 'SKU Merchant'],
  product_name:    ['ชื่อสินค้า'],
  variant:         ['ชื่อตัวเลือก'],
  qty:             ['จำนวน'],
  price:           ['ราคา', 'รวมค่าสินค้า'],
  status:          ['สถานะคำสั่งซื้อ'],
  shipping_method: ['ชื่อโลจิสติกส์', 'วิธีการจัดส่ง'],
  created_at:      ['เวลาสั่งซื้อ', 'เวลาการชำระเงิน'],
  phone:           ['เบอร์โทรศัพท์'],
  address:         ['ที่อยู่รับสินค้า'],
  province:        ['จังหวัด'],
  buyer_note:      ['หมายเหตุผู้ซื้อ'],
  platform:        ['แพลตฟอร์ม'],
  shop:            ['ร้านค้าเพลตฟอร์ม', 'ร้านค้า BigSeller'],
};

type ParseMode = 'auto' | 'shopee' | 'lazada' | 'tiktok' | 'manual' | 'bigseller';

const PARSE_MODE_OPTIONS: { value: ParseMode; label: string }[] = [
  { value: 'auto',      label: 'ตรวจจับอัตโนมัติ' },
  { value: 'bigseller', label: 'BigSeller' },
  { value: 'shopee',    label: 'Shopee' },
  { value: 'lazada',    label: 'Lazada' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'manual',    label: 'Manual / CSV' },
];

const PARSE_MODE_FIELD_MAPS: Record<Exclude<ParseMode, 'auto'>, FieldMap> = {
  bigseller: BIGSELLER_FIELD_MAP,
  shopee:    SHOPEE_FIELD_MAP,
  lazada:    LAZADA_FIELD_MAP,
  tiktok:    TIKTOK_FIELD_MAP,
  manual:    MANUAL_FIELD_MAP,
};

const PLATFORM_DISPLAY_NAMES: Partial<Record<Exclude<ParseMode, 'auto'>, string>> = {
  tiktok:    'TikTok',
  bigseller: 'BigSeller',
};

function detectPlatformFromHeaders(headers: string[]): Exclude<ParseMode, 'auto'> {
  const h = headers.map(s => normalizeHeader(s).toLowerCase()).join(' ');
  // BigSeller: unique column "ร้านค้า BigSeller" or combination of platform + tracking columns
  if (h.includes('ร้านค้า bigseller') || (h.includes('ร้านค้าเพลตฟอร์ม') && h.includes('หมายเลขแทรคกิ้ง'))) return 'bigseller';
  // Shopee: ราคาขาย or หมายเลขติดตามพัสดุ are unique to its export
  if (h.includes('ราคาขาย') || h.includes('หมายเลขติดตามพัสดุ')) return 'shopee';
  if (h.includes('orderitemid') || h.includes('lazadaid') || (h.includes('itemname') && h.includes('trackingcode'))) return 'lazada';
  if (h.includes('recipient') || h.includes('phone #') || (h.includes('order id') && h.includes('tracking id'))) return 'tiktok';
  return 'manual';
}

// Lazada exports one row per unit — merge rows with same product+variant into one item with summed qty
function mergeDuplicateItems(entries: QueueEntry[]): QueueEntry[] {
  return entries.map(entry => {
    const map = new Map<string, OrderItem>();
    for (const item of entry.items) {
      const key = `${item.product_name}||${item.variant ?? ''}`;
      const qty = item.qty > 0 ? item.qty : 1;
      const existing = map.get(key);
      if (existing) { existing.qty += qty; }
      else { map.set(key, { ...item, qty }); }
    }
    return { ...entry, items: Array.from(map.values()) };
  });
}

// ── Platform config ───────────────────────────────────────────────────────────

interface PlatformConfig {
  id: PlatformId;
  label: string;
  subLabel: string;
  available: boolean;
  fieldMap: FieldMap;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  logo: React.ReactNode;
}

const SHOPEE_LOGO = (
  <svg viewBox="0 0 48 48" className="w-5 h-5" fill="none">
    <circle cx="24" cy="24" r="24" fill="#EE4D2D" />
    <path d="M24 10c-5 0-9 4-9 9 0 1.1.2 2.1.5 3H13a2 2 0 00-2 2l1.5 14A2 2 0 0014.5 40h19a2 2 0 001.9-2L37 24a2 2 0 00-2-2h-2.5c.3-.9.5-1.9.5-3 0-5-4-9-9-9zm0 3a6 6 0 016 6c0 1.1-.3 2.1-.8 3h-10.4A6 6 0 0118 19a6 6 0 016-6z" fill="white" />
  </svg>
);

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    id: 'shopee',
    label: 'Shopee',
    subLabel: 'Seller Centre Export',
    available: true,
    fieldMap: SHOPEE_FIELD_MAP,
    accentBg: 'bg-orange-50 dark:bg-orange-900/20',
    accentText: 'text-orange-600 dark:text-orange-400',
    accentBorder: 'border-orange-200 dark:border-orange-800',
    logo: SHOPEE_LOGO,
  },
];



// ── Helpers ───────────────────────────────────────────────────────────────────

// Shopee prefixes some headers with * — strip it before matching
function normalizeHeader(h: string): string {
  return h.replace(/^\*+/, '').trim();
}

function resolveField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const normK = normalizeHeader(k).toLowerCase();
    const found = Object.keys(row).find(rk => normalizeHeader(rk).toLowerCase() === normK);
    if (found !== undefined) {
      const val = row[found];
      if (val !== null && val !== undefined && String(val).trim() !== '') return String(val).trim();
    }
  }
  return '';
}

function resolveNumber(row: Record<string, unknown>, keys: string[]): number {
  const raw = resolveField(row, keys);
  const n = parseFloat(raw.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function isRowEmpty(row: Record<string, unknown>): boolean {
  return Object.values(row).every(v => v === null || v === undefined || String(v).trim() === '');
}

// Groups raw rows by order_no (primary) or tracking_no (fallback).
// Same order_no with multiple rows = multi-item order → merged into items[].
// Validates only: missing BOTH order_no AND tracking_no, or empty rows.
function groupAndMergeRows(
  rawRows: Record<string, unknown>[],
  fieldMap: FieldMap,
  platformLabel: string,
): QueueEntry[] {
  type RowData = {
    order_no: string; tracking_no: string; customer_name: string;
    sku: string; product_name: string; variant: string;
    qty: number; price: number; status: string; shipping_method: string;
    created_at: string; phone: string; address: string;
    province: string; buyer_note: string;
    platform: string; shop: string;
    _rawIndex: number; _raw: Record<string, unknown>;
  };

  const parsed: RowData[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (isRowEmpty(row)) continue;
    parsed.push({
      order_no:        resolveField(row, fieldMap.order_no        ?? []),
      tracking_no:     resolveField(row, fieldMap.tracking_no     ?? []),
      customer_name:   resolveField(row, fieldMap.customer_name   ?? []),
      sku:             resolveField(row, fieldMap.sku             ?? []),
      product_name:    resolveField(row, fieldMap.product_name    ?? []),
      variant:         resolveField(row, fieldMap.variant         ?? []),
      qty:             resolveNumber(row, fieldMap.qty            ?? []),
      price:           resolveNumber(row, fieldMap.price          ?? []),
      status:          resolveField(row, fieldMap.status          ?? []),
      shipping_method: resolveField(row, fieldMap.shipping_method ?? []),
      created_at:      resolveField(row, fieldMap.created_at      ?? []),
      phone:           resolveField(row, fieldMap.phone           ?? []),
      address:         resolveField(row, fieldMap.address         ?? []),
      province:        resolveField(row, fieldMap.province        ?? []),
      buyer_note:      resolveField(row, fieldMap.buyer_note      ?? []),
      platform:        resolveField(row, fieldMap.platform        ?? []),
      shop:            resolveField(row, fieldMap.shop            ?? []),
      _rawIndex: i,
      _raw: row,
    });
  }

  // Group: order_no preferred, fallback to tracking_no, else singleton per row
  const groups = new Map<string, RowData[]>();
  for (const r of parsed) {
    const key = r.order_no
      ? `order:${r.order_no}`
      : r.tracking_no
        ? `tracking:${r.tracking_no}`
        : `empty:${r._rawIndex}`;
    const existing = groups.get(key);
    if (existing) existing.push(r);
    else groups.set(key, [r]);
  }

  const entries: QueueEntry[] = [];
  let idx = 0;
  for (const [, rows] of groups) {
    const first = rows[0];
    const items: OrderItem[] = rows.map(r => ({
      sku: r.sku,
      product_name: r.product_name,
      qty: r.qty,
      price: r.price,
      variant: r.variant || undefined,
    }));

    const errors: string[] = [];
    if (!first.order_no && !first.tracking_no) {
      errors.push('ไม่มีเลขคำสั่งซื้อและเลขพัสดุ');
    }

    entries.push({
      _id: `entry-${idx++}`,
      _row: first._rawIndex,
      _queue: errors.length > 0 ? 'ERROR' : 'WAITING',
      _errors: errors,
      _raw: first._raw,
      order_no: first.order_no,
      tracking_no: first.tracking_no,
      platform: first.platform || platformLabel,
      customer_name: first.customer_name,
      items,
      status: first.status,
      shipping_method: first.shipping_method,
      created_at: first.created_at,
      phone: first.phone || undefined,
      address: first.address || undefined,
      province: first.province || undefined,
      buyer_note: first.buyer_note || undefined,
      shop: first.shop || undefined,
    });
  }

  return entries;
}

// ── Sub-components ────────────────────────────────────────────────────────────


// ── Coming soon panel ─────────────────────────────────────────────────────────

function ComingSoonPanel({ config }: { config: PlatformConfig }) {
  const fieldEntries = Object.entries(config.fieldMap);
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${config.accentBg} border ${config.accentBorder}`}>
        {config.logo}
      </div>
      <div>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 ${config.accentBg} ${config.accentText} border ${config.accentBorder}`}>
          กำลังพัฒนา
        </span>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">{config.label} Import</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md">
          รองรับการนำเข้าจาก {config.label} {config.subLabel} กำลังอยู่ในระหว่างการพัฒนา
        </p>
      </div>
      {fieldEntries.length > 0 && (
        <div className="w-full max-w-lg mt-2">
          <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
            คอลัมน์ที่จะรองรับ
          </p>
          <div className="grid grid-cols-2 gap-2 text-left">
            {fieldEntries.map(([key, aliases]) => (
              <div key={key} className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <p className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">{key}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{aliases[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shopee import panel ───────────────────────────────────────────────────────

const IMPORT_BATCH_SIZE = 200;

function toPayload(e: QueueEntry): OrderImport {
  return {
    order_no:        e.order_no,
    tracking_no:     e.tracking_no,
    platform:        e.platform,
    shop:            e.shop,
    customer_name:   e.customer_name,
    items:           e.items.map(i => ({
      sku:          i.sku,
      product_name: i.product_name,
      variant:      i.variant,
      qty:          i.qty,
      price:        i.price,
    })),
    status:          e.status,
    shipping_method: e.shipping_method,
    created_at:      e.created_at,
    phone:           e.phone,
    address:         e.address,
    province:        e.province,
    buyer_note:      e.buyer_note,
  };
}

function ShopeeImportPanel() {
  const { requireAdmin } = useAdminGuard();
  const [isDragging, setIsDragging]     = useState(false);
  const [parseMode, setParseMode]       = useState<ParseMode>('auto');
  const [processing, setProcessing]     = useState(false);
  const [progress, setProgress]         = useState(0);
  const [statusText, setStatusText]     = useState('');
  const [fileName, setFileName]         = useState<string | null>(null);
  const [result, setResult]             = useState<{ ok: boolean; message: string } | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const progressRef   = useRef(0);
  const softCapRef    = useRef(22);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const setExactProgress = useCallback((pct: number) => {
    stopTimer();
    progressRef.current = pct;
    setProgress(pct);
  }, [stopTimer]);

  const processFile = useCallback(async (f: File) => {
    if (!requireAdmin()) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) return;
    setFileName(f.name);
    setResult(null);
    setStatusText('กำลังอ่านไฟล์...');
    stopTimer();
    progressRef.current = 0;
    softCapRef.current  = 22;
    setProgress(0);
    setProcessing(true);

    // Fake-progress timer covers the file-read + XLSX-parse phase (0 → 25%).
    timerRef.current = setInterval(() => {
      const cap  = softCapRef.current;
      const next = progressRef.current + (cap - progressRef.current) * 0.12;
      progressRef.current = next;
      setProgress(Math.round(next));
    }, 80);

    try {
      // ── Phase 1: read + parse file ─────────────────────────────────────────
      const entries = await new Promise<QueueEntry[]>((resolve, reject) => {
        const processRows = (rows: Record<string, unknown>[]) => {
          if (rows.length === 0) { resolve([]); return; }
          const headers = Object.keys(rows[0]);
          const resolved: Exclude<ParseMode, 'auto'> =
            parseMode === 'auto' ? detectPlatformFromHeaders(headers) : parseMode;
          const fieldMap = PARSE_MODE_FIELD_MAPS[resolved];
          const platformLabel = PLATFORM_DISPLAY_NAMES[resolved] ?? (resolved.charAt(0).toUpperCase() + resolved.slice(1));
          let es = groupAndMergeRows(rows, fieldMap, platformLabel);
          if (resolved === 'lazada') es = mergeDuplicateItems(es);
          if (resolved === 'tiktok') es = es.map(e => ({ ...e, shipping_method: 'TIKTOK' }));
          resolve(es);
        };

        const reader = new FileReader();
        reader.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 20);
            softCapRef.current = Math.max(softCapRef.current, pct);
          }
        };

        if (ext === 'csv') {
          reader.onload = (ev) => {
            try {
              softCapRef.current = 22;
              const text = ev.target!.result as string;
              const firstLine = text.split('\n')[0] ?? '';
              const tabCount   = (firstLine.match(/\t/g)  ?? []).length;
              const commaCount = (firstLine.match(/,/g)   ?? []).length;
              const fs = tabCount > commaCount ? '\t' : ',';
              const wb = XLSX.read(text, { type: 'string', FS: fs });
              processRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' }));
            } catch (err) { reject(err); }
          };
          reader.onerror = reject;
          reader.readAsText(f, 'utf-8');
        } else {
          reader.onload = async (ev) => {
            try {
              softCapRef.current = 22;
              // Yield one frame so "กำลังอ่านไฟล์..." renders before the blocking parse.
              await new Promise(r => setTimeout(r, 16));
              const data = new Uint8Array(ev.target!.result as ArrayBuffer);
              const wb = XLSX.read(data, { type: 'array', cellDates: true });
              processRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' }));
            } catch (err) { reject(err); }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(f);
        }
      });

      // ── Phase 2: chunk + upload ────────────────────────────────────────────
      const validOrders = entries.filter(e => e._queue === 'WAITING');

      if (validOrders.length === 0) {
        setResult({ ok: true, message: 'ไม่มีรายการใหม่ที่ต้องนำเข้า' });
        return;
      }

      const chunks: QueueEntry[][] = [];
      for (let i = 0; i < validOrders.length; i += IMPORT_BATCH_SIZE) {
        chunks.push(validOrders.slice(i, i + IMPORT_BATCH_SIZE));
      }

      let totalNew = 0, totalSkipped = 0, failedBatches = 0;
      const platforms = new Set<string>();

      setExactProgress(25);

      for (let i = 0; i < chunks.length; i++) {
        const sentSoFar = i * IMPORT_BATCH_SIZE + chunks[i].length;
        setStatusText(`นำเข้า batch ${i + 1}/${chunks.length} · ${sentSoFar}/${validOrders.length} รายการ`);

        try {
          const res = await WarehouseService.importOrders(chunks[i].map(toPayload));
          totalNew     += res.data.data.newCount;
          totalSkipped += res.data.data.skippedCount;
          chunks[i].forEach(e => e.platform && platforms.add(e.platform));
        } catch {
          failedBatches++;
        }

        // 25 → 95 % spread across batches
        const pct = Math.round(25 + ((i + 1) / chunks.length) * 70);
        progressRef.current = pct;
        setProgress(pct);
      }

      const platformStr = [...platforms].filter(Boolean).join(', ') || 'Shopee';
      await saveImportSession({
        platform:     platformStr,
        tried:        validOrders.length,
        newCount:     totalNew,
        skippedCount: totalSkipped,
      });

      if (failedBatches === 0) {
        setResult({
          ok: true,
          message: `นำเข้าสำเร็จ ${totalNew} รายการ${totalSkipped > 0 ? ` · ซ้ำ ${totalSkipped}` : ''}`,
        });
      } else if (failedBatches < chunks.length) {
        setResult({
          ok: true,
          message: `นำเข้าสำเร็จ ${totalNew} รายการ · ล้มเหลว ${failedBatches}/${chunks.length} batch`,
        });
      } else {
        setResult({ ok: false, message: 'นำเข้าไม่สำเร็จ กรุณาลองใหม่' });
      }
    } catch {
      setResult({ ok: false, message: 'นำเข้าไม่สำเร็จ กรุณาลองใหม่' });
    } finally {
      stopTimer();
      progressRef.current = 100;
      setProgress(100);
      setStatusText('');
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [parseMode, stopTimer, setExactProgress]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [processFile]);

  return (
    <div className="space-y-4">

      {/* Platform format selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">แพลตฟอร์ม:</span>
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
          {PARSE_MODE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setParseMode(opt.value)}
              className={`px-3 py-1.5 font-medium transition-colors border-r border-zinc-200 dark:border-zinc-700 last:border-r-0 ${
                parseMode === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${
          result.ok
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400'
        }`}>
          {result.ok ? <CheckCircle2 size={15} className="flex-shrink-0" /> : <AlertTriangle size={15} className="flex-shrink-0" />}
          {result.message}
        </div>
      )}

      {processing ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <div className="relative w-24 h-24">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8"
                className="stroke-zinc-100 dark:stroke-zinc-800" />
              <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8"
                strokeLinecap="round"
                className="stroke-blue-500 transition-all duration-200 ease-out"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-black tabular-nums text-zinc-800 dark:text-zinc-200">
              {progress}%
            </span>
          </div>
          {statusText && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">{statusText}</p>
          )}
          {fileName && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <FileSpreadsheet size={13} className="text-orange-500 flex-shrink-0" />
              <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate max-w-[220px]">{fileName}</span>
            </div>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all py-14 px-8 ${
            isDragging
              ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 scale-[1.01]'
              : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-orange-300 hover:bg-orange-50/30 dark:hover:bg-orange-900/10'
          }`}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />

          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-orange-100 dark:bg-orange-800/40' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
            <Upload size={26} className={isDragging ? 'text-orange-500' : 'text-zinc-400'} />
          </div>

          <div className="text-center">
            <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
              {isDragging ? 'วางไฟล์ที่นี่' : 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือก'}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              รองรับ{' '}
              {['.xlsx', '.xls', '.csv'].map(ext => (
                <code key={ext} className="mx-0.5 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono">{ext}</code>
              ))}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImportPanel() {
  const [activePlatform, setActivePlatform] = useState<PlatformId>('shopee');

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-5">

        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-blue-600" />
            นำเข้าคำสั่งซื้อ
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            อัปโหลด Excel · วิเคราะห์ข้อมูล · เตรียมคิวจัดส่ง
          </p>
        </div>

        <ShopeeImportPanel />

        <ManualOrderForm />

        <div>
          <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">ประวัติการนำเข้า</p>
          <ImportHistoryPanel />
        </div>

      </div>
    </div>
  );
}
