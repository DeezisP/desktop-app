import { BackendQueueStatus, WarehouseProduct } from './WarehouseService';

// ── Status meta ───────────────────────────────────────────────────────────────

export const STATUS_META: Record<BackendQueueStatus, {
  bg: string; text: string; border: string; dot: string; label: string;
}> = {
  WAITING: { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-400',   border: 'border-blue-200 dark:border-blue-700',   dot: 'bg-blue-500',   label: 'รอแพ็ค' },
  PACKING: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-700', dot: 'bg-amber-500', label: 'กำลังแพ็ค' },
  DONE:    { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-700', dot: 'bg-green-500', label: 'แพ็คแล้ว' },
  ERROR:   { bg: 'bg-red-50 dark:bg-red-900/20',    text: 'text-red-700 dark:text-red-400',    border: 'border-red-200 dark:border-red-700',    dot: 'bg-red-500',   label: 'ผิดพลาด' },
};

export const STATUS_BAR: Record<BackendQueueStatus, string> = {
  WAITING: 'border-l-blue-400 dark:border-l-blue-500',
  PACKING: 'border-l-amber-400 dark:border-l-amber-500',
  DONE:    'border-l-green-400 dark:border-l-green-500',
  ERROR:   'border-l-red-400 dark:border-l-red-500',
};

// ── Carrier helpers ───────────────────────────────────────────────────────────

export function getCarrierKey(shippingMethod: string, platform: string): string {
  const raw = shippingMethod;
  if (/spx/i.test(raw))     return 'SPX';
  if (/flash/i.test(raw))   return 'Flash';
  if (/lazada/i.test(raw))  return 'Lazada';
  if (/tiktok/i.test(raw))  return 'TikTok';
  if (/\bkey\b/i.test(raw)) return 'Key';
  const p = platform.toLowerCase();
  if (p.includes('shopee'))  return 'Shopee';
  if (p.includes('lazada'))  return 'Lazada';
  if (p.includes('tiktok'))  return 'TikTok';
  return raw.trim() || 'ไม่ระบุ';
}

export function getCarrierStyle(carrier: string): string {
  switch (carrier) {
    case 'Shopee': return 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700';
    case 'SPX':    return 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700';
    case 'Flash':  return 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700';
    case 'Lazada': return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700';
    case 'TikTok': return 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-700';
    case 'Key':    return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700';
    default:       return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
  }
}

export function getSectionStyle(carrier: string): string {
  switch (carrier) {
    case 'Shopee': return 'bg-orange-50/70 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    case 'SPX':    return 'bg-orange-50/70 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    case 'Flash':  return 'bg-red-50/70 dark:bg-red-900/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
    case 'Lazada': return 'bg-amber-50/70 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'TikTok': return 'bg-pink-50/70 dark:bg-pink-900/10 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800';
    case 'Key':    return 'bg-blue-50/70 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    default:       return 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
  }
}

// ── Product grouping ──────────────────────────────────────────────────────────

export interface ProductGroup {
  base: string;
  items: WarehouseProduct[];
}

export function getBaseName(title: string): string {
  const i = title.lastIndexOf(' - ');
  return i > 0 ? title.slice(0, i).trim() : title;
}

export function getVariantLabel(title: string, base: string): string {
  if (title === base) return '';
  return title.slice(base.length).replace(/^\s*-\s*/, '').trim() || title;
}

export function groupProducts(products: WarehouseProduct[]): ProductGroup[] {
  const map = new Map<string, WarehouseProduct[]>();
  for (const p of products) {
    const base = getBaseName(p.title);
    const list = map.get(base) ?? [];
    list.push(p);
    map.set(base, list);
  }
  return Array.from(map.entries()).map(([base, items]) => ({ base, items }));
}
