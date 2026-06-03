

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scan, Settings2, CheckCircle2, AlertCircle, X,
  Package, Clock, ChevronDown, ChevronUp, Loader2,
  Volume2, VolumeX,
} from 'lucide-react';
import WarehouseService, { type BackendOrder } from '../service/WarehouseService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScannerSettings {
  suffix: 'enter' | 'tab' | 'none';
  autoSubmit: boolean;
  scanDelay: number;
  soundEnabled: boolean;
}

type ScanStatus = 'ORDER_NUMBER' | 'TRACKING_NUMBER' | 'NOT_FOUND' | 'ERROR';

interface ScanEntry {
  id: number;
  code: string;
  status: ScanStatus;
  order: BackendOrder | null;
  timestamp: Date;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: ScannerSettings = {
  suffix: 'enter',
  autoSubmit: true,
  scanDelay: 150,
  soundEnabled: true,
};

const STORAGE_KEY = 'pe-scanner-settings';

function loadSettings(): ScannerSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// ── Audio ─────────────────────────────────────────────────────────────────────

function beep(type: 'success' | 'error') {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'success') {
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.value = 200;
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
    osc.onended = () => ctx.close();
  } catch {
    // Web Audio not available
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(s: ScanStatus) {
  if (s === 'ORDER_NUMBER')   return 'เลขคำสั่งซื้อ';
  if (s === 'TRACKING_NUMBER') return 'เลขพัสดุ';
  if (s === 'NOT_FOUND')       return 'ไม่พบ';
  return 'ผิดพลาด';
}

function statusColors(s: ScanStatus) {
  if (s === 'ORDER_NUMBER' || s === 'TRACKING_NUMBER') {
    return {
      badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700',
      icon:  <CheckCircle2 size={11} />,
    };
  }
  return {
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700',
    icon:  <AlertCircle size={11} />,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BarcodeScannerPanel() {
  const [settings, setSettings]       = useState<ScannerSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [inputValue, setInputValue]   = useState('');
  const [scanning, setScanning]       = useState(false);
  const [flashState, setFlashState]   = useState<'idle' | 'success' | 'error'>('idle');
  const [history, setHistory]         = useState<ScanEntry[]>([]);
  const [nextId, setNextId]           = useState(1);
  const [showHistory, setShowHistory] = useState(true);

  const inputRef   = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef      = useRef(1);

  // Keep idRef in sync
  useEffect(() => { idRef.current = nextId; }, [nextId]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Auto-focus on mount and whenever panel becomes visible
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Re-focus after flash clears
  useEffect(() => {
    if (flashState === 'idle') {
      inputRef.current?.focus();
    }
  }, [flashState]);

  const flash = useCallback((type: 'success' | 'error') => {
    setFlashState(type);
    setTimeout(() => setFlashState('idle'), 1500);
  }, []);

  // ── Core submit ─────────────────────────────────────────────────────────────
  const submitScan = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code) return;

    setInputValue('');
    setScanning(true);

    try {
      const res = await WarehouseService.scanBarcode(code);
      const { type, order } = res.data.data;
      const entry: ScanEntry = {
        id: idRef.current,
        code,
        status: type as ScanStatus,
        order,
        timestamp: new Date(),
      };
      setHistory(prev => [entry, ...prev].slice(0, 30));
      setNextId(prev => prev + 1);
      if (settings.soundEnabled) beep('success');
      flash('success');
    } catch (err: unknown) {
      const status: ScanStatus =
        (err as { response?: { status?: number } })?.response?.status === 404
          ? 'NOT_FOUND'
          : 'ERROR';
      const entry: ScanEntry = {
        id: idRef.current,
        code,
        status,
        order: null,
        timestamp: new Date(),
      };
      setHistory(prev => [entry, ...prev].slice(0, 30));
      setNextId(prev => prev + 1);
      if (settings.soundEnabled) beep('error');
      flash('error');
    } finally {
      setScanning(false);
    }
  }, [settings.soundEnabled, flash]);

  // ── Input handlers ──────────────────────────────────────────────────────────
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (settings.suffix === 'none' && settings.autoSubmit) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (val.trim()) {
        timeoutRef.current = setTimeout(() => submitScan(val), settings.scanDelay);
      }
    }
  }, [settings, submitScan]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (settings.suffix === 'enter' && e.key === 'Enter') {
      e.preventDefault();
      if (settings.autoSubmit || inputValue.trim()) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        submitScan(inputValue);
      }
    } else if (settings.suffix === 'tab' && e.key === 'Tab') {
      e.preventDefault();
      if (settings.autoSubmit || inputValue.trim()) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        submitScan(inputValue);
      }
    }
  }, [settings, inputValue, submitScan]);

  const handleManualSubmit = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    submitScan(inputValue);
  }, [inputValue, submitScan]);

  // ── Flash border classes ────────────────────────────────────────────────────
  const inputBorder =
    flashState === 'success' ? 'border-green-500 dark:border-green-400 ring-2 ring-green-400/30 bg-green-50 dark:bg-green-900/10' :
    flashState === 'error'   ? 'border-red-500 dark:border-red-400 ring-2 ring-red-400/30 bg-red-50 dark:bg-red-900/10' :
    'border-zinc-300 dark:border-zinc-600 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 bg-white dark:bg-zinc-900';

  const lastEntry = history[0] ?? null;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Scan size={15} className="text-blue-500" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">สแกนบาร์โค้ด</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setSettings(s => ({ ...s, soundEnabled: !s.soundEnabled }))}
            title={settings.soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง'}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            {settings.soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <button
            onClick={() => setShowSettings(v => !v)}
            title="ตั้งค่าสแกนเนอร์"
            className={`p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${showSettings ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300' : ''}`}>
            <Settings2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Settings panel ───────────────────────────────────────────────────── */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Suffix */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                ตัวจบ (Scanner Suffix)
              </label>
              <div className="flex gap-1">
                {(['enter', 'tab', 'none'] as const).map(v => (
                  <button key={v}
                    onClick={() => setSettings(s => ({ ...s, suffix: v }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      settings.suffix === v
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}>
                    {v === 'enter' ? 'Enter' : v === 'tab' ? 'Tab' : 'Timeout'}
                  </button>
                ))}
              </div>
            </div>

            {/* Delay (only relevant for none suffix) */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                หน่วงเวลา (Timeout ms)
              </label>
              <div className="flex gap-1">
                {[100, 150, 200, 300].map(v => (
                  <button key={v}
                    onClick={() => setSettings(s => ({ ...s, scanDelay: v }))}
                    disabled={settings.suffix !== 'none'}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-30 ${
                      settings.scanDelay === v && settings.suffix === 'none'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:hover:bg-transparent'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-submit */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Auto Submit
              </label>
              <button
                onClick={() => setSettings(s => ({ ...s, autoSubmit: !s.autoSubmit }))}
                className={`w-full py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  settings.autoSubmit
                    ? 'bg-green-500 text-white border-green-500'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}>
                {settings.autoSubmit ? 'เปิด' : 'ปิด'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">

        {/* ── Scanner input ──────────────────────────────────────────────────── */}
        <div className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 transition-all duration-150 ${inputBorder}`}>
          <Scan size={18} className={`flex-shrink-0 ${
            flashState === 'success' ? 'text-green-500' :
            flashState === 'error'   ? 'text-red-500' :
            'text-zinc-400'
          }`} />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="พร้อมสแกน — วางเคอร์เซอร์ที่นี่แล้วสแกน…"
            disabled={scanning}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-sm font-mono text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none disabled:opacity-50"
          />
          {scanning && <Loader2 size={16} className="text-blue-500 animate-spin flex-shrink-0" />}
          {!scanning && inputValue && (
            <button
              onClick={handleManualSubmit}
              className="flex-shrink-0 px-3 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors">
              ค้นหา
            </button>
          )}
          {!scanning && !inputValue && flashState === 'success' && (
            <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
          )}
          {!scanning && !inputValue && flashState === 'error' && (
            <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          )}
        </div>

        <p className="text-[11px] text-zinc-400 -mt-2">
          {settings.suffix === 'enter' && 'สแกนเนอร์ส่ง Enter เพื่อส่ง · '}
          {settings.suffix === 'tab'   && 'สแกนเนอร์ส่ง Tab เพื่อส่ง · '}
          {settings.suffix === 'none'  && `ส่งอัตโนมัติหลัง ${settings.scanDelay}ms · `}
          คลิกที่ช่องป้อนแล้วสแกน
        </p>

        {/* ── Last scan result ───────────────────────────────────────────────── */}
        {lastEntry && (
          <div className={`rounded-xl border p-3 ${
            lastEntry.status === 'ORDER_NUMBER' || lastEntry.status === 'TRACKING_NUMBER'
              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
              : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
          }`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColors(lastEntry.status).badge}`}>
                    {statusColors(lastEntry.status).icon}
                    {statusLabel(lastEntry.status)}
                  </span>
                  <code className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate max-w-[200px]">
                    {lastEntry.code}
                  </code>
                </div>
                {lastEntry.order && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <Package size={12} className="text-zinc-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {lastEntry.order.customerName || lastEntry.order.orderNumber}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
                      <span>#{lastEntry.order.orderNumber}</span>
                      {lastEntry.order.platform && <span>{lastEntry.order.platform}</span>}
                      {lastEntry.order.trackingNumber && (
                        <span className="font-mono">{lastEntry.order.trackingNumber}</span>
                      )}
                      <span className={`font-semibold ${
                        lastEntry.order.importStatus === 'PACKED' ? 'text-green-600 dark:text-green-400' :
                        lastEntry.order.importStatus === 'CANCELLED' ? 'text-red-500' :
                        'text-blue-600 dark:text-blue-400'
                      }`}>{lastEntry.order.importStatus}</span>
                    </div>
                    {lastEntry.order.items.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {lastEntry.order.items.slice(0, 3).map(item => (
                          <p key={item.id} className="text-[11px] text-zinc-500 truncate">
                            {item.productName} <span className="font-bold text-zinc-700 dark:text-zinc-300">×{item.qty}</span>
                          </p>
                        ))}
                        {lastEntry.order.items.length > 3 && (
                          <p className="text-[11px] text-zinc-400">+{lastEntry.order.items.length - 3} รายการ</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {!lastEntry.order && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {lastEntry.status === 'NOT_FOUND' ? 'ไม่พบข้อมูลในระบบ' : 'เกิดข้อผิดพลาดในการค้นหา'}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-zinc-400 flex-shrink-0 mt-0.5">
                {lastEntry.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        )}

        {/* ── History ───────────────────────────────────────────────────────── */}
        {history.length > 1 && (
          <div>
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors mb-2">
              <Clock size={11} />
              ประวัติการสแกน ({history.length - 1} รายการก่อนหน้า)
              {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {showHistory && (
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {history.slice(1).map(entry => {
                  const { badge, icon } = statusColors(entry.status);
                  return (
                    <div key={entry.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${badge}`}>
                        {icon}
                        {statusLabel(entry.status)}
                      </span>
                      <code className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate flex-1">
                        {entry.code}
                      </code>
                      {entry.order && (
                        <span className="text-[11px] text-zinc-500 truncate max-w-[120px]">
                          {entry.order.customerName || entry.order.orderNumber}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400 flex-shrink-0">
                        {entry.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => setHistory(prev => prev.filter(e => e.id !== entry.id))}
                        className="text-zinc-300 hover:text-zinc-500 flex-shrink-0">
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {history.length === 0 && (
          <div className="text-center py-6 text-zinc-400 text-sm">
            <Scan size={28} className="mx-auto mb-2 opacity-30" />
            ยังไม่มีการสแกน — คลิกที่ช่องด้านบนแล้วสแกนบาร์โค้ด
          </div>
        )}
      </div>
    </div>
  );
}
