

import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Package, CheckCircle2, AlertCircle, RotateCcw, ChevronDown } from 'lucide-react';
import WarehouseService, { type ImportHistoryEntry } from '../service/WarehouseService';

// Keep saveImportSession exported so OrderImportPage can call it without changes
export type { ImportHistoryEntry as ImportSession };

export async function saveImportSession(s: {
  platform: string;
  tried: number;
  newCount: number;
  skippedCount: number;
}): Promise<void> {
  try {
    await WarehouseService.saveImportHistory(s);
  } catch {
    // silent — import already succeeded
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLATFORM_DOT: Record<string, string> = {
  shopee: 'bg-orange-500',
  lazada: 'bg-purple-500',
  manual: 'bg-zinc-400',
};

const PLATFORM_TEXT: Record<string, string> = {
  shopee: 'text-orange-600 dark:text-orange-400',
  lazada: 'text-purple-600 dark:text-purple-400',
  manual: 'text-zinc-500 dark:text-zinc-400',
};

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
  };
}

function borderColor(entry: ImportHistoryEntry): string {
  if (entry.newCount > 0 && entry.skippedCount === 0) return 'border-l-green-500 dark:border-l-green-500';
  if (entry.newCount > 0 && entry.skippedCount > 0) return 'border-l-blue-500 dark:border-l-blue-500';
  return 'border-l-amber-500 dark:border-l-amber-500';
}

// ── Component ─────────────────────────────────────────────────────────────────

const INITIAL_LIMIT = 5;

export default function ImportHistoryPanel() {
  const [entries, setEntries] = useState<ImportHistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    WarehouseService.getImportHistory()
      .then(res => setEntries(res.data.data))
      .catch(() => setEntries([]))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-14 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-400 dark:text-zinc-500">
        <FileSpreadsheet size={36} strokeWidth={1.5} />
        <p className="text-sm font-medium">ยังไม่มีประวัติการนำเข้า</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">ประวัติจะปรากฏหลังจากกด &ldquo;ส่งไปคลัง&rdquo; ครั้งแรก</p>
      </div>
    );
  }

  const visible = expanded ? entries : entries.slice(0, INITIAL_LIMIT);
  const hidden  = entries.length - INITIAL_LIMIT;

  return (
    <div className="space-y-2">
      {visible.map(entry => {
        const { date, time } = formatDateTime(entry.createdAt);
        const platforms = entry.platform.split(',').map(p => p.trim());
        return (
          <div
            key={entry.id}
            className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-l-4 ${borderColor(entry)} shadow-sm`}>

            <FileSpreadsheet size={16} className="text-zinc-400 flex-shrink-0 hidden sm:block" />

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{date}</span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">{time}</span>
            </div>

            <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
              <Package size={12} />
              {entry.tried.toLocaleString()} รายการ
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              {entry.newCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                  <CheckCircle2 size={10} />
                  ใหม่ {entry.newCount}
                </span>
              )}
              {entry.skippedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <RotateCcw size={10} />
                  ซ้ำ {entry.skippedCount}
                </span>
              )}
              {entry.newCount === 0 && entry.skippedCount === 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  <AlertCircle size={10} />
                  ไม่มีรายการ
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {platforms.map(p => {
                const key = p.toLowerCase();
                const dot  = PLATFORM_DOT[key]  ?? 'bg-zinc-400';
                const text = PLATFORM_TEXT[key] ?? 'text-zinc-500 dark:text-zinc-400';
                return (
                  <span key={p} className={`flex items-center gap-1 text-xs font-medium ${text}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    {p}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* See more / collapse */}
      {entries.length > INITIAL_LIMIT && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <ChevronDown size={13} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'ย่อ' : `ดูเพิ่มเติม ${hidden} รายการ`}
        </button>
      )}
    </div>
  );
}
