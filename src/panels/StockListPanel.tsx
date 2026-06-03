

import {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, RefreshCw, Loader2, AlertCircle, Package2, Layers,
  ChevronDown, TrendingDown, Minus, Plus, XCircle, Bell, PlusCircle, X, Trash2,
  ClipboardList, CheckCircle2, ChevronRight, Copy, Check,
} from 'lucide-react';
import WarehouseService, { type WarehouseProduct } from '../service/WarehouseService';

// ── Types ──────────────────────────────────────────────────────────────────────

type VariationEntry = { product: WarehouseProduct; label: string };

type ProductGroup = {
  key: string;
  parentTitle: string;
  parent?: WarehouseProduct;
  variations: VariationEntry[];
  isSimple: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function stockColor(stock: number) {
  if (stock <= 0) return { text: 'text-red-600 dark:text-red-400', dot: 'bg-red-400' };
  if (stock < 10) return { text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-400' };
  if (stock < 50) return { text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-400' };
  return { text: 'text-zinc-600 dark:text-zinc-400', dot: 'bg-green-400' };
}

function variationChipClass(stock: number): string {
  if (stock <= 0) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700';
  if (stock < 10) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-700';
  if (stock < 50) return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700';
  return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700';
}

function splitTitle(title: string): { parent: string; label: string } {
  const idx = title.lastIndexOf(' - ');
  if (idx !== -1) return { parent: title.slice(0, idx), label: title.slice(idx + 3) };
  return { parent: title, label: '' };
}

type WarnGroup = { parentTitle: string; items: { product: WarehouseProduct; label: string }[] };

function groupForWarning(products: WarehouseProduct[]): WarnGroup[] {
  const map = new Map<string, WarnGroup>();
  for (const p of products) {
    const { parent, label } = splitTitle(p.title);
    const displayLabel = label !== '' ? label : p.title;
    const g = map.get(parent) ?? { parentTitle: parent, items: [] };
    g.items.push({ product: p, label: displayLabel });
    map.set(parent, g);
  }
  return Array.from(map.values());
}

function groupProducts(products: WarehouseProduct[]): ProductGroup[] {
  const map = new Map<string, { parent?: WarehouseProduct; variations: VariationEntry[] }>();
  for (const p of products) {
    const idx = p.title.lastIndexOf(' - ');
    if (idx !== -1) {
      const parentTitle = p.title.slice(0, idx);
      const label       = p.title.slice(idx + 3);
      const g           = map.get(parentTitle) ?? { variations: [] };
      g.variations.push({ product: p, label });
      map.set(parentTitle, g);
    } else {
      const g = map.get(p.title);
      if (g) { g.parent = p; }
      else { map.set(p.title, { parent: p, variations: [] }); }
    }
  }
  return Array.from(map.entries()).map(([key, g]) => ({
    key,
    parentTitle: key,
    parent:      g.parent,
    variations:  g.variations,
    isSimple:    g.variations.length === 0,
  }));
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonGroup({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-pulse">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-4 h-4 rounded bg-zinc-200 dark:bg-zinc-700 flex-shrink-0" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded flex-1 max-w-xs" />
        <div className="ml-auto h-5 w-20 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
      </div>
      <div className="border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-2.5 pl-10 flex items-center gap-3">
            <div className="h-5 w-14 bg-zinc-100 dark:bg-zinc-800 rounded" />
            <div className="ml-auto h-7 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface StockListPanelProps {
  addTriggerRef?: { current: (() => void) | undefined };
}

export default function StockListPanel({ addTriggerRef }: StockListPanelProps = {}) {
  const [allProducts, setAllProducts] = useState<WarehouseProduct[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const [search, setSearch]               = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // ── Copy feedback ─────────────────────────────────────────────────────────────
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyTitle = useCallback((title: string, id: string) => {
    navigator.clipboard.writeText(title).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  }, []);

  // ── Add product modal ─────────────────────────────────────────────────────────
  const [addOpen, setAddOpen]           = useState(false);
  useEffect(() => { if (addTriggerRef) addTriggerRef.current = () => setAddOpen(true); }, [addTriggerRef]);
  const [addIsVariant, setAddIsVariant] = useState(false);
  const [addParent, setAddParent]       = useState('');
  const [addVariants, setAddVariants]   = useState<string[]>(['']);
  const [addTitle, setAddTitle]         = useState('');
  const [addStock, setAddStock]         = useState(0);
  const [addSaving, setAddSaving]       = useState(false);
  const [addError, setAddError]         = useState('');

  const addCanSubmit = addIsVariant
    ? addParent.trim().length > 0 && addVariants.some(v => v.trim().length > 0)
    : addTitle.trim().length > 0;

  const resetAdd = useCallback(() => {
    setAddOpen(false);
    setAddIsVariant(false);
    setAddParent('');
    setAddVariants(['']);
    setAddTitle('');
    setAddStock(0);
    setAddError('');
  }, []);

  // Pre-fill parent name and switch to variant mode for "add variation" on a group
  const openAddVariationForGroup = useCallback((parentTitle: string) => {
    setAddParent(parentTitle);
    setAddIsVariant(true);
    setAddVariants(['']);
    setAddStock(0);
    setAddError('');
    setAddOpen(true);
  }, []);

  const handleAddProduct = useCallback(async () => {
    if (!addCanSubmit) return;
    setAddSaving(true);
    setAddError('');
    try {
      if (addIsVariant) {
        const filled = addVariants.filter(v => v.trim().length > 0);
        const results = await Promise.all(
          filled.map(v => WarehouseService.createProduct(`${addParent.trim()} - ${v.trim()}`, addStock))
        );
        const created = results.map(r => r.data.data);
        setAllProducts(prev => [...prev, ...created].sort((a, b) => a.title.localeCompare(b.title)));
      } else {
        const res = await WarehouseService.createProduct(addTitle.trim(), addStock);
        setAllProducts(prev => [...prev, res.data.data].sort((a, b) => a.title.localeCompare(b.title)));
      }
      resetAdd();
    } catch {
      setAddError('บันทึกไม่สำเร็จ');
    } finally {
      setAddSaving(false);
    }
  }, [addCanSubmit, addIsVariant, addParent, addVariants, addTitle, addStock, resetAdd]);

  // ── Delete ────────────────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<WarehouseProduct | null>(null);
  const [deleting, setDeleting]           = useState(false);

  const handleDeleteProduct = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await WarehouseService.deleteProduct(confirmDelete.id);
      setAllProducts(prev => prev.filter(p => p.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch {
      /* silent — leave modal open so user can retry */
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete]);

  // ── Bulk stock update ─────────────────────────────────────────────────────────

  type BulkMode = 'add' | 'set';
  type BulkRow = {
    line: number;
    raw: string;
    name: string;
    qty: number;
    match: WarehouseProduct | null;
    score: number;
  };

  const [bulkOpen, setBulkOpen]         = useState(false);
  const [bulkText, setBulkText]         = useState('');
  const [bulkMode, setBulkMode]         = useState<BulkMode>('add');
  const [bulkRows, setBulkRows]         = useState<BulkRow[]>([]);
  const [bulkStep, setBulkStep]         = useState<'input' | 'preview'>('input');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkDone, setBulkDone]         = useState<{ ok: number; fail: number } | null>(null);

  const matchProduct = useCallback((name: string, products: WarehouseProduct[]): { match: WarehouseProduct | null; score: number } => {
    const q  = name.toLowerCase().trim();
    const qn = q.replace(/ - /g, ' ');
    let best: WarehouseProduct | null = null;
    let bestScore = 0;
    for (const p of products) {
      const t  = p.title.toLowerCase();
      const tn = t.replace(/ - /g, ' ');
      let score = 0;
      if (t === q || tn === qn) score = 100;
      else if (t.includes(q) || q.includes(t) || tn.includes(qn) || qn.includes(tn)) score = 70;
      else {
        const qt   = qn.split(/\s+/);
        const tt   = tn.split(/\s+/);
        const hits = qt.filter(w => tt.includes(w)).length;
        score = hits > 0 ? Math.round((hits / Math.max(qt.length, tt.length)) * 60) : 0;
      }
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return bestScore >= 30 ? { match: best, score: bestScore } : { match: null, score: 0 };
  }, []);

  const parseBulk = useCallback(() => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const pattern = /^\d+[.)]\s+(.+?)\s+จำนวน\s+(\d+)\s*$/;
    const rows: BulkRow[] = lines.map((raw, i) => {
      const m = raw.match(pattern);
      if (!m) return { line: i + 1, raw, name: raw, qty: 0, match: null, score: 0 };
      const { match, score } = matchProduct(m[1], allProducts);
      return { line: i + 1, raw, name: m[1], qty: parseInt(m[2]), match, score };
    });
    setBulkRows(rows);
    setBulkStep('preview');
  }, [bulkText, allProducts, matchProduct]);

  const applyBulk = useCallback(async () => {
    const toUpdate = bulkRows.filter(r => r.match && r.qty > 0);
    if (toUpdate.length === 0) return;
    setBulkApplying(true);
    let ok = 0; let fail = 0;
    for (const row of toUpdate) {
      const p = row.match!;
      const delta = bulkMode === 'set' ? row.qty - p.stock : row.qty;
      if (delta === 0) { ok++; continue; }
      try {
        const res = await WarehouseService.adjustStock(p.id, delta, 'BULK_UPDATE');
        setAllProducts(prev => prev.map(x => x.id === p.id ? res.data.data : x));
        ok++;
      } catch { fail++; }
    }
    setBulkApplying(false);
    setBulkDone({ ok, fail });
  }, [bulkRows, bulkMode]);

  const resetBulk = useCallback(() => {
    setBulkOpen(false);
    setBulkText('');
    setBulkRows([]);
    setBulkStep('input');
    setBulkDone(null);
  }, []);

  // ── Stock editing ─────────────────────────────────────────────────────────────
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editVal, setEditVal]       = useState('');
  const [savingIds, setSavingIds]   = useState<Set<number>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Record<number, string>>({});

  const [pendingOffsets, setPendingOffsets] = useState<Record<number, number>>({});
  const pendingDeltaRef = useRef<Record<number, number>>({});
  const debounceRef     = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await WarehouseService.getAllProducts();
      setAllProducts(res.data.data);
    } catch {
      setError('โหลดข้อมูลสต็อกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Grouping + filtering ──────────────────────────────────────────────────────

  const groups = useMemo(() => groupProducts(allProducts), [allProducts]);

  const filteredGroups = useMemo(() => {
    const q = appliedSearch.toLowerCase().trim();
    return groups
      .map(group => {
        const parentMatches = !q || group.parentTitle.toLowerCase().includes(q);
        if (group.isSimple) {
          if (!group.parent || !parentMatches) return null;
          return group;
        }
        const variations = q && !parentMatches
          ? group.variations.filter(v =>
              v.label.toLowerCase().includes(q) || v.product.title.toLowerCase().includes(q)
            )
          : group.variations;
        if (variations.length === 0) return null;
        return { ...group, variations } as ProductGroup;
      })
      .filter(Boolean) as ProductGroup[];
  }, [groups, appliedSearch]);

  // Use `search` (not deferred) so the display mode switches the moment the user types,
  // preventing the "shows 20 unfiltered items" flash during the deferred lag.
  const isSearching     = appliedSearch.trim().length > 0;
  const displayedGroups = isSearching ? filteredGroups : filteredGroups.slice(0, 20);
  const hiddenCount     = isSearching ? 0 : filteredGroups.length - 20;

  const isExpanded  = (key: string) => isSearching ? true : expandedKeys.has(key);
  const toggleGroup = (key: string) =>
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const expandAll   = () => setExpandedKeys(new Set(filteredGroups.map(g => g.key)));
  const collapseAll = () => setExpandedKeys(new Set());

  // ── Stock helpers ─────────────────────────────────────────────────────────────

  const displayStock = (p: WarehouseProduct) => p.stock + (pendingOffsets[p.id] ?? 0);

  const queueDelta = (p: WarehouseProduct, delta: number) => {
    const current = pendingDeltaRef.current[p.id] ?? 0;
    const next    = current + delta;
    if (p.stock + next < 0) return;

    pendingDeltaRef.current[p.id] = next;
    setPendingOffsets(prev => ({ ...prev, [p.id]: next }));

    clearTimeout(debounceRef.current[p.id]);
    debounceRef.current[p.id] = setTimeout(async () => {
      const totalDelta = pendingDeltaRef.current[p.id] ?? 0;
      delete pendingDeltaRef.current[p.id];
      if (totalDelta === 0) return;

      setSavingIds(prev => new Set(prev).add(p.id));
      try {
        const res     = await WarehouseService.adjustStock(p.id, totalDelta, 'MANUAL_ADJUST');
        const updated = res.data.data as WarehouseProduct;
        setAllProducts(prev => prev.map(x => x.id === p.id ? updated : x));
        setPendingOffsets(prev => { const n = { ...prev }; delete n[p.id]; return n; });
      } catch {
        setSaveErrors(prev => ({ ...prev, [p.id]: 'บันทึกไม่สำเร็จ' }));
        setPendingOffsets(prev => { const n = { ...prev }; delete n[p.id]; return n; });
      } finally {
        setSavingIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
      }
    }, 800);
  };

  const startEdit = (p: WarehouseProduct) => {
    clearTimeout(debounceRef.current[p.id]);
    delete debounceRef.current[p.id];
    delete pendingDeltaRef.current[p.id];
    setPendingOffsets(prev => { const n = { ...prev }; delete n[p.id]; return n; });
    setEditingId(p.id);
    setEditVal(String(p.stock));
    setSaveErrors(prev => { const n = { ...prev }; delete n[p.id]; return n; });
  };

  const commitEdit = async (p: WarehouseProduct) => {
    const newStock = parseInt(editVal, 10);
    setEditingId(null);
    if (isNaN(newStock) || newStock === p.stock) return;
    applyDelta(p, newStock - p.stock);
  };

  const applyDelta = async (p: WarehouseProduct, delta: number) => {
    if (delta === 0) return;
    setSavingIds(prev => new Set(prev).add(p.id));
    try {
      const res     = await WarehouseService.adjustStock(p.id, delta, 'MANUAL_ADJUST');
      const updated = res.data.data as WarehouseProduct;
      setAllProducts(prev => prev.map(x => x.id === p.id ? updated : x));
    } catch {
      setSaveErrors(prev => ({ ...prev, [p.id]: 'บันทึกไม่สำเร็จ' }));
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
    }
  };

  // ── Warning panel ─────────────────────────────────────────────────────────────

  const [warnOpen, setWarnOpen]         = useState(true);
  const [warnSearch, setWarnSearch]     = useState('');
  const [expandedWarn, setExpandedWarn] = useState<Set<string>>(new Set());

  const toggleWarnGroup = (key: string) =>
    setExpandedWarn(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const variationGroupCount = groups.filter(g => !g.isSimple).length;
  const outOfStock = useMemo(() => allProducts.filter(p => p.stock === 0), [allProducts]);
  const lowStock10 = useMemo(() => allProducts.filter(p => p.stock > 0 && p.stock < 10), [allProducts]);

  const oosGroups = useMemo(() => {
    const q = warnSearch.toLowerCase().trim();
    return groupForWarning(outOfStock).filter(g =>
      !q || g.parentTitle.toLowerCase().includes(q) || g.items.some(i => i.label.toLowerCase().includes(q))
    );
  }, [outOfStock, warnSearch]);

  const lowGroups = useMemo(() => {
    const q = warnSearch.toLowerCase().trim();
    return groupForWarning([...lowStock10].sort((a, b) => a.stock - b.stock)).filter(g =>
      !q || g.parentTitle.toLowerCase().includes(q) || g.items.some(i => i.label.toLowerCase().includes(q))
    );
  }, [lowStock10, warnSearch]);

  // ── StockCell ─────────────────────────────────────────────────────────────────

  function StockCell({ p }: { p: WarehouseProduct }) {
    const qty      = displayStock(p);
    const c        = stockColor(qty);
    const isEdit   = editingId === p.id;
    const isSaving = savingIds.has(p.id);
    const hasPending = (pendingOffsets[p.id] ?? 0) !== 0;

    if (isEdit) {
      return (
        <input
          type="number"
          min="0"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={() => commitEdit(p)}
          onKeyDown={e => {
            if (e.key === 'Enter')  commitEdit(p);
            if (e.key === 'Escape') setEditingId(null);
          }}
          autoFocus
          className="w-20 text-right text-sm rounded-lg border-2 border-blue-400 px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none tabular-nums"
        />
      );
    }

    return (
      <div className={`inline-flex items-center rounded-lg border overflow-hidden text-xs transition-colors ${
        hasPending ? 'border-blue-300 dark:border-blue-700' : 'border-zinc-200 dark:border-zinc-700'
      }`}>
        <button
          onClick={() => queueDelta(p, -1)}
          disabled={isSaving || qty <= 0}
          className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30">
          <Minus size={10} />
        </button>
        <button
          onClick={() => startEdit(p)}
          disabled={isSaving}
          title="คลิกเพื่อแก้ไข"
          className={`px-3 h-8 sm:h-7 tabular-nums border-x border-zinc-200 dark:border-zinc-700 transition-colors min-w-[2.75rem] text-center disabled:opacity-50 ${c.text} ${
            hasPending ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}>
          {isSaving
            ? <Loader2 size={11} className="animate-spin" />
            : qty.toLocaleString()}
        </button>
        <button
          onClick={() => queueDelta(p, +1)}
          disabled={isSaving}
          className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30">
          <Plus size={10} />
        </button>
      </div>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── Left: Notification panel ── */}
        {(outOfStock.length > 0 || lowStock10.length > 0) && !loading && (
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">

            <button
              onClick={() => setWarnOpen(v => !v)}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left">
              <Bell size={13} className="text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex-1">การแจ้งเตือนสต็อก</span>
              {outOfStock.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700 text-[10px]">
                  <XCircle size={9} /> {outOfStock.length}
                </span>
              )}
              {lowStock10.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 text-[10px]">
                  <TrendingDown size={9} /> {lowStock10.length}
                </span>
              )}
              <ChevronDown size={13} className={`text-zinc-400 transition-transform duration-200 flex-shrink-0 ${warnOpen ? '' : '-rotate-90'}`} />
            </button>

            {warnOpen && (
              <div>
                <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={warnSearch}
                      onChange={e => setWarnSearch(e.target.value)}
                      placeholder="ค้นหาสินค้า..."
                      className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {/* Scrollable on mobile, natural height on lg */}
                <div className="max-h-64 lg:max-h-none overflow-y-auto">

                  {/* Out of stock */}
                  {oosGroups.length > 0 && (
                    <div className="border-t border-red-100 dark:border-red-900/30">
                      <div className="flex items-center gap-2 px-4 py-2 bg-red-50/60 dark:bg-red-900/10">
                        <XCircle size={12} className="text-red-500 flex-shrink-0" />
                        <span className="text-[11px] text-red-700 dark:text-red-400 flex-1">
                          หมดสต็อก — {outOfStock.length} รายการ
                        </span>
                      </div>
                      <div className="divide-y divide-red-50 dark:divide-red-900/20 bg-white dark:bg-zinc-900">
                        {oosGroups.map(g => {
                          const isOpen = expandedWarn.has('oos:' + g.parentTitle);
                          const q = warnSearch.toLowerCase().trim();
                          const visibleItems = q
                            ? g.items.filter(i => i.label.toLowerCase().includes(q) || g.parentTitle.toLowerCase().includes(q))
                            : g.items;
                          return (
                            <div key={g.parentTitle}>
                              <button
                                onClick={() => toggleWarnGroup('oos:' + g.parentTitle)}
                                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50/40 dark:hover:bg-red-900/10 transition-colors text-left">
                                <ChevronDown size={12} className={`text-red-400 flex-shrink-0 transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`} />
                                <span className="flex-1 text-xs text-zinc-700 dark:text-zinc-300 truncate min-w-0">{g.parentTitle}</span>
                                {g.items.length > 1 && (
                                  <span className="flex-shrink-0 text-[10px] text-red-400 dark:text-red-500">{g.items.length} var</span>
                                )}
                              </button>
                              {isOpen && (
                                <div className="px-4 pb-2.5 pt-1 pl-9 flex flex-wrap gap-1.5">
                                  {visibleItems.map(({ product: p, label }) => (
                                    <span
                                      key={p.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-[11px]">
                                      {label}
                                      {p.generated && (
                                        <span className="px-1 py-px rounded text-[9px] bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700">
                                          Auto
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Low stock < 10 */}
                  {lowGroups.length > 0 && (
                    <div className="border-t border-amber-100 dark:border-amber-900/30">
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50/60 dark:bg-amber-900/10">
                        <TrendingDown size={12} className="text-amber-500 flex-shrink-0" />
                        <span className="text-[11px] text-amber-700 dark:text-amber-400 flex-1">
                          ใกล้หมด (&lt;10) — {lowStock10.length} รายการ
                        </span>
                      </div>
                      <div className="divide-y divide-amber-50 dark:divide-amber-900/20 bg-white dark:bg-zinc-900">
                        {lowGroups.map(g => {
                          const isOpen = expandedWarn.has('low:' + g.parentTitle);
                          const q = warnSearch.toLowerCase().trim();
                          const visibleItems = q
                            ? g.items.filter(i => i.label.toLowerCase().includes(q) || g.parentTitle.toLowerCase().includes(q))
                            : g.items;
                          return (
                            <div key={g.parentTitle}>
                              <button
                                onClick={() => toggleWarnGroup('low:' + g.parentTitle)}
                                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors text-left">
                                <ChevronDown size={12} className={`text-amber-400 flex-shrink-0 transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`} />
                                <span className="flex-1 text-xs text-zinc-700 dark:text-zinc-300 truncate min-w-0">{g.parentTitle}</span>
                                <span className="flex-shrink-0 text-[10px] text-amber-600 dark:text-amber-400 tabular-nums">
                                  ต่ำสุด {Math.min(...g.items.map(i => i.product.stock))}
                                </span>
                              </button>
                              {isOpen && (
                                <div className="px-4 pb-2.5 pt-1 pl-9 flex flex-wrap gap-1.5">
                                  {visibleItems.sort((a, b) => a.product.stock - b.product.stock).map(({ product: p, label }) => (
                                    <span
                                      key={p.id}
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-[11px]">
                                      {label}
                                      <span className="px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 text-[10px] tabular-nums">{p.stock}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {oosGroups.length === 0 && lowGroups.length === 0 && warnSearch && (
                    <div className="px-4 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-900">
                      ไม่พบสินค้าที่ค้นหา
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Right: Stock list ── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-0" style={{ minWidth: '160px' }}>
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setAppliedSearch(search); } }}
                placeholder="ค้นหาชื่อสินค้า หรือ variation... (Enter เพื่อค้นหา)"
                className="w-full pl-8 pr-3 py-2.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap">
              <PlusCircle size={12} />
              <span>เพิ่มสินค้า</span>
            </button>
            <button
              onClick={() => { setBulkOpen(true); setBulkStep('input'); setBulkDone(null); }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap">
              <ClipboardList size={12} />
              <span className="hidden xs:inline">นำเข้าสต็อก</span>
              <span className="xs:hidden">นำเข้า</span>
            </button>
            <button
              onClick={() => { setSearch(''); setAppliedSearch(''); loadAll(); }}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>

          {/* Stats + expand controls */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <Package2 size={13} />
              <span className="text-zinc-700 dark:text-zinc-300">{allProducts.length.toLocaleString()}</span>
              <span>รายการ</span>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <Layers size={13} />
              <span className="text-zinc-700 dark:text-zinc-300">{variationGroupCount}</span>
              <span>กลุ่ม</span>
            </div>
            {!search.trim() && (
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={expandAll}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-[11px]">
                  ขยายทั้งหมด
                </button>
                <button
                  onClick={collapseAll}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-[11px]">
                  ย่อทั้งหมด
                </button>
              </div>
            )}
          </div>

          {/* Skeleton */}
          {loading && allProducts.length === 0 && (
            <div className="space-y-2">
              {[4, 6, 3, 8, 2].map((r, i) => <SkeletonGroup key={i} rows={r} />)}
            </div>
          )}

          {/* Product groups */}
          <div className="space-y-2">
            {displayedGroups.map(group => {
              const expanded = isExpanded(group.key);

              if (group.isSimple) {
                const p = group.parent!;
                const c = stockColor(displayStock(p));
                const copyKey = `simple-${p.id}`;
                return (
                  <div
                    key={group.key}
                    className={`bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-2 px-3 sm:px-4 py-3 ${
                      p.stock <= 0 ? 'border-l-4 border-l-red-400' : p.stock < 10 ? 'border-l-4 border-l-orange-400' : ''
                    }`}>
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full ${c.dot}`} />
                    {/* Title + copy */}
                    <div className="flex-1 min-w-0 flex items-center gap-1 group/copy">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate" title={p.title}>{p.title}</span>
                      <button
                        onClick={() => copyTitle(p.title, copyKey)}
                        title="คัดลอกชื่อสินค้า"
                        className="flex-shrink-0 p-1 rounded text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 opacity-0 group-hover/copy:opacity-100 focus:opacity-100 transition-opacity">
                        {copiedId === copyKey ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                      </button>
                    </div>
                    {saveErrors[p.id] && (
                      <span className="text-[10px] text-red-500 flex items-center gap-1 flex-shrink-0">
                        <AlertCircle size={9} /><span className="hidden sm:inline">{saveErrors[p.id]}</span>
                      </span>
                    )}
                    <StockCell p={p} />
                    <button
                      onClick={() => setConfirmDelete(p)}
                      className="flex-shrink-0 p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              }

              const allInGroup = group.variations.map(v => v.product);
              const lowCount   = allInGroup.filter(p => p.stock < 10).length;
              const copyKey    = `group-${group.key}`;

              return (
                <div key={group.key} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-1">
                    {/* Clickable area for expand/collapse */}
                    <button
                      onClick={() => !search.trim() && toggleGroup(group.key)}
                      className={`flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 text-left transition-colors ${
                        !search.trim() ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer' : 'cursor-default'
                      }`}>
                      {!search.trim() && (
                        <ChevronDown
                          size={14}
                          className={`flex-shrink-0 text-zinc-400 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
                        />
                      )}
                      {/* Title + copy */}
                      <div className="flex-1 min-w-0 flex items-center gap-1 group/gcopy">
                        <span className="text-sm text-zinc-700 dark:text-zinc-200 truncate" title={group.parentTitle}>
                          {group.parentTitle}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); copyTitle(group.parentTitle, copyKey); }}
                          title="คัดลอกชื่อสินค้า"
                          className="flex-shrink-0 p-1 rounded text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 opacity-0 group-hover/gcopy:opacity-100 focus:opacity-100 transition-opacity">
                          {copiedId === copyKey ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {lowCount > 0 && (
                          <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 text-[10px] text-orange-600 dark:text-orange-400">
                            <TrendingDown size={9} />
                            ต่ำ {lowCount}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-[10px] text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {group.variations.length} var
                        </span>
                      </div>
                    </button>
                    {/* Add variation button — outside the expand toggle so it doesn't collapse */}
                    <button
                      onClick={() => openAddVariationForGroup(group.parentTitle)}
                      title="เพิ่ม variation"
                      className="flex-shrink-0 mr-2 p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>

                  {expanded && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800">
                      {/* Desktop table */}
                      <div className="hidden sm:block">
                        <table className="w-full text-xs">
                          <thead className="bg-zinc-50/70 dark:bg-zinc-800/50">
                            <tr>
                              <th className="text-left px-4 py-2 pl-10 text-zinc-400 uppercase tracking-wider font-normal">Variation</th>
                              <th className="text-right px-4 py-2 text-zinc-400 uppercase tracking-wider font-normal w-44">สต็อก</th>
                              <th className="w-10" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/40">
                            {group.variations.map(({ product: p, label }) => (
                              <tr
                                key={p.id}
                                className={`transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 ${
                                  p.stock <= 0 ? 'bg-red-50/30 dark:bg-red-900/5' :
                                  p.stock < 10 ? 'bg-orange-50/20 dark:bg-orange-900/5' : ''
                                }`}>
                                <td className="px-4 py-2.5 pl-10">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] ${variationChipClass(p.stock)}`}>
                                      {label}
                                    </span>
                                    {p.generated && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700">
                                        Auto
                                      </span>
                                    )}
                                    {saveErrors[p.id] && (
                                      <span className="text-[10px] text-red-500 flex items-center gap-1">
                                        <AlertCircle size={9} />{saveErrors[p.id]}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <div className="flex justify-end">
                                    <StockCell p={p} />
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <button
                                    onClick={() => setConfirmDelete(p)}
                                    className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile list */}
                      <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                        {group.variations.map(({ product: p, label }) => (
                          <div
                            key={p.id}
                            className={`px-3 py-3 flex items-center gap-2 ${
                              p.stock <= 0 ? 'bg-red-50/20 dark:bg-red-900/5' :
                              p.stock < 10 ? 'bg-orange-50/20 dark:bg-orange-900/5' : ''
                            }`}>
                            <span className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-md ${variationChipClass(p.stock)}`}>
                              {label}
                            </span>
                            {p.generated && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700">
                                Auto
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                              {saveErrors[p.id] && <AlertCircle size={10} className="text-red-500" />}
                              <StockCell p={p} />
                              <button
                                onClick={() => setConfirmDelete(p)}
                                className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {hiddenCount > 0 && (
              <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 py-3">
                แสดง 20 จาก {filteredGroups.length} กลุ่มสินค้า · ค้นหาเพื่อกรองผลลัพธ์
              </p>
            )}

            {displayedGroups.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-400 dark:text-zinc-500">
                <Package2 size={32} strokeWidth={1.5} />
                <p className="text-sm">{search ? 'ไม่พบสินค้าที่ค้นหา' : 'ไม่พบสินค้า'}</p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center px-2">
            คลิกตัวเลขสต็อกเพื่อแก้ไข · Enter บันทึก · Esc ยกเลิก · [−][+] บันทึกอัตโนมัติหลัง 0.8 วินาที
          </p>
        </div>
      </div>

      {/* ── Delete confirm modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setConfirmDelete(null)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full sm:max-w-sm mx-0 sm:mx-4">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 size={18} className="text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">ลบสินค้า</h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    ต้องการลบ <span className="font-semibold text-zinc-700 dark:text-zinc-300">&ldquo;{confirmDelete.title}&rdquo;</span> ออกจากระบบหรือไม่?
                    <br />การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-6 sm:pb-5">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 py-3 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50">
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="flex-1 py-3 sm:py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                ลบสินค้า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add product modal ── */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={resetAdd} />

            {/* Panel */}
            <motion.div
              className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full sm:max-w-md mx-0 sm:mx-4 max-h-[92vh] flex flex-col"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {addIsVariant && addParent.trim() ? `เพิ่ม variation — ${addParent}` : 'เพิ่มสินค้า'}
                </h3>
                <button onClick={resetAdd} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
                {/* Variation toggle */}
                <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg w-fit">
                  <button
                    onClick={() => setAddIsVariant(false)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${!addIsVariant ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}>
                    สินค้าเดี่ยว
                  </button>
                  <button
                    onClick={() => setAddIsVariant(true)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${addIsVariant ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}>
                    มีหลายตัวเลือก
                  </button>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {addIsVariant ? (
                    <motion.div
                      key="variant"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">ชื่อหลัก (parent)</label>
                        <input
                          autoFocus
                          type="text"
                          value={addParent}
                          onChange={e => setAddParent(e.target.value)}
                          placeholder="เช่น Relay Module, Resistor Kit"
                          className="w-full px-3 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Variations</label>
                        <div className="space-y-2">
                          {addVariants.map((v, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={v}
                                onChange={e => setAddVariants(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    if (i === addVariants.length - 1) setAddVariants(prev => [...prev, '']);
                                    else handleAddProduct();
                                  }
                                }}
                                placeholder={['5V DC SPDT', '12V DC DPDT', '10kΩ 1/4W', '100µF 16V', 'NPN BC547', 'PNP BC557', '1N4007', 'IRF540N'][i % 8]}
                                className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                              />
                              {addVariants.length > 1 && (
                                <button
                                  onClick={() => setAddVariants(prev => prev.filter((_, j) => j !== i))}
                                  className="flex-shrink-0 p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => setAddVariants(prev => [...prev, ''])}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                            <Plus size={11} /> เพิ่ม variation
                          </button>
                        </div>
                      </div>
                      {addParent.trim() && addVariants.some(v => v.trim()) && (
                        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-3 py-2 space-y-0.5">
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">จะบันทึกเป็น</p>
                          {addVariants.filter(v => v.trim()).map((v, i) => (
                            <p key={i} className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300 truncate">
                              {addParent.trim()} - {v.trim()}
                            </p>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="simple"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">ชื่อสินค้า</label>
                      <input
                        autoFocus
                        type="text"
                        value={addTitle}
                        onChange={e => setAddTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddProduct()}
                        placeholder="เช่น Arduino Nano V3, ESP32 Dev Board"
                        className="w-full px-3 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">สต็อกเริ่มต้น</label>
                  <input
                    type="number"
                    min={0}
                    value={addStock}
                    onChange={e => setAddStock(Math.max(0, parseInt(e.target.value) || 0))}
                    onKeyDown={e => e.key === 'Enter' && handleAddProduct()}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  />
                </div>

                {addError && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle size={11} /> {addError}
                  </p>
                )}
              </div>

              <div className="flex gap-2 px-5 pb-6 sm:pb-5 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex-shrink-0">
                <button
                  onClick={resetAdd}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  ยกเลิก
                </button>
                <button
                  onClick={handleAddProduct}
                  disabled={!addCanSubmit || addSaving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                  {addSaving ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                  {addIsVariant && addVariants.filter(v => v.trim()).length > 1
                    ? `บันทึก ${addVariants.filter(v => v.trim()).length} รายการ`
                    : 'บันทึก'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bulk stock update modal ── */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !bulkApplying && resetBulk()} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full sm:max-w-lg mx-0 sm:mx-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-zinc-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">นำเข้าสต็อก</h3>
              </div>
              <button onClick={resetBulk} disabled={bulkApplying} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-50">
                <X size={16} />
              </button>
            </div>

            {bulkDone ? (
              <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
                <CheckCircle2 size={40} className="text-green-500" />
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">อัปเดตเสร็จสิ้น</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  สำเร็จ {bulkDone.ok} รายการ{bulkDone.fail > 0 && <span className="text-red-500"> · ล้มเหลว {bulkDone.fail} รายการ</span>}
                </p>
                <button
                  onClick={resetBulk}
                  className="mt-2 px-5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold">
                  ปิด
                </button>
              </div>
            ) : bulkStep === 'input' ? (
              <>
                <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
                  <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg w-fit">
                    <button
                      onClick={() => setBulkMode('add')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${bulkMode === 'add' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}>
                      เพิ่มสต็อก
                    </button>
                    <button
                      onClick={() => setBulkMode('set')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${bulkMode === 'set' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}>
                      ตั้งค่าสต็อก
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    วางรายการในรูปแบบ: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">1. ชื่อสินค้า จำนวน 10</code>
                  </p>
                  <textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={"1. Relay Module 5V จำนวน 20\n2. Arduino Nano V3 จำนวน 15\n3. ESP32 Dev Board จำนวน 8"}
                    rows={8}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono resize-none"
                  />
                </div>
                <div className="flex gap-2 px-5 pb-6 sm:pb-5 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex-shrink-0">
                  <button onClick={resetBulk} className="flex-1 py-3 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    ยกเลิก
                  </button>
                  <button
                    onClick={parseBulk}
                    disabled={!bulkText.trim()}
                    className="flex-1 py-3 sm:py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                    <ChevronRight size={14} />
                    ตรวจสอบ
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="px-5 py-3 flex-shrink-0 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    โหมด: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{bulkMode === 'add' ? 'เพิ่มสต็อก' : 'ตั้งค่าสต็อก'}</span>
                    {' · '}จับคู่ได้ {bulkRows.filter(r => r.match).length}/{bulkRows.length} รายการ
                  </p>
                </div>
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/60 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 text-zinc-400 font-normal">รายการ</th>
                        <th className="text-center px-3 py-2 text-zinc-400 font-normal w-14 sm:w-16">จำนวน</th>
                        <th className="text-left px-3 py-2 text-zinc-400 font-normal hidden sm:table-cell">จับคู่กับ</th>
                        <th className="text-center px-3 py-2 text-zinc-400 font-normal w-12 sm:w-14">คะแนน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/40">
                      {bulkRows.map(row => (
                        <tr key={row.line} className={row.match ? '' : 'bg-red-50/30 dark:bg-red-900/10'}>
                          <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300 max-w-[120px] sm:max-w-[160px] truncate" title={row.name}>{row.name}</td>
                          <td className="px-3 py-2 text-center tabular-nums text-zinc-600 dark:text-zinc-300">{row.qty}</td>
                          <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 max-w-[160px] truncate hidden sm:table-cell" title={row.match?.title ?? '-'}>
                            {row.match ? row.match.title : <span className="text-red-400">ไม่พบ</span>}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.match
                              ? <span className={`tabular-nums text-[11px] font-medium ${row.score >= 70 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>{row.score}</span>
                              : <span className="text-red-400">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2 px-5 py-4 flex-shrink-0 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => setBulkStep('input')}
                    disabled={bulkApplying}
                    className="flex-1 py-3 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50">
                    แก้ไข
                  </button>
                  <button
                    onClick={applyBulk}
                    disabled={bulkApplying || bulkRows.filter(r => r.match && r.qty > 0).length === 0}
                    className="flex-1 py-3 sm:py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                    {bulkApplying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    อัปเดต {bulkRows.filter(r => r.match && r.qty > 0).length} รายการ
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
